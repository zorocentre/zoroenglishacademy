package com.zoroacademy.service;

import com.zoroacademy.dto.FeedbackMediaPublicDto;
import com.zoroacademy.dto.VideoPlaybackResponse;
import com.zoroacademy.entity.FeedbackMedia;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.entity.Video;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.FeedbackMediaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class FeedbackMediaService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackMediaService.class);

    private final FeedbackMediaRepository feedbackMediaRepository;
    private final FileStorageService fileStorageService;
    private final BunnyStreamService bunnyStreamService;
    private final BunnyTokenService bunnyTokenService;

    // Rate limiting for public playback: max 60 requests per minute per IP
    private static final int MAX_PLAYBACK_REQUESTS_PER_MINUTE = 60;
    private final Map<String, Deque<Long>> playbackRateLimiter = new ConcurrentHashMap<>();

    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final long MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm", "mkv");
    private static final Set<String> REJECTED_AUDIO_EXTENSIONS = Set.of(
            "mp3", "wav", "ogg", "opus", "m4a", "aac", "flac", "wma", "mid", "midi", "aiff"
    );

    @Autowired
    public FeedbackMediaService(
            FeedbackMediaRepository feedbackMediaRepository,
            FileStorageService fileStorageService,
            @Autowired(required = false) BunnyStreamService bunnyStreamService,
            @Autowired(required = false) BunnyTokenService bunnyTokenService
    ) {
        this.feedbackMediaRepository = feedbackMediaRepository;
        this.fileStorageService = fileStorageService;
        this.bunnyStreamService = bunnyStreamService;
        this.bunnyTokenService = bunnyTokenService;
    }

    public List<FeedbackMediaPublicDto> getPublishedFeedbackMedia() {
        List<FeedbackMedia> items = feedbackMediaRepository.findByStatusOrderBySortOrderAscCreatedAtAsc("READY");
        return items.stream()
                .map(item -> new FeedbackMediaPublicDto(
                        item.getId(),
                        item.getMediaType(),
                        item.getUrl(),
                        item.getThumbnailUrl(),
                        item.getSortOrder()
                ))
                .collect(Collectors.toList());
    }

    public List<FeedbackMedia> getAllFeedbackMedia() {
        List<FeedbackMedia> items = feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc();
        // Check processing videos
        for (FeedbackMedia item : items) {
            if ("VIDEO".equals(item.getMediaType()) && "PROCESSING".equals(item.getStatus())) {
                syncStatus(item);
            }
        }
        return items;
    }

    private void syncStatus(FeedbackMedia item) {
        if (bunnyStreamService != null && item.getBunnyVideoId() != null) {
            try {
                Video v = bunnyStreamService.getVideoDetails(item.getBunnyVideoId());
                if (v != null && v.getStatus() != null) {
                    if (v.getStatus() == 3 || "Ready".equalsIgnoreCase(v.getStatusLabel())) {
                        item.setStatus("READY");
                        if (v.getThumbnailUrl() != null && !v.getThumbnailUrl().isBlank()) {
                            item.setThumbnailUrl(v.getThumbnailUrl());
                        }
                        feedbackMediaRepository.save(item);
                    } else if (v.getStatus() == 4 || v.getStatus() == 5 || "Failed".equalsIgnoreCase(v.getStatusLabel())) {
                        item.setStatus("FAILED");
                        feedbackMediaRepository.save(item);
                    }
                }
            } catch (Exception e) {
                log.debug("Could not sync video status for {}: {}", item.getBunnyVideoId(), e.getMessage());
            }
        }
    }

    @Transactional
    public List<FeedbackMedia> uploadMedia(MultipartFile[] files, String ownerId) {
        if (files == null || files.length == 0) {
            throw new BadRequestException("No files provided for upload.");
        }

        int currentMaxOrder = feedbackMediaRepository.findTopByOrderBySortOrderDesc()
                .map(m -> (m.getSortOrder() != null ? m.getSortOrder() : -1))
                .orElse(-1);

        List<FeedbackMedia> createdList = new ArrayList<>();

        for (MultipartFile file : files) {
            ValidatedMediaInfo info = validateFile(file);
            currentMaxOrder++;

            if (info.isImage()) {
                StoredFile stored = fileStorageService.storeFile(file, "feedback", ownerId);
                String fileUrl = fileStorageService.getFileUrl(stored);
                FeedbackMedia media = new FeedbackMedia(
                        "fbm_" + UUID.randomUUID().toString(),
                        "IMAGE",
                        stored.getId(),
                        null,
                        fileUrl,
                        null,
                        file.getOriginalFilename(),
                        stored.getContentType(),
                        stored.getSizeBytes(),
                        currentMaxOrder,
                        "READY",
                        ownerId
                );
                createdList.add(feedbackMediaRepository.save(media));
            } else if (info.isVideo()) {
                if (bunnyStreamService == null) {
                    throw new BadRequestException("Video streaming service is currently unavailable.");
                }

                Map<String, Object> videoResult = bunnyStreamService.uploadVideoBinary(file, file.getOriginalFilename());
                String videoId = (String) videoResult.get("videoId");
                if (videoId == null) {
                    videoId = (String) videoResult.get("id");
                }
                String status = (String) videoResult.getOrDefault("status", "Processing");
                String initialMediaStatus = "Ready".equalsIgnoreCase(status) ? "READY" : "PROCESSING";

                String thumbnailUrl = String.format("https://vz-b68c1f37-bc4.b-cdn.net/%s/thumbnail.jpg", videoId);

                FeedbackMedia media = new FeedbackMedia(
                        "fbm_" + UUID.randomUUID().toString(),
                        "VIDEO",
                        null,
                        videoId,
                        null,
                        thumbnailUrl,
                        file.getOriginalFilename(),
                        file.getContentType(),
                        file.getSize(),
                        currentMaxOrder,
                        initialMediaStatus,
                        ownerId
                );
                createdList.add(feedbackMediaRepository.save(media));
            }
        }

        return createdList;
    }

    @Transactional
    public List<FeedbackMedia> updateOrder(List<String> orderedIds) {
        if (orderedIds == null || orderedIds.isEmpty()) {
            throw new BadRequestException("Invalid reorder request: ID list cannot be empty.");
        }

        List<FeedbackMedia> allExisting = feedbackMediaRepository.findAll();
        if (allExisting.size() != orderedIds.size()) {
            throw new BadRequestException("Invalid reorder request: provided list of IDs does not match existing feedback media count.");
        }

        Set<String> existingIdSet = allExisting.stream().map(FeedbackMedia::getId).collect(Collectors.toSet());
        Set<String> providedIdSet = new HashSet<>(orderedIds);

        if (providedIdSet.size() != orderedIds.size()) {
            throw new BadRequestException("Invalid reorder request: duplicate IDs found in reorder list.");
        }

        if (!existingIdSet.equals(providedIdSet)) {
            throw new BadRequestException("Invalid reorder request: provided IDs do not match the existing feedback media items.");
        }

        Map<String, FeedbackMedia> map = allExisting.stream().collect(Collectors.toMap(FeedbackMedia::getId, m -> m));
        for (int i = 0; i < orderedIds.size(); i++) {
            FeedbackMedia item = map.get(orderedIds.get(i));
            item.setSortOrder(i);
            feedbackMediaRepository.save(item);
        }

        return feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc();
    }

    @Transactional
    public void deleteMedia(String id) {
        FeedbackMedia media = feedbackMediaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback media not found with id: " + id));

        String mediaType = media.getMediaType();
        String storedFileId = media.getStoredFileId();
        String bunnyVideoId = media.getBunnyVideoId();

        feedbackMediaRepository.delete(media);

        // Normalize remaining sort orders
        List<FeedbackMedia> remaining = feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc();
        for (int i = 0; i < remaining.size(); i++) {
            FeedbackMedia item = remaining.get(i);
            if (item.getSortOrder() != i) {
                item.setSortOrder(i);
                feedbackMediaRepository.save(item);
            }
        }

        // Purge storage
        if ("IMAGE".equals(mediaType) && storedFileId != null && !storedFileId.isBlank()) {
            try {
                fileStorageService.deleteFile(storedFileId);
            } catch (Exception e) {
                log.warn("Failed to delete stored file {}: {}", storedFileId, e.getMessage());
            }
        } else if ("VIDEO".equals(mediaType) && bunnyVideoId != null && !bunnyVideoId.isBlank()) {
            try {
                if (bunnyStreamService != null) {
                    bunnyStreamService.deleteVideo(bunnyVideoId);
                }
            } catch (Exception e) {
                log.warn("Failed to delete Bunny Stream video {}: {}", bunnyVideoId, e.getMessage());
            }
        }
    }

    public FeedbackMedia getMediaStatus(String id) {
        FeedbackMedia media = feedbackMediaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback media not found with id: " + id));
        if ("VIDEO".equals(media.getMediaType()) && "PROCESSING".equals(media.getStatus())) {
            syncStatus(media);
        }
        return media;
    }

    public VideoPlaybackResponse getPlaybackAuthorization(String id, String clientIp) {
        // Enforce Rate Limiting
        checkRateLimit(clientIp != null ? clientIp : "unknown");

        FeedbackMedia media = feedbackMediaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Video not found in feedback gallery."));

        if (!"VIDEO".equals(media.getMediaType())) {
            throw new BadRequestException("Requested feedback media is an image, not a video.");
        }

        if (!"READY".equals(media.getStatus())) {
            throw new BadRequestException("Video is still being processed and is not yet ready for playback.");
        }

        if (bunnyTokenService == null) {
            throw new BadRequestException("Video playback authorization service is unavailable.");
        }

        String videoId = media.getBunnyVideoId();
        String directStreamUrl = bunnyTokenService.generateSignedPlaybackUrl(videoId);
        String embedUrl = bunnyTokenService.generateSignedEmbedUrl(videoId);

        return VideoPlaybackResponse.builder()
                .videoId(videoId)
                .streamUrl(directStreamUrl)
                .embedUrl(embedUrl)
                .authorized(true)
                .message("Feedback video playback authorized")
                .build();
    }

    private void checkRateLimit(String ip) {
        long now = System.currentTimeMillis();
        long windowStart = now - 60_000L; // 1 minute sliding window

        Deque<Long> timestamps = playbackRateLimiter.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst() < windowStart) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_PLAYBACK_REQUESTS_PER_MINUTE) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many playback requests. Please try again shortly.");
            }
            timestamps.addLast(now);
        }
    }

    public ValidatedMediaInfo validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File cannot be empty.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "uploaded_media";
        }
        originalFilename = Paths.get(originalFilename).getFileName().toString();

        int dotIdx = originalFilename.lastIndexOf('.');
        String ext = (dotIdx >= 0 && dotIdx < originalFilename.length() - 1)
                ? originalFilename.substring(dotIdx + 1).toLowerCase(Locale.ROOT)
                : "";

        // 1. Extension check for Audio
        if (REJECTED_AUDIO_EXTENSIONS.contains(ext)) {
            throw new BadRequestException("Audio files are not supported in the feedback gallery.");
        }

        // 2. Declared Content-Type check for Audio
        String declaredContentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (declaredContentType.startsWith("audio/")) {
            throw new BadRequestException("Audio files are not supported in the feedback gallery.");
        }

        // 3. Read Header Magic Bytes
        byte[] header = new byte[32];
        try (InputStream in = file.getInputStream()) {
            int read = in.read(header);
            if (read < 4) {
                throw new BadRequestException("File is corrupted or too small.");
            }
        } catch (IOException e) {
            throw new BadRequestException("Failed to read file header: " + e.getMessage());
        }

        // 4. Magic Bytes check for Audio (Detects renamed audio files)
        boolean isId3Audio = header.length >= 3 && header[0] == 'I' && header[1] == 'D' && header[2] == '3';
        boolean isMp3Sync = (header[0] & 0xFF) == 0xFF && ((header[1] & 0xE0) == 0xE0);
        boolean isRiffWave = header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'A' && header[10] == 'V' && header[11] == 'E';
        boolean isOggAudio = header.length >= 4 && header[0] == 'O' && header[1] == 'g' && header[2] == 'g' && header[3] == 'S';
        boolean isFlacAudio = header.length >= 4 && header[0] == 'f' && header[1] == 'L' && header[2] == 'a' && header[3] == 'C';

        if (isId3Audio || isMp3Sync || isRiffWave || isOggAudio || isFlacAudio) {
            throw new BadRequestException("File signature indicates an audio file, which is not supported.");
        }

        // 5. Image Signature & Extension check
        boolean isJpg = (header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF;
        boolean isPng = (header[0] & 0xFF) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G';
        boolean isWebp = header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P';

        if (isJpg || isPng || isWebp) {
            if (!ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
                throw new BadRequestException("Image file must have a .jpg, .jpeg, .png, or .webp extension.");
            }
            if (file.getSize() > MAX_IMAGE_SIZE) {
                throw new BadRequestException("Image file size exceeds the maximum limit of 5 MB.");
            }
            return new ValidatedMediaInfo(true, false, ext, isJpg ? "image/jpeg" : isPng ? "image/png" : "image/webp");
        }

        // 6. Video Signature & Extension check
        // MP4 / MOV: bytes 4..7 == 'ftyp' or 'moov' or 'wide' or 'mdat'
        boolean isFtypVideo = header.length >= 8 && (
                (header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p')
                || (header[4] == 'm' && header[5] == 'o' && header[6] == 'o' && header[7] == 'v')
        );
        // WebM / MKV: EBML header 0x1A 0x45 0xDF 0xA3
        boolean isEbmlVideo = header.length >= 4 && (header[0] & 0xFF) == 0x1A && (header[1] & 0xFF) == 0x45
                && (header[2] & 0xFF) == 0xDF && (header[3] & 0xFF) == 0xA3;
        // AVI: RIFF....AVI 
        boolean isAviVideo = header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'A' && header[9] == 'V' && header[10] == 'I' && header[11] == ' ';

        if (isFtypVideo || isEbmlVideo || isAviVideo) {
            if (!ALLOWED_VIDEO_EXTENSIONS.contains(ext)) {
                throw new BadRequestException("Video file must have a .mp4, .mov, .avi, .webm, or .mkv extension.");
            }
            if (file.getSize() > MAX_VIDEO_SIZE) {
                throw new BadRequestException("Video file size exceeds the maximum limit of 500 MB.");
            }
            String vContentType = "video/" + ("mov".equals(ext) ? "quicktime" : "mkv".equals(ext) ? "x-matroska" : "avi".equals(ext) ? "x-msvideo" : ext);
            return new ValidatedMediaInfo(false, true, ext, vContentType);
        }

        // If neither valid image nor valid video signature matched
        throw new BadRequestException("Unsupported file format. Please upload an image (JPG, PNG, WEBP) or a video (MP4, MOV, AVI, WEBM, MKV).");
    }

    public static class ValidatedMediaInfo {
        private final boolean image;
        private final boolean video;
        private final String extension;
        private final String contentType;

        public ValidatedMediaInfo(boolean image, boolean video, String extension, String contentType) {
            this.image = image;
            this.video = video;
            this.extension = extension;
            this.contentType = contentType;
        }

        public boolean isImage() {
            return image;
        }

        public boolean isVideo() {
            return video;
        }

        public String getExtension() {
            return extension;
        }

        public String getContentType() {
            return contentType;
        }
    }
}
