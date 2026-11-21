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

                if (verifyChecksum && file.getSha256Hash() != null && !file.getSha256Hash().isBlank()) {
                    String actualHash = FileStorageService.computeSha256(data);
                    if (actualHash.equalsIgnoreCase(file.getSha256Hash())) {
                        checksumVerifiedCount++;
                    } else {
                        log.warn("Checksum mismatch for file {}: expected {}, computed {}", file.getId(), file.getSha256Hash(), actualHash);
                    }
                }

                if (!dryRun) {
                    if (targetZone == null || targetZone.isBlank() || targetAccessKey == null || targetAccessKey.isBlank()) {
                        throw new IllegalArgumentException("Target storage zone and access key are required for live migration execution.");
                    }

                    String cleanPath = path.startsWith("/") ? path.substring(1) : path;
                    String targetUrl = "https://" + effectiveHost + "/" + targetZone.trim() + "/" + cleanPath;

                    HttpHeaders headers = new HttpHeaders();
                    headers.set("AccessKey", targetAccessKey.trim());
                    String ct = file.getContentType() != null ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
                    headers.setContentType(MediaType.parseMediaType(ct));

                    HttpEntity<byte[]> requestEntity = new HttpEntity<>(data, headers);
                    ResponseEntity<String> response = restTemplate.exchange(targetUrl, HttpMethod.PUT, requestEntity, String.class);

                    if (response.getStatusCode().is2xxSuccessful()) {
                        transferredCount++;
                    } else {
                        failedCount++;
                        failedFiles.add(path + " (HTTP " + response.getStatusCode().value() + ")");
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

        String summary = String.format("%s completed: %d files processed, %d %s, %d checksums verified, %d failed.",
                dryRun ? "Storage migration dry-run simulation" : "Storage migration live execution",
                totalProcessed,
                transferredCount,
                dryRun ? "would be uploaded to new zone" : "successfully uploaded",
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

        long updatedCourses = 0;
        long updatedGuidance = 0;
        long updatedFeedback = 0;
        long failed = 0;

        for (Map.Entry<String, String> entry : oldToNewVideoIdMap.entrySet()) {
            String oldId = entry.getKey();
            String newId = entry.getValue();

            if (oldId == null || newId == null || oldId.isBlank() || newId.isBlank()) {
                failed++;
                continue;
            }

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

        String summary = String.format("%s completed: %d mappings processed (%d course videos, %d guidance videos, %d feedback videos updated, %d failed).",
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

        Set<String> candidateIds = new LinkedHashSet<>();

        // 1. Collect from Assessment Questions
        if (assessmentQuestionRepository != null) {
            for (AssessmentQuestion q : assessmentQuestionRepository.findAll()) {
                String ref = q.getMediaRef();
                if (ref != null && !ref.isBlank() && !ref.startsWith("http://") && !ref.startsWith("https://")) {
                    Matcher m = UUID_PATTERN.matcher(ref);
                    if (m.find()) {
                        candidateIds.add(m.group(1));
                    }
                }
            }
        }

        // 2. Collect from Study Materials
        if (studyMaterialRepository != null) {
            for (CompetitionStudyMaterial sm : studyMaterialRepository.findAll()) {
                if (sm.getStoredFileId() != null && !sm.getStoredFileId().isBlank()) {
                    candidateIds.add(sm.getStoredFileId().trim());
                }
            }
        }

        // 3. Collect from Syllabus
        if (syllabusRepository != null) {
            for (CompetitionSyllabus s : syllabusRepository.findAll()) {
                if (s.getStoredFileId() != null && !s.getStoredFileId().isBlank()) {
                    candidateIds.add(s.getStoredFileId().trim());
                }
            }
        }

        long scanned = candidateIds.size();
        long recovered = 0;
        long unrecoverable = 0;
        List<String> recoveredList = new ArrayList<>();
        List<String> unrecoverableList = new ArrayList<>();

        List<String> extensionsToTry = List.of("png", "jpg", "jpeg", "webp", "pdf", "mp3", "wav", "mp4", "");
        List<String> categoriesToTry = List.of("question-media", "public-document", "document", "audio", "competition", "image");

        for (String fileId : candidateIds) {
            if (storedFileRepository.existsById(fileId)) {
                continue; // Already has stored_files record
            }

            // Search for existing physical asset on storage or disk
            String foundPath = null;
            byte[] fileBytes = null;

            for (String cat : categoriesToTry) {
                for (String ext : extensionsToTry) {
                    String subPath = ext.isEmpty() ? fileId : fileId + "." + ext;
                    String testPathPublic = "public/" + cat + "/" + subPath;
                    String testPathPrivate = "private/" + cat + "/" + subPath;

                    if (storageProvider.exists(testPathPublic)) {
                        foundPath = testPathPublic;
                        break;
                    } else if (storageProvider.exists(testPathPrivate)) {
                        foundPath = testPathPrivate;
                        break;
                    }
                }
                if (foundPath != null) break;
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
                recoveredList.add(fileId + " -> " + foundPath + " (" + fileBytes.length + " bytes)");

                if (!dryRun) {
                    String ext = "";
                    int dot = foundPath.lastIndexOf('.');
                    if (dot > 0) ext = foundPath.substring(dot + 1).toLowerCase();

                    String contentType = determineContentType(ext);
                    String sha256 = FileStorageService.computeSha256(fileBytes);
                    boolean isPublic = foundPath.startsWith("public/");

                    StoredFile sf = new StoredFile(
                            fileId,
                            "recovered_" + fileId + (ext.isEmpty() ? "" : "." + ext),
                            contentType,
                            (long) fileBytes.length,
                            "question-media",
                            "admin",
                            foundPath,
                            isPublic,
                            sha256,
                            1
                    );
                    storedFileRepository.save(sf);
                    log.info("Successfully recovered stored_files record for id={}: path={}", fileId, foundPath);
                }
            } else {
                unrecoverable++;
                unrecoverableList.add(fileId + " (physical object not found on storage or disk)");
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

    private String sanitizeErrorMessage(String msg, String secret) {
        if (msg == null) return "Unknown error";
        if (secret != null && !secret.isBlank()) {
            return msg.replace(secret, "[REDACTED]");
        }
        return msg;
    }
}
