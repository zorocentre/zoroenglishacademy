package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.FileAccessResult;
import com.zoroacademy.service.FileAccessService;
import com.zoroacademy.service.FileStorageService;
import com.zoroacademy.repository.CompetitionRepository;
import com.zoroacademy.entity.Competition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileStorageService fileStorageService;
    private final FileAccessService fileAccessService;
    private final CompetitionRepository competitionRepository;
    private final com.zoroacademy.repository.CompetitionStudyMaterialRepository competitionStudyMaterialRepository;
    private final com.zoroacademy.repository.AttemptAnswerRepository attemptAnswerRepository;
    private final com.zoroacademy.repository.AssessmentQuestionRepository assessmentQuestionRepository;
    private final com.zoroacademy.repository.CompetitionSyllabusRepository competitionSyllabusRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.service.BunnyStreamService bunnyStreamService;

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173}")
    private String allowedOrigins;

    public FileController(FileStorageService fileStorageService,
                          FileAccessService fileAccessService,
                          CompetitionRepository competitionRepository,
                          com.zoroacademy.repository.CompetitionStudyMaterialRepository competitionStudyMaterialRepository,
                          com.zoroacademy.repository.AttemptAnswerRepository attemptAnswerRepository,
                          com.zoroacademy.repository.AssessmentQuestionRepository assessmentQuestionRepository,
                          com.zoroacademy.repository.CompetitionSyllabusRepository competitionSyllabusRepository) {
        this.fileStorageService = fileStorageService;
        this.fileAccessService = fileAccessService;
        this.competitionRepository = competitionRepository;
        this.competitionStudyMaterialRepository = competitionStudyMaterialRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.assessmentQuestionRepository = assessmentQuestionRepository;
        this.competitionSyllabusRepository = competitionSyllabusRepository;
    }

    public static String resolveMimeType(String originalName, String defaultType) {
        if (defaultType != null && defaultType.startsWith("audio/")) {
            return defaultType;
        }
        if (originalName == null) {
            return (defaultType != null && !defaultType.isBlank()) ? defaultType : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        String lower = originalName.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".doc")) return "application/msword";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
        if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".opus")) return "audio/ogg; codecs=opus";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".mp4")) return (defaultType != null && defaultType.startsWith("audio/")) ? defaultType : "video/mp4";
        if (lower.endsWith(".webm")) return (defaultType != null && defaultType.startsWith("audio/")) ? defaultType : "video/webm";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".zip")) return "application/zip";

        if (defaultType != null && !defaultType.isBlank() && !defaultType.equals(MediaType.APPLICATION_OCTET_STREAM_VALUE)) {
            return defaultType;
        }

        return org.springframework.http.MediaTypeFactory
                .getMediaType(originalName)
                .map(MediaType::toString)
                .orElse(MediaType.APPLICATION_OCTET_STREAM_VALUE);
    }

    private UserPrincipal resolvePrincipal(Object principal) {
        if (principal instanceof UserPrincipal up) {
            return up;
        }
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud) {
            String role = ud.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .map(a -> a.replace("ROLE_", ""))
                    .findFirst().orElse("STUDENT");
            return new UserPrincipal(ud.getUsername(), ud.getUsername(), ud.getUsername(), role, "N/A", ud.getAuthorities());
        }
        return null;
    }

    @PostMapping(value = {"", "/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false, defaultValue = "document") String category,
            @AuthenticationPrincipal Object principal
    ) {
        UserPrincipal currentUser = resolvePrincipal(principal);
        String ownerId = (currentUser != null ? currentUser.getId() : null);
        StoredFile storedFile = fileStorageService.storeFile(file, category, ownerId);

        Map<String, Object> result = new HashMap<>();
        result.put("id", storedFile.getId());
        result.put("url", fileStorageService.getFileUrl(storedFile));
        result.put("name", storedFile.getOriginalName());
        result.put("size", storedFile.getSizeBytes());
        result.put("contentType", storedFile.getContentType());
        result.put("category", storedFile.getCategory());
        result.put("isPublic", storedFile.getIsPublic());
        result.put("storagePath", storedFile.getStoragePath());
        result.put("refCount", storedFile.getRefCount());

        return ApiResponse.ok(result, "File uploaded successfully");
    }

    @PostMapping(value = "/unified-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> unifiedUpload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false, defaultValue = "auto") String category,
            @RequestParam(value = "title", required = false) String title,
            @AuthenticationPrincipal Object principal
    ) {
        if (file == null || file.isEmpty()) {
            throw new com.zoroacademy.exception.BadRequestException("File cannot be empty");
        }

        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String cat = (category != null ? category.trim().toLowerCase() : "auto");

        boolean isVideo = cat.contains("video")
                || contentType.startsWith("video/")
                || origName.endsWith(".mp4")
                || origName.endsWith(".mov")
                || origName.endsWith(".avi")
                || origName.endsWith(".webm")
                || origName.endsWith(".mkv");

        if (isVideo && bunnyStreamService != null) {
            Map<String, Object> videoResult = bunnyStreamService.uploadVideoBinary(file, title);
            return ApiResponse.ok(videoResult, "Video uploaded to Bunny Stream successfully");
        }

        UserPrincipal currentUser = resolvePrincipal(principal);
        String ownerId = (currentUser != null ? currentUser.getId() : null);
        String targetCategory = ("auto".equals(cat) || isVideo) ? "document" : cat;
        StoredFile storedFile = fileStorageService.storeFile(file, targetCategory, ownerId);

        Map<String, Object> result = new HashMap<>();
        result.put("storageType", "BUNNY_STORAGE");
        result.put("id", storedFile.getId());
        result.put("fileId", storedFile.getId());
        result.put("url", fileStorageService.getFileUrl(storedFile));
        result.put("name", storedFile.getOriginalName());
        result.put("fileName", storedFile.getOriginalName());
        result.put("size", storedFile.getSizeBytes());
        result.put("contentType", storedFile.getContentType());
        result.put("category", storedFile.getCategory());
        result.put("isPublic", storedFile.getIsPublic());
        result.put("storagePath", storedFile.getStoragePath());

        return ApiResponse.ok(result, "File uploaded to storage successfully");
    }

    @GetMapping("/{id}/meta")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<StoredFile> getFileMetadata(
            @PathVariable String id,
            @AuthenticationPrincipal Object principal
    ) {
        StoredFile storedFile = fileStorageService.getFileMetadata(id);
        return ApiResponse.ok(storedFile);
    }

    @GetMapping("/{id}/link")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFileLink(
            @PathVariable String id,
            @RequestParam(value = "download", required = false, defaultValue = "false") boolean download,
            @AuthenticationPrincipal Object principal
    ) {
        UserPrincipal currentUser = resolvePrincipal(principal);
        StoredFile storedFile = fileStorageService.getFileMetadata(id);
        if (storedFile == null) {
            Map<String, Object> errData = new HashMap<>();
            errData.put("code", "NOT_FOUND");
            errData.put("message", "File not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("NOT_FOUND", "File not found", errData));
        }

        if (download) {
            boolean isAdmin = currentUser != null && ("ADMIN".equals(currentUser.getRole()) || "SUPER_ADMIN".equals(currentUser.getRole()));
            if (!isAdmin) {
                Map<String, Object> errData = new HashMap<>();
                errData.put("code", "DOWNLOAD_FORBIDDEN");
                errData.put("message", "Download is disabled for view-only resources");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("DOWNLOAD_FORBIDDEN", "Download is disabled for view-only resources", errData));
            }
        }

        FileAccessResult accessResult = fileAccessService.checkAccess(storedFile, currentUser);
        if (!accessResult.isAllowed()) {
            Map<String, Object> errData = new HashMap<>();
            errData.put("code", accessResult.getCode());
            errData.put("message", accessResult.getMessage());
            if (accessResult.getUnlockAt() != null) {
                errData.put("unlockAt", accessResult.getUnlockAt());
            }
            HttpStatus status = "NOT_FOUND".equals(accessResult.getCode()) ? HttpStatus.NOT_FOUND
                    : "AUTH_REQUIRED".equals(accessResult.getCode()) ? HttpStatus.UNAUTHORIZED
                    : HttpStatus.FORBIDDEN;
            return ResponseEntity.status(status).body(ApiResponse.error(accessResult.getCode(), accessResult.getMessage(), errData));
        }

        Map<String, Object> linkData = fileStorageService.generateFileLink(storedFile, 7200);
        if (download && linkData != null && linkData.containsKey("url")) {
            String url = (String) linkData.get("url");
            if (url != null && !url.contains("download=")) {
                String sep = url.contains("?") ? "&" : "?";
                linkData.put("url", url + sep + "download=true");
            }
        }
        return ResponseEntity.ok(ApiResponse.ok(linkData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getFile(
            @PathVariable String id,
            @RequestParam(value = "token", required = false) String token,
            @RequestParam(value = "expires", required = false) Long expires,
            @RequestParam(value = "download", required = false, defaultValue = "false") boolean download,
            @RequestHeader HttpHeaders headers,
            @AuthenticationPrincipal Object principal
    ) {
        UserPrincipal currentUser = resolvePrincipal(principal);
        StoredFile storedFile = fileStorageService.getFileMetadata(id);
        if (storedFile == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .header("X-Error-Code", "NOT_FOUND")
                    .body(ApiResponse.error("NOT_FOUND", "File not found"));
        }

        boolean isStudyMaterial = !competitionStudyMaterialRepository.findByStoredFileId(id).isEmpty();
        boolean isAttemptAnswer = !attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(id, id).isEmpty();
        boolean isQuestionMedia = !assessmentQuestionRepository.findByMediaRefContaining(id).isEmpty();
        boolean isSyllabus = (competitionSyllabusRepository != null) && !competitionSyllabusRepository.findByStoredFileId(id).isEmpty();
        boolean isRestrictedExamResource = isStudyMaterial || isAttemptAnswer || isQuestionMedia || isSyllabus;

        if (download) {
            boolean isAdmin = currentUser != null && ("ADMIN".equals(currentUser.getRole()) || "SUPER_ADMIN".equals(currentUser.getRole()));
            if (!isAdmin) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .header("X-Error-Code", "DOWNLOAD_FORBIDDEN")
                        .body(ApiResponse.error("DOWNLOAD_FORBIDDEN", "Download is disabled for view-only resources"));
            }
        }

        // Security check for non-public or exam-restricted files
        String fileCat = storedFile.getCategory() != null ? storedFile.getCategory().toLowerCase() : "";
        boolean isCategoryPublic = "public".equals(fileCat)
                || "competition".equals(fileCat)
                || "avatar".equals(fileCat)
                || "thumbnail".equals(fileCat)
                || "banner".equals(fileCat)
                || "hero".equals(fileCat);

        if (isRestrictedExamResource || (!Boolean.TRUE.equals(storedFile.getIsPublic()) && !isCategoryPublic)) {
            boolean hasValidToken = token != null && expires != null && fileStorageService.validateInternalToken(id, token, expires);

            if (!hasValidToken) {
                FileAccessResult accessResult = fileAccessService.checkAccess(storedFile, currentUser);
                if (!accessResult.isAllowed()) {
                    HttpStatus status = "NOT_FOUND".equals(accessResult.getCode()) ? HttpStatus.NOT_FOUND
                            : "AUTH_REQUIRED".equals(accessResult.getCode()) ? HttpStatus.UNAUTHORIZED
                            : HttpStatus.FORBIDDEN;
                    return ResponseEntity.status(status)
                            .header("X-Error-Code", accessResult.getCode())
                            .header("X-Error-Message", accessResult.getMessage())
                            .body(ApiResponse.error(accessResult.getCode(), accessResult.getMessage()));
                }
            }
        }

        Resource resource = fileStorageService.loadFileAsResource(storedFile);
        String defaultType = ("voice-answer".equalsIgnoreCase(storedFile.getCategory()) && (storedFile.getContentType() == null || storedFile.getContentType().isBlank()))
                ? "audio/webm" : storedFile.getContentType();
        String mediaType = resolveMimeType(storedFile.getOriginalName(), defaultType);

        ContentDisposition contentDisposition = ContentDisposition.builder(download ? "attachment" : "inline")
                .filename(storedFile.getOriginalName(), StandardCharsets.UTF_8)
                .build();

        String allowedOriginsCsp = String.join(" ", allowedOrigins != null ? allowedOrigins.split(",") : new String[]{"http://localhost:5173"});

        // Check for Range header for streaming (especially video and audio)
        List<org.springframework.http.HttpRange> ranges = headers.getRange();
        if (!ranges.isEmpty() && !download) {
            try {
                long contentLength = resource.contentLength();
                org.springframework.http.HttpRange range = ranges.get(0);
                long start = range.getRangeStart(contentLength);
                long end = range.getRangeEnd(contentLength);
                long rangeLength = Math.min(1024 * 1024 * 2, end - start + 1);
                long actualEnd = start + rangeLength - 1;

                byte[] buffer = new byte[(int) rangeLength];
                try (java.io.InputStream is = resource.getInputStream()) {
                    long skipped = is.skip(start);
                    int totalRead = 0;
                    while (totalRead < rangeLength) {
                        int read = is.read(buffer, totalRead, (int) rangeLength - totalRead);
                        if (read == -1) break;
                        totalRead += read;
                    }
                    if (totalRead < rangeLength) {
                        buffer = java.util.Arrays.copyOf(buffer, totalRead);
                        actualEnd = start + totalRead - 1;
                    }
                }

                ByteArrayResource rangeResource = new ByteArrayResource(buffer);
                return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                        .header(HttpHeaders.CONTENT_TYPE, mediaType)
                        .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                        .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + actualEnd + "/" + contentLength)
                        .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(buffer.length))
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                        .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                        .header("X-Content-Type-Options", "nosniff")
                        .header("Content-Security-Policy", "frame-ancestors 'self' " + allowedOriginsCsp)
                        .body(rangeResource);
            } catch (Exception e) {
                // Fallback to full resource if range parsing fails
            }
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mediaType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "frame-ancestors 'self' " + allowedOriginsCsp)
                .body(resource);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadPublicFile(
            @PathVariable String id,
            @RequestParam(value = "title", required = false) String titleParam
    ) {
        StoredFile storedFile = fileStorageService.getFileMetadata(id);
        if (storedFile == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        boolean isStudyMaterial = !competitionStudyMaterialRepository.findByStoredFileId(id).isEmpty();
        boolean isAttemptAnswer = !attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(id, id).isEmpty();
        boolean isQuestionMedia = !assessmentQuestionRepository.findByMediaRefContaining(id).isEmpty();
        boolean isSyllabus = (competitionSyllabusRepository != null) && !competitionSyllabusRepository.findByStoredFileId(id).isEmpty();
        boolean isRestrictedExamResource = isStudyMaterial || isAttemptAnswer || isQuestionMedia || isSyllabus;

        if (!Boolean.TRUE.equals(storedFile.getIsPublic()) || isRestrictedExamResource) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String cat = storedFile.getCategory() != null ? storedFile.getCategory().toLowerCase() : "";
        if (cat.contains("notes") || cat.contains("worksheet") || cat.contains("assignment") || cat.contains("schedule")
                || cat.contains("study") || cat.contains("material") || cat.contains("question") || cat.contains("voice")
                || cat.contains("answer") || cat.contains("syllabus")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Resource resource = fileStorageService.loadFileAsResource(storedFile);
        if (resource == null || !resource.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        String competitionTitle = null;
        if (titleParam != null && !titleParam.isBlank()) {
            competitionTitle = titleParam.trim();
        } else {
            List<Competition> comps = competitionRepository.findByRulesPdfUrlContaining(id);
            if (!comps.isEmpty()) {
                competitionTitle = comps.get(0).getTitle();
            }
        }
        if (competitionTitle == null || competitionTitle.isBlank()) {
            competitionTitle = "competition";
        }

        String sanitizedTitle = competitionTitle.replaceAll("[^a-zA-Z0-9.-]", "_");
        String downloadFilename = sanitizedTitle + "-rules.pdf";

        ContentDisposition disposition = ContentDisposition.builder("attachment")
                .filename(downloadFilename, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> deleteFile(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        StoredFile storedFile = fileStorageService.getFileMetadata(id);
        String roleUpper = (currentUser != null && currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "");
        boolean isAdmin = roleUpper.equals("ADMIN") || roleUpper.equals("SUPER_ADMIN");
        boolean isOwner = currentUser != null && currentUser.getId() != null && currentUser.getId().equals(storedFile.getOwnerId());

        if (!isAdmin && !isOwner) {
            return ApiResponse.error("You do not have permission to delete this file");
        }

        fileStorageService.deleteFile(id);
        return ApiResponse.ok(null, "File deleted successfully");
    }
}
