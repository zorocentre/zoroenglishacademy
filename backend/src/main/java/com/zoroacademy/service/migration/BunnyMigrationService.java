package com.zoroacademy.service.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.dto.migration.*;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.FileStorageService;
import com.zoroacademy.service.storage.StorageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class BunnyMigrationService {

    private static final Logger log = LoggerFactory.getLogger(BunnyMigrationService.class);
    private static final Pattern UUID_PATTERN = Pattern.compile("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");

    private final StoredFileRepository storedFileRepository;
    private final StorageProvider storageProvider;
    private final VideoRepository videoRepository;
    private final CourseModuleRepository courseModuleRepository;
    private final AssessmentQuestionRepository assessmentQuestionRepository;
    private final CompetitionStudyMaterialRepository studyMaterialRepository;
    private final CompetitionSyllabusRepository syllabusRepository;
    private final CompetitionGuidanceVideoRepository guidanceVideoRepository;
    private final FeedbackMediaRepository feedbackMediaRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public BunnyMigrationService(
            StoredFileRepository storedFileRepository,
            StorageProvider storageProvider,
            VideoRepository videoRepository,
            CourseModuleRepository courseModuleRepository,
            @Autowired(required = false) AssessmentQuestionRepository assessmentQuestionRepository,
            @Autowired(required = false) CompetitionStudyMaterialRepository studyMaterialRepository,
            @Autowired(required = false) CompetitionSyllabusRepository syllabusRepository,
            @Autowired(required = false) CompetitionGuidanceVideoRepository guidanceVideoRepository,
            @Autowired(required = false) FeedbackMediaRepository feedbackMediaRepository
    ) {
        this.storedFileRepository = storedFileRepository;
        this.storageProvider = storageProvider;
        this.videoRepository = videoRepository;
        this.courseModuleRepository = courseModuleRepository;
        this.assessmentQuestionRepository = assessmentQuestionRepository;
        this.studyMaterialRepository = studyMaterialRepository;
        this.syllabusRepository = syllabusRepository;
        this.guidanceVideoRepository = guidanceVideoRepository;
        this.feedbackMediaRepository = feedbackMediaRepository;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Objective E.1: Generate a detailed Storage Migration Plan.
     * Analyzes existing stored files, verifies source presence, and computes checksum readiness.
     */
    public StorageMigrationPlanDto generateStorageMigrationPlan() {
        StorageMigrationPlanDto plan = new StorageMigrationPlanDto();
        List<StoredFile> allFiles = storedFileRepository.findAll();

        long totalSize = 0;
        long verifiedCount = 0;
        long missingSourceCount = 0;
        Map<String, Long> sizeByCategory = new LinkedHashMap<>();
        Map<String, Long> countByCategory = new LinkedHashMap<>();
        List<String> samplePaths = new ArrayList<>();

        for (StoredFile file : allFiles) {
            long size = file.getSizeBytes() != null ? file.getSizeBytes() : 0;
            totalSize += size;
            String cat = file.getCategory() != null ? file.getCategory() : "other";
            sizeByCategory.put(cat, sizeByCategory.getOrDefault(cat, 0L) + size);
            countByCategory.put(cat, countByCategory.getOrDefault(cat, 0L) + 1L);

            if (samplePaths.size() < 10 && file.getStoragePath() != null) {
                samplePaths.add(file.getStoragePath());
            }

            if (file.getStoragePath() != null && storageProvider.exists(file.getStoragePath())) {
                verifiedCount++;
            } else {
                missingSourceCount++;
            }
        }

        // Count unindexed media references across questions, study materials, and syllabus
        long unindexedCount = countUnindexedMediaReferences();

        plan.setTotalFiles(allFiles.size());
        plan.setTotalSizeBytes(totalSize);
        plan.setVerifiedFilesCount(verifiedCount);
        plan.setMissingSourceFilesCount(missingSourceCount);
        plan.setUnindexedMediaReferencesCount(unindexedCount);
        plan.setSizeByCategory(sizeByCategory);
        plan.setCategoryCounts(countByCategory);
        plan.setSampleStoragePaths(samplePaths);
        plan.setExecutionReady(allFiles.size() > 0);
        plan.setSourceStorageProvider(storageProvider.getClass().getSimpleName());

        return plan;
    }

    /**
     * Objective E.1: Execute or simulate Storage Migration to a new Bunny Storage zone.
     * Preserves filename, content type, category, visibility, and relative storage paths.
     */
    public StorageMigrationResultDto executeStorageMigration(
            boolean dryRun,
            String targetHost,
            String targetZone,
            String targetAccessKey,
            boolean verifyChecksum
    ) {
        StorageMigrationResultDto result = new StorageMigrationResultDto();
        result.setDryRun(dryRun);
        result.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        List<StoredFile> files = storedFileRepository.findAll();
        long totalProcessed = 0;
        long transferredCount = 0;
        long skippedCount = 0;
        long checksumVerifiedCount = 0;
        long failedCount = 0;
        List<String> failedFiles = new ArrayList<>();

        String effectiveHost = (targetHost != null && !targetHost.isBlank()) ? targetHost.trim() : "storage.bunnycdn.com";

        for (StoredFile file : files) {
            totalProcessed++;
            String path = file.getStoragePath();
            if (path == null || path.isBlank()) {
                skippedCount++;
                continue;
            }

            try {
                // Step 1: Read source file from existing storage provider
                Resource resource = storageProvider.loadAsResource(path);
                if (resource == null || !resource.exists()) {
                    failedCount++;
                    failedFiles.add(path + " (source object missing)");
                    continue;
                }

                byte[] data;
                try (InputStream in = resource.getInputStream()) {
                    data = in.readAllBytes();
                }

                // Step 2: Compute source file SHA-256 and size
                String sourceHash = FileStorageService.computeSha256(data);
                if (verifyChecksum && file.getSha256Hash() != null && !file.getSha256Hash().isBlank()) {
                    if (sourceHash.equalsIgnoreCase(file.getSha256Hash())) {
                        checksumVerifiedCount++;
                    } else {
                        log.warn("Source checksum mismatch for file {}: record={}, computed={}", file.getId(), file.getSha256Hash(), sourceHash);
                    }
                }

                if (!dryRun) {
                    if (targetZone == null || targetZone.isBlank() || targetAccessKey == null || targetAccessKey.isBlank()) {
                        throw new IllegalArgumentException("Target storage zone and access key are required for live migration execution.");
                    }

                    String cleanPath = path.startsWith("/") ? path.substring(1) : path;
                    String targetUrl = "https://" + effectiveHost + "/" + targetZone.trim() + "/" + cleanPath;

                    HttpHeaders authHeaders = new HttpHeaders();
                    authHeaders.set("AccessKey", targetAccessKey.trim());

                    // Step 3 & 4: Check if destination object already exists and compare checksum
                    boolean skipUpload = false;
                    try {
                        ResponseEntity<byte[]> existingDest = restTemplate.exchange(targetUrl, HttpMethod.GET, new HttpEntity<>(authHeaders), byte[].class);
                        if (existingDest.getStatusCode().is2xxSuccessful() && existingDest.getBody() != null) {
                            String destHash = FileStorageService.computeSha256(existingDest.getBody());
                            if (destHash.equalsIgnoreCase(sourceHash)) {
                                skippedCount++;
                                checksumVerifiedCount++;
                                skipUpload = true;
                                log.info("File {} already exists at destination with matching checksum; skipping upload", path);
                            } else {
                                failedCount++;
                                failedFiles.add(path + " (conflict: destination object exists with mismatched checksum)");
                                continue;
                            }
                        }
                    } catch (Exception ignored) {
                        // 404 Not Found is expected when destination does not exist yet
                    }

                    if (skipUpload) {
                        continue;
                    }

                    // Step 5: Upload file to new Bunny Storage zone
                    HttpHeaders uploadHeaders = new HttpHeaders();
                    uploadHeaders.set("AccessKey", targetAccessKey.trim());
                    String ct = file.getContentType() != null ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
                    uploadHeaders.setContentType(MediaType.parseMediaType(ct));

                    HttpEntity<byte[]> uploadEntity = new HttpEntity<>(data, uploadHeaders);
                    ResponseEntity<String> uploadResponse = restTemplate.exchange(targetUrl, HttpMethod.PUT, uploadEntity, String.class);

                    if (!uploadResponse.getStatusCode().is2xxSuccessful()) {
                        failedCount++;
                        failedFiles.add(path + " (upload HTTP " + uploadResponse.getStatusCode().value() + ")");
                        continue;
                    }

                    // Step 6: Verify destination object after upload (fetch & checksum)
                    try {
                        ResponseEntity<byte[]> verifyResponse = restTemplate.exchange(targetUrl, HttpMethod.GET, new HttpEntity<>(authHeaders), byte[].class);
                        if (verifyResponse.getStatusCode().is2xxSuccessful() && verifyResponse.getBody() != null) {
                            String uploadedHash = FileStorageService.computeSha256(verifyResponse.getBody());
                            if (uploadedHash.equalsIgnoreCase(sourceHash)) {
                                transferredCount++;
                                checksumVerifiedCount++;
                                log.info("Successfully uploaded and verified checksum for file: {}", path);
                            } else {
                                // Checksum mismatch: Rollback corrupted destination object
                                try {
                                    restTemplate.exchange(targetUrl, HttpMethod.DELETE, new HttpEntity<>(authHeaders), Void.class);
                                    log.warn("Corrupted destination object deleted (rollback) for file: {}", path);
                                } catch (Exception delEx) {
                                    log.error("Failed to delete corrupted destination file {}: {}", path, sanitizeErrorMessage(delEx.getMessage(), targetAccessKey));
                                }
                                failedCount++;
                                failedFiles.add(path + " (checksum mismatch after upload - destination rolled back)");
                            }
                        } else {
                            failedCount++;
                            failedFiles.add(path + " (verification fetch failed after upload)");
                        }
                    } catch (Exception verifyEx) {
                        failedCount++;
                        failedFiles.add(path + " (verification error: " + sanitizeErrorMessage(verifyEx.getMessage(), targetAccessKey) + ")");
                    }
                } else {
                    transferredCount++; // Simulated transfer in dry-run
                }

            } catch (Exception e) {
                failedCount++;
                failedFiles.add(path + " (" + sanitizeErrorMessage(e.getMessage(), targetAccessKey) + ")");
            }
        }

        result.setTotalProcessed(totalProcessed);
        result.setTransferredCount(transferredCount);
        result.setSkippedExistingCount(skippedCount);
        result.setChecksumVerifiedCount(checksumVerifiedCount);
        result.setFailedCount(failedCount);
        result.setFailedFiles(failedFiles);

        String summary = String.format("%s completed: %d files processed, %d %s, %d skipped existing, %d checksums verified, %d failed.",
                dryRun ? "Storage migration dry-run simulation" : "Storage migration live execution",
                totalProcessed,
                transferredCount,
                dryRun ? "would be uploaded to new zone" : "successfully uploaded and verified",
                skippedCount,
                checksumVerifiedCount,
                failedCount);
        result.setReconciliationSummary(summary);

        return result;
    }

    /**
     * Objective E.2: Generate a detailed Stream Migration Plan.
     */
    public StreamMigrationPlanDto generateStreamMigrationPlan() {
        StreamMigrationPlanDto plan = new StreamMigrationPlanDto();

        List<Video> courseVideos = videoRepository.findAll();
        List<String> guids = new ArrayList<>();
        List<String> titles = new ArrayList<>();

        for (Video v : courseVideos) {
            if (v.getBunnyVideoId() != null) {
                guids.add(v.getBunnyVideoId());
                if (titles.size() < 10) {
                    titles.add("Course Video: " + (v.getTitle() != null ? v.getTitle() : v.getBunnyVideoId()));
                }
            }
        }

        long guidanceCount = 0;
        if (guidanceVideoRepository != null) {
            List<CompetitionGuidanceVideo> gvs = guidanceVideoRepository.findAll();
            guidanceCount = gvs.size();
            for (CompetitionGuidanceVideo gv : gvs) {
                if (gv.getBunnyVideoId() != null && !guids.contains(gv.getBunnyVideoId())) {
                    guids.add(gv.getBunnyVideoId());
                    if (titles.size() < 10) {
                        titles.add("Guidance Video: " + gv.getTitle());
                    }
                }
            }
        }

        long feedbackCount = 0;
        if (feedbackMediaRepository != null) {
            List<FeedbackMedia> fms = feedbackMediaRepository.findAll().stream()
                    .filter(fm -> "VIDEO".equalsIgnoreCase(fm.getMediaType()))
                    .toList();
            feedbackCount = fms.size();
            for (FeedbackMedia fm : fms) {
                if (fm.getBunnyVideoId() != null && !guids.contains(fm.getBunnyVideoId())) {
                    guids.add(fm.getBunnyVideoId());
                }
            }
        }

        plan.setTotalVideos(guids.size());
        plan.setCourseVideosCount(courseVideos.size());
        plan.setGuidanceVideosCount(guidanceCount);
        plan.setFeedbackVideosCount(feedbackCount);
        plan.setExistingVideoGuids(guids);
        plan.setSampleVideoTitles(titles);

        return plan;
    }

    /**
     * Objective E.2: Execute or simulate Stream Video ID Remapping in Database.
     * Takes an old-to-new GUID mapping table and safely updates database entities.
     */
    @Transactional
    public StreamMigrationResultDto executeStreamMigration(
            boolean dryRun,
            Map<String, String> oldToNewVideoIdMap
    ) {
        StreamMigrationResultDto result = new StreamMigrationResultDto();
        result.setDryRun(dryRun);
        result.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        result.setIdMappingTable(oldToNewVideoIdMap != null ? oldToNewVideoIdMap : new HashMap<>());

        if (oldToNewVideoIdMap == null || oldToNewVideoIdMap.isEmpty()) {
            result.setReconciliationSummary("No video ID mappings provided. Migration skipped.");
            return result;
        }

        // Section 8: Validate old and new GUIDs format (UUID regex). Reject invalid GUIDs before making changes.
        for (Map.Entry<String, String> entry : oldToNewVideoIdMap.entrySet()) {
            String oldId = entry.getKey();
            String newId = entry.getValue();
            if (oldId == null || !UUID_PATTERN.matcher(oldId.trim()).matches()
                    || newId == null || !UUID_PATTERN.matcher(newId.trim()).matches()) {
                result.setFailedCount(oldToNewVideoIdMap.size());
                result.setReconciliationSummary("Validation failed: All old and new video IDs must be valid GUID/UUID formats. Operation aborted before partial DB updates.");
                return result;
            }
        }

        long updatedCourses = 0;
        long updatedGuidance = 0;
        long updatedFeedback = 0;
        long failed = 0;

        for (Map.Entry<String, String> entry : oldToNewVideoIdMap.entrySet()) {
            String oldId = entry.getKey().trim();
            String newId = entry.getValue().trim();

            try {
                // 1. Update Video entities
                List<Video> vList = videoRepository.findByBunnyVideoId(oldId).stream().toList();
                for (Video v : vList) {
                    if (!dryRun) {
                        v.setBunnyVideoId(newId);
                        v.setStorageKey("bunny_" + newId);
                        videoRepository.save(v);
                    }
                    updatedCourseVideosCountIncrement();
                    updatedCourses++;
                }

                // 2. Update Course Modules video_storage_ref
                List<CourseModule> modules = courseModuleRepository.findAll();
                for (CourseModule mod : modules) {
                    String ref = mod.getVideoStorageRef();
                    if (ref != null && ref.contains(oldId)) {
                        if (!dryRun) {
                            String updatedRef = ref.replace(oldId, newId);
                            mod.setVideoStorageRef(updatedRef);
                            courseModuleRepository.save(mod);
                        }
                    }
                }

                // 3. Update Competition Guidance Videos
                if (guidanceVideoRepository != null) {
                    List<CompetitionGuidanceVideo> gvList = guidanceVideoRepository.findAll();
                    for (CompetitionGuidanceVideo gv : gvList) {
                        if (oldId.equals(gv.getBunnyVideoId())) {
                            if (!dryRun) {
                                gv.setBunnyVideoId(newId);
                                if (gv.getEmbedUrl() != null) gv.setEmbedUrl(gv.getEmbedUrl().replace(oldId, newId));
                                if (gv.getPlaybackUrl() != null) gv.setPlaybackUrl(gv.getPlaybackUrl().replace(oldId, newId));
                                guidanceVideoRepository.save(gv);
                            }
                            updatedGuidance++;
                        }
                    }
                }

                // 4. Update Feedback Media
                if (feedbackMediaRepository != null) {
                    List<FeedbackMedia> fmList = feedbackMediaRepository.findAll();
                    for (FeedbackMedia fm : fmList) {
                        if (oldId.equals(fm.getBunnyVideoId())) {
                            if (!dryRun) {
                                fm.setBunnyVideoId(newId);
                                if (fm.getUrl() != null) fm.setUrl(fm.getUrl().replace(oldId, newId));
                                feedbackMediaRepository.save(fm);
                            }
                            updatedFeedback++;
                        }
                    }
                }

            } catch (Exception e) {
                log.error("Failed to remap video ID {} -> {}: {}", oldId, newId, e.getMessage());
                failed++;
            }
        }

        result.setTotalProcessed(oldToNewVideoIdMap.size());
        result.setUpdatedCourseVideosCount(updatedCourses);
        result.setUpdatedGuidanceVideosCount(updatedGuidance);
        result.setUpdatedFeedbackVideosCount(updatedFeedback);
        result.setFailedCount(failed);

        String summary = String.format("%s completed: %d mappings processed (%d course videos, %d guidance videos, %d feedback videos updated, %d failed). "
                        + "[NOTICE: Video remapping updates database references only. Physical video files must be transferred via Bunny Stream API/Dashboard].",
                dryRun ? "Stream video remapping simulation" : "Stream video remapping live execution",
                oldToNewVideoIdMap.size(), updatedCourses, updatedGuidance, updatedFeedback, failed);
        result.setReconciliationSummary(summary);

        return result;
    }

    private void updatedCourseVideosCountIncrement() {}

    /**
     * Objective E & Incident Recovery: Discovers unindexed media references and restores
     * missing stored_files records if the physical object is verified on storage/disk.
     */
    @Transactional
    public MetadataRecoveryResultDto recoverUnindexedMediaMetadata(boolean dryRun) {
        MetadataRecoveryResultDto result = new MetadataRecoveryResultDto();
        result.setDryRun(dryRun);
        result.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        Map<String, UnindexedCandidate> candidates = new LinkedHashMap<>();

        // 1. Collect from Assessment Questions (category: question-media, public)
        if (assessmentQuestionRepository != null) {
            for (AssessmentQuestion q : assessmentQuestionRepository.findAll()) {
                String ref = q.getMediaRef();
                if (ref != null && !ref.isBlank() && !ref.startsWith("http://") && !ref.startsWith("https://")) {
                    Matcher m = UUID_PATTERN.matcher(ref);
                    if (m.find()) {
                        String id = m.group(1);
                        candidates.put(id, new UnindexedCandidate(id, "question-media", ref, true));
                    }
                }
            }
        }

        // 2. Collect from Study Materials (category: study-material, private)
        if (studyMaterialRepository != null) {
            for (CompetitionStudyMaterial sm : studyMaterialRepository.findAll()) {
                if (sm.getStoredFileId() != null && !sm.getStoredFileId().isBlank()) {
                    String id = sm.getStoredFileId().trim();
                    candidates.put(id, new UnindexedCandidate(id, "study-material", id, false));
                }
            }
        }

        // 3. Collect from Syllabus (category: syllabus, public)
        if (syllabusRepository != null) {
            for (CompetitionSyllabus s : syllabusRepository.findAll()) {
                if (s.getStoredFileId() != null && !s.getStoredFileId().isBlank()) {
                    String id = s.getStoredFileId().trim();
                    candidates.put(id, new UnindexedCandidate(id, "syllabus", id, true));
                }
            }
        }

        long scanned = candidates.size();
        long recovered = 0;
        long unrecoverable = 0;
        List<String> recoveredList = new ArrayList<>();
        List<String> unrecoverableList = new ArrayList<>();

        for (UnindexedCandidate candidate : candidates.values()) {
            String fileId = candidate.fileId;
            if (storedFileRepository.existsById(fileId)) {
                continue; // Already has stored_files record
            }

            // Check authoritative paths derived from entity context
            String foundPath = null;
            byte[] fileBytes = null;

            if (candidate.rawRef != null && (candidate.rawRef.startsWith("public/") || candidate.rawRef.startsWith("private/"))) {
                if (storageProvider.exists(candidate.rawRef)) {
                    foundPath = candidate.rawRef;
                }
            }

            if (foundPath == null) {
                String prefix = candidate.isPublic ? "public/" : "private/";
                String canonicalPath = prefix + candidate.category + "/" + fileId;

                if (storageProvider.exists(canonicalPath)) {
                    foundPath = canonicalPath;
                } else if (candidate.rawRef != null && candidate.rawRef.contains(".")) {
                    String ext = candidate.rawRef.substring(candidate.rawRef.lastIndexOf('.') + 1);
                    String pathWithExt = canonicalPath + "." + ext;
                    if (storageProvider.exists(pathWithExt)) {
                        foundPath = pathWithExt;
                    }
                }
            }

            if (foundPath != null) {
                try {
                    Resource res = storageProvider.loadAsResource(foundPath);
                    if (res != null && res.exists()) {
                        try (InputStream in = res.getInputStream()) {
                            fileBytes = in.readAllBytes();
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (foundPath != null && fileBytes != null && fileBytes.length > 0) {
                recovered++;
                recoveredList.add(fileId + " -> " + foundPath + " (" + fileBytes.length + " bytes, category: " + candidate.category + ")");

                if (!dryRun) {
                    String ext = "";
                    int dot = foundPath.lastIndexOf('.');
                    if (dot > 0) ext = foundPath.substring(dot + 1).toLowerCase();

                    String contentType = detectMimeType(fileBytes, foundPath);
                    String sha256 = FileStorageService.computeSha256(fileBytes);
                    boolean isPublic = foundPath.startsWith("public/") || candidate.isPublic;

                    StoredFile sf = new StoredFile(
                            fileId,
                            "recovered_" + fileId + (ext.isEmpty() ? "" : "." + ext),
                            contentType,
                            (long) fileBytes.length,
                            candidate.category,
                            "admin",
                            foundPath,
                            isPublic,
                            sha256,
                            1
                    );
                    storedFileRepository.save(sf);
                    log.info("Successfully recovered stored_files record for id={}: path={}, category={}", fileId, foundPath, candidate.category);
                }
            } else {
                unrecoverable++;
                unrecoverableList.add(fileId + " (physical object not found on storage or disk for category: " + candidate.category + ")");
            }
        }

        result.setUnindexedReferencesScanned(scanned);
        result.setRecoveredCount(recovered);
        result.setRecoveredFiles(recoveredList);
        result.setUnrecoverableCount(unrecoverable);
        result.setUnrecoverableReferences(unrecoverableList);

        String summary = String.format("%s completed: %d unindexed references inspected, %d %s, %d physical assets missing.",
                dryRun ? "Metadata recovery scan (dry-run)" : "Metadata recovery execution",
                scanned,
                recovered,
                dryRun ? "verified physically and ready for recovery" : "recovered into stored_files",
                unrecoverable);
        result.setSummary(summary);

        return result;
    }

    private long countUnindexedMediaReferences() {
        long count = 0;
        if (assessmentQuestionRepository != null) {
            for (AssessmentQuestion q : assessmentQuestionRepository.findAll()) {
                String ref = q.getMediaRef();
                if (ref != null && !ref.isBlank() && !ref.startsWith("http")) {
                    Matcher m = UUID_PATTERN.matcher(ref);
                    if (m.find() && !storedFileRepository.existsById(m.group(1))) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    private String determineContentType(String ext) {
        if ("png".equals(ext)) return "image/png";
        if ("jpg".equals(ext) || "jpeg".equals(ext)) return "image/jpeg";
        if ("webp".equals(ext)) return "image/webp";
        if ("pdf".equals(ext)) return "application/pdf";
        if ("mp3".equals(ext)) return "audio/mpeg";
        if ("wav".equals(ext)) return "audio/wav";
        if ("mp4".equals(ext)) return "video/mp4";
        return "application/octet-stream";
    }

    private String detectMimeType(byte[] data, String path) {
        if (data != null && data.length >= 4) {
            if (data[0] == (byte) 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47) return "image/png";
            if (data[0] == (byte) 0xFF && data[1] == (byte) 0xD8 && data[2] == (byte) 0xFF) return "image/jpeg";
            if (data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46) return "application/pdf";
            if (data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x38) return "image/gif";
            if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') return "image/webp";
            if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' && data[8] == 'W' && data[9] == 'A' && data[10] == 'V' && data[11] == 'E') return "audio/wav";
            if (data[0] == 'I' && data[1] == 'D' && data[2] == '3') return "audio/mpeg";
        }
        if (path != null && path.contains(".")) {
            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            return determineContentType(ext);
        }
        return "application/octet-stream";
    }

    private static class UnindexedCandidate {
        final String fileId;
        final String category;
        final String rawRef;
        final boolean isPublic;

        UnindexedCandidate(String fileId, String category, String rawRef, boolean isPublic) {
            this.fileId = fileId;
            this.category = category;
            this.rawRef = rawRef;
            this.isPublic = isPublic;
        }
    }

    private String sanitizeErrorMessage(String msg, String secret) {
        if (msg == null) return "Unknown error";
        if (secret != null && !secret.isBlank()) {
            return msg.replace(secret, "[REDACTED]");
        }
        return msg;
    }
}
