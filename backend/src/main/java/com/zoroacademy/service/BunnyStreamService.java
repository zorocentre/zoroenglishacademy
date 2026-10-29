package com.zoroacademy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.config.BunnyStreamProperties;
import com.zoroacademy.dto.BunnyWebhookPayload;
import com.zoroacademy.dto.VideoPlaybackResponse;
import com.zoroacademy.dto.VideoUploadRequest;
import com.zoroacademy.dto.VideoUploadResponse;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.CourseModule;
import com.zoroacademy.entity.Video;
import com.zoroacademy.repository.CourseModuleRepository;
import com.zoroacademy.repository.EnrollmentRepository;
import com.zoroacademy.repository.VideoRepository;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class BunnyStreamService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BunnyStreamService.class);

    private final BunnyStreamProperties properties;
    private final BunnyTokenService tokenService;
    private final VideoRepository videoRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseModuleRepository courseModuleRepository;
    private final com.zoroacademy.repository.AssignmentSubmissionRepository submissionRepository;
    private final com.zoroacademy.repository.StudentModuleProgressRepository studentModuleProgressRepository;
    private final com.zoroacademy.repository.StudentProgressRepository studentProgressRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.CourseRepository courseRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.TrainerCourseRequestRepository trainerCourseRequestRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public BunnyStreamService(BunnyStreamProperties properties,
                              BunnyTokenService tokenService,
                              VideoRepository videoRepository,
                              EnrollmentRepository enrollmentRepository,
                              CourseModuleRepository courseModuleRepository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.AssignmentSubmissionRepository submissionRepository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentModuleProgressRepository studentModuleProgressRepository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentProgressRepository studentProgressRepository) {
        this.properties = properties;
        this.tokenService = tokenService;
        this.videoRepository = videoRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.courseModuleRepository = courseModuleRepository;
        this.submissionRepository = submissionRepository;
        this.studentModuleProgressRepository = studentModuleProgressRepository;
        this.studentProgressRepository = studentProgressRepository;
    }

    public BunnyStreamService(BunnyStreamProperties properties,
                              BunnyTokenService tokenService,
                              VideoRepository videoRepository,
                              EnrollmentRepository enrollmentRepository,
                              CourseModuleRepository courseModuleRepository) {
        this(properties, tokenService, videoRepository, enrollmentRepository, courseModuleRepository, null, null, null);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    private String sha256Hex(String input) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 calculation failed", e);
        }
    }

    /**
     * Creates an upload session with Bunny Stream API.
     */
    @Transactional
    public VideoUploadResponse createUploadSession(VideoUploadRequest request) {
        String videoTitle = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle()
                : "Lesson Video " + System.currentTimeMillis();

        int libraryId = (properties.getLibraryId() != null && !properties.getLibraryId().isBlank()) ? Integer.parseInt(properties.getLibraryId()) : 0;
        String videoId;
        try {
            String url = String.format("https://video.bunnycdn.com/library/%d/videos", libraryId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("AccessKey", properties.getApiKey());
            headers.set("Accept", "application/json");

            Map<String, String> body = new HashMap<>();
            body.put("title", videoTitle);

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
            String response = restTemplate.postForObject(url, entity, String.class);
            JsonNode root = objectMapper.readTree(response);
            videoId = root.path("guid").asText();
            if (videoId == null || videoId.isBlank()) {
                videoId = UUID.randomUUID().toString();
            }
        } catch (Exception e) {
            log.warn("Could not connect to external Bunny API, creating local video entity: {}", e.getMessage());
            videoId = UUID.randomUUID().toString();
        }

        String streamUrl = String.format("https://%s/%s/playlist.m3u8", properties.getCdnHost(), videoId);
        String tusEndpoint = "https://video.bunnycdn.com/tusupload";

        long expirationTime = (System.currentTimeMillis() / 1000) + 86400;
        String authSignature = sha256Hex(libraryId + properties.getApiKey() + expirationTime + videoId);

        Video video = Video.builder()
                .id(videoId)
                .bunnyVideoId(videoId)
                .libraryId(libraryId)
                .title(videoTitle)
                .courseId(request.getCourseId())
                .moduleId(request.getModuleId())
                .durationSeconds(0)
                .status(0)
                .statusLabel("Created")
                .storageKey("bunny_" + videoId)
                .directStreamUrl(streamUrl)
                .hlsPlaylistUrl(streamUrl)
                .thumbnailUrl(String.format("https://%s/%s/thumbnail.jpg", properties.getCdnHost(), videoId))
                .build();

        videoRepository.save(video);

        return VideoUploadResponse.builder()
                .videoId(videoId)
                .libraryId(libraryId)
                .uploadUrl(tusEndpoint)
                .authorizationSignature(authSignature)
                .authorizationExpire(expirationTime)
                .tusEndpoint(tusEndpoint)
                .directStreamUrl(streamUrl)
                .title(videoTitle)
                .status("Created")
                .build();
    }

    /**
     * Directly streams a video binary to Bunny Stream and saves the Video entity.
     * Uses HttpURLConnection with fixed-length streaming to eliminate JVM memory buffering.
     */
    @Transactional
    public Map<String, Object> uploadVideoBinary(MultipartFile file, String title) {
        String videoTitle = (title != null && !title.isBlank())
                ? title
                : (file.getOriginalFilename() != null ? file.getOriginalFilename() : "Video_" + System.currentTimeMillis());

        int libraryId = 0;
        try {
            if (properties.getLibraryId() != null && !properties.getLibraryId().isBlank()) {
                libraryId = Integer.parseInt(properties.getLibraryId());
            }
        } catch (NumberFormatException ignored) {}

        if (properties.getApiKey() == null || properties.getApiKey().isBlank() || libraryId <= 0) {
            log.error("Bunny Stream configuration missing: libraryId={}, apiKey present={}",
                    libraryId, (properties.getApiKey() != null && !properties.getApiKey().isBlank()));
            throw new com.zoroacademy.exception.BadRequestException("Bunny Stream is not configured: library-id or api-key is missing or invalid.");
        }

        String videoId = null;
        boolean uploadedToBunny = false;

        // Step 1: Create Video entry in Bunny Stream API
        try {
            String createUrl = String.format("https://video.bunnycdn.com/library/%d/videos", libraryId);
            HttpHeaders createHeaders = new HttpHeaders();
            createHeaders.setContentType(MediaType.APPLICATION_JSON);
            createHeaders.set("AccessKey", properties.getApiKey());
            createHeaders.set("Accept", "application/json");

            Map<String, String> body = new HashMap<>();
            body.put("title", videoTitle);

            HttpEntity<Map<String, String>> createEntity = new HttpEntity<>(body, createHeaders);
            ResponseEntity<String> createResp = restTemplate.postForEntity(createUrl, createEntity, String.class);
            if (!createResp.getStatusCode().is2xxSuccessful() || createResp.getBody() == null) {
                throw new RuntimeException("Bunny Stream video creation failed with HTTP " + createResp.getStatusCode().value() + ": " + createResp.getBody());
            }
            JsonNode root = objectMapper.readTree(createResp.getBody());
            videoId = root.path("guid").asText();
            if (videoId == null || videoId.isBlank()) {
                throw new RuntimeException("Bunny Stream video creation response did not contain guid: " + createResp.getBody());
            }
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String respBody = e.getResponseBodyAsString();
            log.error("Failed to create video on Bunny Stream API: HTTP {} - {}", e.getStatusCode().value(), respBody);
            throw new RuntimeException("Failed to initialize video on Bunny Stream (HTTP " + e.getStatusCode().value() + "): " + respBody, e);
        } catch (Exception e) {
            log.error("Could not create video on Bunny Stream API: {}", e.getMessage(), e);
            throw new RuntimeException("Could not create video on Bunny Stream: " + e.getMessage(), e);
        }

        // Step 2: Stream raw video binary to Bunny Stream via fixed-length streaming
        try {
            String uploadUrl = String.format("https://video.bunnycdn.com/library/%d/videos/%s", libraryId, videoId);
            URI uri = URI.create(uploadUrl);
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("PUT");
            conn.setDoOutput(true);
            conn.setConnectTimeout(60000);
            conn.setReadTimeout(600000); // 10 minutes for larger video files
            conn.setRequestProperty("AccessKey", properties.getApiKey());
            conn.setRequestProperty("Content-Type", "application/octet-stream");

            long fileSize = file.getSize();
            if (fileSize > 0) {
                conn.setFixedLengthStreamingMode(fileSize);
            } else {
                conn.setChunkedStreamingMode(65536);
            }

            try (InputStream in = file.getInputStream();
                 OutputStream out = conn.getOutputStream()) {
                byte[] buffer = new byte[65536]; // 64KB buffer
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();
            }

            int responseCode = conn.getResponseCode();
            String responseBody = "";
            try (InputStream respStream = (responseCode >= 200 && responseCode < 300) ? conn.getInputStream() : conn.getErrorStream()) {
                if (respStream != null) {
                    responseBody = new String(respStream.readAllBytes(), StandardCharsets.UTF_8);
                }
            }

            if (responseCode >= 200 && responseCode < 300) {
                uploadedToBunny = true;
                log.info("Successfully streamed video binary to Bunny Stream: videoId={}, bytes={}", videoId, fileSize);
            } else {
                log.error("Bunny Stream binary upload failed for videoId {}: HTTP {} - {}", videoId, responseCode, responseBody);
                throw new RuntimeException("Bunny Stream binary upload failed (HTTP " + responseCode + "): " + responseBody);
            }
        } catch (Exception e) {
            log.error("Direct binary upload to Bunny Stream failed for videoId {}: {}", videoId, e.getMessage(), e);
            throw new RuntimeException("Bunny Stream upload failed: " + e.getMessage(), e);
        }

        String streamUrl = String.format("https://%s/%s/playlist.m3u8", properties.getCdnHost(), videoId);
        String embedUrl = String.format("https://iframe.mediadelivery.net/embed/%s/%s", libraryId, videoId);

        Video video = Video.builder()
                .id(videoId)
                .bunnyVideoId(videoId)
                .libraryId(libraryId)
                .title(videoTitle)
                .durationSeconds(0)
                .status(uploadedToBunny ? 2 : 0) // 2 = Processing, 0 = Created
                .statusLabel(uploadedToBunny ? "Processing" : "Created")
                .storageKey("bunny_" + videoId)
                .directStreamUrl(streamUrl)
                .hlsPlaylistUrl(streamUrl)
                .thumbnailUrl(String.format("https://%s/%s/thumbnail.jpg", properties.getCdnHost(), videoId))
                .build();

        videoRepository.save(video);

        Map<String, Object> result = new HashMap<>();
        result.put("storageType", "BUNNY_STREAM");
        result.put("id", videoId);
        result.put("videoId", videoId);
        result.put("bunnyVideoId", videoId);
        result.put("libraryId", libraryId);
        result.put("title", videoTitle);
        result.put("fileName", file.getOriginalFilename());
        result.put("url", streamUrl);
        result.put("embedUrl", embedUrl);
        result.put("directStreamUrl", streamUrl);
        result.put("contentType", file.getContentType());
        result.put("size", file.getSize());
        result.put("status", video.getStatusLabel());
        return result;
    }

    @Transactional
    public Video getVideoDetails(String videoId) {
        if (videoId == null || videoId.isBlank()) return null;

        Optional<Video> videoOpt = videoRepository.findById(videoId)
                .or(() -> videoRepository.findByBunnyVideoId(videoId));

        if (videoOpt.isEmpty()) {
            return null;
        }

        Video video = videoOpt.get();
        if (video.getStatus() == null || video.getStatus() != 3) {
            try {
                String url = String.format("https://video.bunnycdn.com/library/%d/videos/%s",
                        video.getLibraryId(), video.getBunnyVideoId());
                HttpHeaders headers = new HttpHeaders();
                headers.set("AccessKey", properties.getApiKey());
                headers.set("Accept", "application/json");

                HttpEntity<Void> entity = new HttpEntity<>(headers);
                String response = restTemplate.exchange(url, org.springframework.http.HttpMethod.GET, entity, String.class).getBody();
                if (response != null) {
                    JsonNode root = objectMapper.readTree(response);
                    int statusInt = root.path("status").asInt(video.getStatus() != null ? video.getStatus() : 0);
                    int lengthSec = root.path("length").asInt(video.getDurationSeconds() != null ? video.getDurationSeconds() : 0);

                    video.setStatus(statusInt);
                    video.setStatusLabel(mapBunnyStatus(statusInt));
                    if (lengthSec > 0) {
                        video.setDurationSeconds(lengthSec);
                    }
                    video.setUpdatedAt(LocalDateTime.now());
                    videoRepository.save(video);

                    if (video.getModuleId() != null && statusInt == 3 && lengthSec > 0) {
                        courseModuleRepository.findById(video.getModuleId()).ifPresent(mod -> {
                            if (mod.getDuration() == null || mod.getDuration().isBlank() || "Lesson Video".equalsIgnoreCase(mod.getDuration())) {
                                int mins = lengthSec / 60;
                                int secs = lengthSec % 60;
                                mod.setDuration(String.format("%d:%02d", mins, secs));
                                courseModuleRepository.save(mod);
                            }
                        });
                    }
                }
            } catch (Exception e) {
                log.debug("Could not sync video status from Bunny CDN: {}", e.getMessage());
            }
        }
        return video;
    }

    @Transactional
    public void deleteVideo(String videoId) {
        if (videoId == null || videoId.isBlank()) return;
        Optional<Video> videoOpt = videoRepository.findById(videoId)
                .or(() -> videoRepository.findByBunnyVideoId(videoId));
        if (videoOpt.isPresent()) {
            Video v = videoOpt.get();
            try {
                String url = String.format("https://video.bunnycdn.com/library/%d/videos/%s", v.getLibraryId(), v.getBunnyVideoId());
                HttpHeaders headers = new HttpHeaders();
                headers.set("AccessKey", properties.getApiKey());
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                restTemplate.exchange(url, org.springframework.http.HttpMethod.DELETE, entity, Void.class);
            } catch (Exception e) {
                log.warn("Failed to delete video {} from Bunny Stream: {}", videoId, e.getMessage());
            }
            videoRepository.delete(v);
        } else {
            try {
                String url = String.format("https://video.bunnycdn.com/library/%s/videos/%s", properties.getLibraryId(), videoId);
                HttpHeaders headers = new HttpHeaders();
                headers.set("AccessKey", properties.getApiKey());
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                restTemplate.exchange(url, org.springframework.http.HttpMethod.DELETE, entity, Void.class);
            } catch (Exception ignored) {}
        }
    }

    /**
     * Authorizes video playback for student/trainer/admin and returns signed Bunny token & URL.
     * Enforces course enrollment and denies access if video has no course.
     */
    @Transactional(readOnly = true)
    public VideoPlaybackResponse getPlaybackAuthorization(String videoOrModuleId, String courseIdParam, String authenticatedUserId, String userEmail, String userRole, String clientIp) {
        // Resolve video by ID, bunnyVideoId, or moduleId in videos table
        Optional<Video> videoOpt = videoRepository.findById(videoOrModuleId)
                .or(() -> videoRepository.findByBunnyVideoId(videoOrModuleId))
                .or(() -> {
                    List<Video> byMod = videoRepository.findByModuleId(videoOrModuleId);
                    return byMod.isEmpty() ? Optional.empty() : Optional.of(byMod.get(0));
                });

        // Also resolve through course_modules table to unify source of truth
        Optional<CourseModule> moduleOpt = courseModuleRepository.findById(videoOrModuleId);
        if (moduleOpt.isEmpty() && videoOpt.isPresent() && videoOpt.get().getModuleId() != null) {
            moduleOpt = courseModuleRepository.findById(videoOpt.get().getModuleId());
        }

        String effectiveVideoId = videoOpt.map(Video::getBunnyVideoId).orElse(null);
        String courseId = videoOpt.map(Video::getCourseId).orElse(null);
        String moduleId = videoOpt.map(Video::getModuleId).orElse(null);

        if (moduleOpt.isPresent()) {
            CourseModule mod = moduleOpt.get();
            if (moduleId == null) {
                moduleId = mod.getId();
            }
            if (courseId == null && mod.getCourse() != null) {
                courseId = mod.getCourse().getId();
            }
            if (effectiveVideoId == null && mod.getVideoStorageRef() != null) {
                try {
                    JsonNode node = objectMapper.readTree(mod.getVideoStorageRef());
                    if (node.has("videoId")) {
                        effectiveVideoId = node.get("videoId").asText();
                    } else if (node.has("storageKey")) {
                        effectiveVideoId = node.get("storageKey").asText().replace("bunny_", "");
                    }
                } catch (Exception ignored) {}
            }
        }

        if (courseId == null && courseIdParam != null && !courseIdParam.isBlank()) {
            courseId = courseIdParam;
        }

        if (effectiveVideoId == null) {
            effectiveVideoId = videoOrModuleId;
        }

        // Strict Requirement: If the video has no course, DENY access
        if (courseId == null || courseId.isBlank()) {
            return VideoPlaybackResponse.builder()
                    .authorized(false)
                    .videoId(effectiveVideoId)
                    .message("Access Denied: Video is not associated with any active course.")
                    .build();
        }

        // Verification: Admin and Trainer are authorized; Student must have active enrollment
        boolean isAuthorized = false;
        String authMessage = "Authorized";

        if ("ADMIN".equalsIgnoreCase(userRole) || "SUPER_ADMIN".equalsIgnoreCase(userRole)) {
            isAuthorized = true;
        } else if ("TRAINER".equalsIgnoreCase(userRole)) {
            Course course = courseRepository != null ? courseRepository.findById(courseId).orElse(null) : null;
            boolean isTrainerAudience = course != null && "trainer".equalsIgnoreCase(course.getAudience());
            if (isTrainerAudience) {
                // Trainer is a learner on this course: verify approved access/enrollment and sequential lock
                boolean approved = false;
                if (authenticatedUserId != null && !authenticatedUserId.isBlank()) {
                    if (trainerCourseRequestRepository != null) {
                        approved = trainerCourseRequestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(authenticatedUserId, courseId, "Approved").isPresent();
                        if (!approved && userEmail != null) {
                            approved = trainerCourseRequestRepository.findByCourseId(courseId).stream()
                                    .anyMatch(r -> userEmail.equalsIgnoreCase(r.getTrainerEmail()) && "Approved".equalsIgnoreCase(r.getStatus()));
                        }
                    }
                    if (!approved && course != null && course.getTrainerId() != null && course.getTrainerId().equals(authenticatedUserId)) {
                        approved = true;
                    }
                    if (!approved && enrollmentRepository != null) {
                        approved = enrollmentRepository.existsByStudentIdAndCourseId(authenticatedUserId, courseId)
                                || (userEmail != null && enrollmentRepository.existsByStudentEmailIgnoreCaseAndCourseId(userEmail, courseId))
                                || enrollmentRepository.existsByStudentEmailIgnoreCaseAndCourseId(authenticatedUserId, courseId);
                    }
                }
                if (approved) {
                    if (moduleId != null && isModuleLocked(courseId, moduleId, authenticatedUserId, userEmail)) {
                        isAuthorized = false;
                        authMessage = "Access Denied: Complete previous module assignment to unlock.";
                    } else {
                        isAuthorized = true;
                    }
                } else {
                    isAuthorized = false;
                    authMessage = "Access Denied: You do not have approved access to this trainer course.";
                }
            } else {
                // Teaching student-audience course
                isAuthorized = true;
            }
        } else if (authenticatedUserId != null && !authenticatedUserId.isBlank()) {
            boolean enrolled = enrollmentRepository.existsByStudentIdAndCourseId(authenticatedUserId, courseId)
                    || (userEmail != null && enrollmentRepository.existsByStudentEmailIgnoreCaseAndCourseId(userEmail, courseId))
                    || enrollmentRepository.existsByStudentEmailIgnoreCaseAndCourseId(authenticatedUserId, courseId);
            if (enrolled) {
                if (moduleId != null && isModuleLocked(courseId, moduleId, authenticatedUserId, userEmail)) {
                    isAuthorized = false;
                    authMessage = "Access Denied: Complete previous module assignment to unlock.";
                } else {
                    isAuthorized = true;
                }
            } else {
                isAuthorized = false;
                authMessage = "Access Denied: You are not enrolled in this course.";
            }
        } else {
            isAuthorized = false;
            authMessage = "Access Denied: Authentication required to stream course videos.";
        }

        if (!isAuthorized) {
            return VideoPlaybackResponse.builder()
                    .authorized(false)
                    .videoId(effectiveVideoId)
                    .courseId(courseId)
                    .message(authMessage)
                    .build();
        }

        long expiresAt = (System.currentTimeMillis() / 1000) + properties.getTokenExpirationSeconds();
        // Drop IP binding to ensure reliable playback across dynamic networks/proxies
        String streamToken = tokenService.generateToken(effectiveVideoId, expiresAt, null);
        String embedToken = tokenService.generateEmbedToken(effectiveVideoId, expiresAt);

        String signedStreamUrl = String.format("https://%s/%s/playlist.m3u8?token=%s&expires=%d",
                properties.getCdnHost(), effectiveVideoId, streamToken, expiresAt);
        String signedEmbedUrl = String.format("https://iframe.mediadelivery.net/embed/%s/%s?token=%s&expires=%d",
                properties.getLibraryId(), effectiveVideoId, embedToken, expiresAt);

        return VideoPlaybackResponse.builder()
                .authorized(true)
                .videoId(effectiveVideoId)
                .courseId(courseId)
                .moduleId(moduleId)
                .token(embedToken)
                .expiresAt(expiresAt)
                .streamUrl(signedStreamUrl)
                .embedUrl(signedEmbedUrl)
                .fallbackUrl(null)
                .message("Playback authorized successfully")
                .build();
    }

    @Transactional(readOnly = true)
    public VideoPlaybackResponse getPlaybackAuthorization(String videoOrModuleId, String authenticatedUserId, String userRole, String clientIp) {
        return getPlaybackAuthorization(videoOrModuleId, null, authenticatedUserId, null, userRole, clientIp);
    }

    /**
     * Webhook receiver for Bunny Stream event notifications.
     */
    @Transactional
    public void processWebhook(BunnyWebhookPayload payload) {
        if (payload == null || payload.getVideoGuid() == null) return;

        Optional<Video> videoOpt = videoRepository.findByBunnyVideoId(payload.getVideoGuid());
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            if (payload.getStatus() != null) {
                video.setStatus(payload.getStatus());
                video.setStatusLabel(mapBunnyStatus(payload.getStatus()));
            }
            if (payload.getLength() != null && payload.getLength() > 0) {
                video.setDurationSeconds(payload.getLength());
            }
            video.setUpdatedAt(LocalDateTime.now());
            videoRepository.save(video);
            log.info("Updated video {} status to {}", video.getBunnyVideoId(), video.getStatusLabel());

            if (video.getModuleId() != null && video.getStatus() != null && video.getStatus() == 3 && video.getDurationSeconds() != null && video.getDurationSeconds() > 0) {
                courseModuleRepository.findById(video.getModuleId()).ifPresent(mod -> {
                    if (mod.getDuration() == null || mod.getDuration().isBlank() || "Lesson Video".equalsIgnoreCase(mod.getDuration())) {
                        int mins = video.getDurationSeconds() / 60;
                        int secs = video.getDurationSeconds() % 60;
                        mod.setDuration(String.format("%d:%02d", mins, secs));
                        courseModuleRepository.save(mod);
                    }
                });
            }
        } else {
            log.warn("Received webhook for unknown video guid: {}", payload.getVideoGuid());
        }
    }

    private String mapBunnyStatus(int status) {
        return switch (status) {
            case 0 -> "Created";
            case 1 -> "Uploaded";
            case 2 -> "Processing";
            case 3 -> "Ready";
            case 4 -> "Failed";
            default -> "Status-" + status;
        };
    }

    private boolean isModuleCompleted(CourseModule m, String courseId, String studentId, String studentEmail) {
        String effectiveStudentId = studentId;
        String effectiveEmail = studentEmail;
        if (effectiveStudentId != null && effectiveStudentId.contains("@") && effectiveEmail == null) {
            effectiveEmail = effectiveStudentId;
        }
        if ((effectiveStudentId == null || effectiveStudentId.contains("@")) && effectiveEmail != null && userRepository != null) {
            effectiveStudentId = userRepository.findByEmailIgnoreCase(effectiveEmail)
                    .map(com.zoroacademy.entity.User::getId)
                    .orElse(effectiveStudentId);
        }

        boolean hasVideo = (m.getVideoStorageRef() != null && !m.getVideoStorageRef().isBlank() && !"null".equalsIgnoreCase(m.getVideoStorageRef().trim()) && !"{}".equals(m.getVideoStorageRef().trim()))
                || (videoRepository != null && !videoRepository.findByModuleId(m.getId()).isEmpty());

        boolean videoDone = !hasVideo;
        if (hasVideo) {
            if (effectiveStudentId != null && studentModuleProgressRepository != null) {
                java.util.Optional<com.zoroacademy.entity.StudentModuleProgress> smpOpt = studentModuleProgressRepository.findByStudentIdAndModuleId(effectiveStudentId, m.getId());
                if (smpOpt.isPresent()) {
                    com.zoroacademy.entity.StudentModuleProgress smp = smpOpt.get();
                    if (Boolean.TRUE.equals(smp.getVideoCompleted()) || Boolean.TRUE.equals(smp.getCompleted())) {
                        videoDone = true;
                    } else if (smp.getWatchedSeconds() != null && smp.getDurationSeconds() != null && smp.getDurationSeconds() > 0) {
                        int threshold = (int) Math.ceil(smp.getDurationSeconds() * 0.95);
                        if (smp.getWatchedSeconds() >= threshold) {
                            videoDone = true;
                        }
                    }
                }
            }
            if (!videoDone && effectiveStudentId != null && studentProgressRepository != null) {
                videoDone = studentProgressRepository.findByStudentIdIgnoreCaseAndCourseIdAndModuleId(effectiveStudentId, courseId, m.getId())
                        .map(sp -> "Completed".equalsIgnoreCase(sp.getStatus())).orElse(false);
            }
            if (!videoDone && effectiveEmail != null && studentProgressRepository != null) {
                videoDone = studentProgressRepository.findByStudentIdIgnoreCaseAndCourseIdAndModuleId(effectiveEmail, courseId, m.getId())
                        .map(sp -> "Completed".equalsIgnoreCase(sp.getStatus())).orElse(false);
            }
        }

        boolean hasAssignment = (m.getAssignmentFileUrl() != null && !m.getAssignmentFileUrl().isBlank())
                || (m.getAssignmentFileName() != null && !m.getAssignmentFileName().isBlank());

        boolean assignmentDone = !hasAssignment;
        if (hasAssignment) {
            if (submissionRepository != null) {
                if (effectiveStudentId != null && !submissionRepository.findBySourceTypeAndSourceIdAndStudentId("module", m.getId(), effectiveStudentId).isEmpty()) {
                    assignmentDone = true;
                }
                if (!assignmentDone && effectiveEmail != null && !submissionRepository.findBySourceTypeAndSourceIdAndStudentEmailIgnoreCase("module", m.getId(), effectiveEmail).isEmpty()) {
                    assignmentDone = true;
                }
            }
        }

        return videoDone && assignmentDone;
    }

    private boolean isModuleLocked(String courseId, String moduleId, String studentId, String studentEmail) {
        if (moduleId == null || courseId == null) return false;
        List<CourseModule> modules = courseModuleRepository.findByCourseIdOrderByModuleOrderAsc(courseId);
        if (modules == null || modules.isEmpty()) return false;

        // Module 1 is always unlocked
        if (modules.get(0).getId().equals(moduleId)) {
            return false;
        }

        boolean prevCompleted = true;
        for (int i = 0; i < modules.size(); i++) {
            CourseModule m = modules.get(i);
            if (m.getId().equals(moduleId)) {
                return !prevCompleted;
            }

            if (!isModuleCompleted(m, courseId, studentId, studentEmail)) {
                prevCompleted = false;
            }

            if (!prevCompleted) {
                return true;
            }
        }
        return false;
    }
}
