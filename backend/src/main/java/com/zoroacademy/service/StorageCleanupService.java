package com.zoroacademy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.dto.StorageMetricsDto;
import com.zoroacademy.entity.AssignmentSubmission;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.entity.SystemSetting;
import com.zoroacademy.entity.Video;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.storage.StorageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class StorageCleanupService {

    private static final Logger log = LoggerFactory.getLogger(StorageCleanupService.class);
    private static final Pattern UUID_PATTERN = Pattern.compile("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");

    private final StoredFileRepository storedFileRepository;
    private final StorageProvider storageProvider;
    private final FileStorageService fileStorageService;
    private final CourseRepository courseRepository;
    private final CourseModuleRepository courseModuleRepository;
    private final ScheduleRepository scheduleRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final CompetitionRepository competitionRepository;
    private final WebsiteSettingsRepository websiteSettingsRepository;
    private final VideoRepository videoRepository;
    private final BunnyStreamService bunnyStreamService;
    private final SystemSettingRepository systemSettingRepository;
    private final HeroImageRepository heroImageRepository;
    private final FeedbackMediaRepository feedbackMediaRepository;

    // Full Application Media Repositories (Objective A & C)
    private final AssessmentQuestionRepository assessmentQuestionRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final CompetitionStudyMaterialRepository competitionStudyMaterialRepository;
    private final CompetitionSyllabusRepository competitionSyllabusRepository;
    private final CompetitionGuidanceVideoRepository guidanceVideoRepository;
    private final CourseResourceRepository courseResourceRepository;
    private final ExpenseRepository expenseRepository;
    private final CompetitionRegistrationRepository registrationRepository;
    private final CompetitionModuleRepository competitionModuleRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicBoolean isCleanupRunning = new AtomicBoolean(false);

    // Objective C: Permanent safe defaults
    @Value("${storage.cleanup.enabled:false}")
    private boolean cleanupEnabled;

    @Value("${storage.cleanup.dry-run:true}")
    private boolean dryRunDefault;

    @Value("${storage.cleanup.orphan-retention-hours:168}")
    private int defaultCutoffHours;

    @Value("${storage.cleanup.live-purge-allowed:false}")
    private boolean livePurgeAllowed;

    private volatile OffsetDateTime lastCleanupTimestamp = null;
    private volatile CleanupResultDto lastCleanupResult = null;

    @Autowired
    public StorageCleanupService(
            StoredFileRepository storedFileRepository,
            StorageProvider storageProvider,
            FileStorageService fileStorageService,
            CourseRepository courseRepository,
            CourseModuleRepository courseModuleRepository,
            ScheduleRepository scheduleRepository,
            AssignmentRepository assignmentRepository,
            AssignmentSubmissionRepository submissionRepository,
            UserRepository userRepository,
            CompetitionRepository competitionRepository,
            WebsiteSettingsRepository websiteSettingsRepository,
            VideoRepository videoRepository,
            BunnyStreamService bunnyStreamService,
            SystemSettingRepository systemSettingRepository,
            @Autowired(required = false) HeroImageRepository heroImageRepository,
            @Autowired(required = false) FeedbackMediaRepository feedbackMediaRepository,
            @Autowired(required = false) AssessmentQuestionRepository assessmentQuestionRepository,
            @Autowired(required = false) AttemptAnswerRepository attemptAnswerRepository,
            @Autowired(required = false) CompetitionStudyMaterialRepository competitionStudyMaterialRepository,
            @Autowired(required = false) CompetitionSyllabusRepository competitionSyllabusRepository,
            @Autowired(required = false) CompetitionGuidanceVideoRepository guidanceVideoRepository,
            @Autowired(required = false) CourseResourceRepository courseResourceRepository,
            @Autowired(required = false) ExpenseRepository expenseRepository,
            @Autowired(required = false) CompetitionRegistrationRepository registrationRepository,
            @Autowired(required = false) CompetitionModuleRepository competitionModuleRepository
    ) {
        this.storedFileRepository = storedFileRepository;
        this.storageProvider = storageProvider;
        this.fileStorageService = fileStorageService;
        this.courseRepository = courseRepository;
        this.courseModuleRepository = courseModuleRepository;
        this.scheduleRepository = scheduleRepository;
        this.assignmentRepository = assignmentRepository;
        this.submissionRepository = submissionRepository;
        this.userRepository = userRepository;
        this.competitionRepository = competitionRepository;
        this.websiteSettingsRepository = websiteSettingsRepository;
        this.videoRepository = videoRepository;
        this.bunnyStreamService = bunnyStreamService;
        this.systemSettingRepository = systemSettingRepository;
        this.heroImageRepository = heroImageRepository;
        this.feedbackMediaRepository = feedbackMediaRepository;
        this.assessmentQuestionRepository = assessmentQuestionRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.competitionStudyMaterialRepository = competitionStudyMaterialRepository;
        this.competitionSyllabusRepository = competitionSyllabusRepository;
        this.guidanceVideoRepository = guidanceVideoRepository;
        this.courseResourceRepository = courseResourceRepository;
        this.expenseRepository = expenseRepository;
        this.registrationRepository = registrationRepository;
        this.competitionModuleRepository = competitionModuleRepository;
    }

    // Overloaded backwards-compatible constructor for existing tests
    public StorageCleanupService(
            StoredFileRepository storedFileRepository,
            StorageProvider storageProvider,
            FileStorageService fileStorageService,
            CourseRepository courseRepository,
            CourseModuleRepository courseModuleRepository,
            ScheduleRepository scheduleRepository,
            AssignmentRepository assignmentRepository,
            AssignmentSubmissionRepository submissionRepository,
            UserRepository userRepository,
            CompetitionRepository competitionRepository,
            WebsiteSettingsRepository websiteSettingsRepository,
            VideoRepository videoRepository,
            BunnyStreamService bunnyStreamService,
            SystemSettingRepository systemSettingRepository,
            HeroImageRepository heroImageRepository,
            FeedbackMediaRepository feedbackMediaRepository
    ) {
        this(storedFileRepository, storageProvider, fileStorageService,
                courseRepository, courseModuleRepository, scheduleRepository,
                assignmentRepository, submissionRepository, userRepository,
                competitionRepository, websiteSettingsRepository, videoRepository,
                bunnyStreamService, systemSettingRepository, heroImageRepository,
                feedbackMediaRepository, null, null, null, null, null, null, null, null, null);
    }

    @Scheduled(cron = "${storage.cleanup.cron:0 0 2 * * ?}")
    public void scheduledCleanup() {
        if (!cleanupEnabled) {
            log.info("Storage cleanup job is disabled by configuration (storage.cleanup.enabled=false).");
            return;
        }
        log.info("Executing scheduled storage cleanup job (dryRun={}, retentionHours={})...", dryRunDefault, defaultCutoffHours);
        try {
            CleanupResultDto result = runCleanup(dryRunDefault, defaultCutoffHours, false);
            log.info("Scheduled storage cleanup completed: {}", result.getMessage());
        } catch (Exception e) {
            log.error("Error during scheduled storage cleanup: {}", e.getMessage(), e);
        }
    }

    public CleanupResultDto runCleanup(boolean dryRun) {
        return runCleanup(dryRun, defaultCutoffHours, false);
    }

    public CleanupResultDto runCleanup(boolean dryRun, int cutoffHours) {
        return runCleanup(dryRun, cutoffHours, false);
    }

    /**
     * Executes storage cleanup with full operational protection and audit logging.
     * Enforces concurrency locking, reference checking, and separate Bunny Storage / Stream handling.
     */
    public CleanupResultDto runCleanup(boolean dryRun, int cutoffHours, boolean confirmPermanentDelete) {
        // Concurrency guard: prevent overlapping runs (Objective C)
        if (!isCleanupRunning.compareAndSet(false, true)) {
            log.warn("Cleanup job rejected: another cleanup run is currently in progress.");
            CleanupResultDto busyResult = new CleanupResultDto();
            busyResult.setDryRun(dryRun);
            busyResult.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            busyResult.setMessage("A cleanup execution is already in progress. Please wait for it to complete.");
            return busyResult;
        }

        try {
            return doRunCleanup(dryRun, cutoffHours, confirmPermanentDelete);
        } finally {
            isCleanupRunning.set(false);
        }
    }

    private CleanupResultDto doRunCleanup(boolean requestedDryRun, int cutoffHours, boolean confirmPermanentDelete) {
        CleanupResultDto result = new CleanupResultDto();
        result.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        // Permanent Safety Enforcement (Objective C):
        // Physical deletion is strictly disallowed unless:
        // 1. requestedDryRun == false AND
        // 2. confirmPermanentDelete == true AND
        // 3. livePurgeAllowed == true
        boolean effectiveDryRun = requestedDryRun;
        boolean requiresOptIn = false;

        if (!requestedDryRun) {
            if (!confirmPermanentDelete || !livePurgeAllowed) {
                log.warn("Live cleanup requested but requires explicit confirmation (confirmPermanentDelete=true) "
                        + "and configuration allowance (storage.cleanup.live-purge-allowed=true). Forcing dry-run mode.");
                effectiveDryRun = true;
                requiresOptIn = true;
            }
        }

        result.setDryRun(effectiveDryRun);
        result.setRequiresOptIn(requiresOptIn);
        result.setLivePurgeAllowed(livePurgeAllowed);

        // 1. Collect references for Bunny Storage and Bunny Stream separately (Objective B)
        Set<String> referencedStorageItems = collectAllReferencedStorageItems();
        Set<String> referencedStreamVideoIds = collectAllReferencedStreamVideoIds();

        result.setTotalReferenced(referencedStorageItems.size() + referencedStreamVideoIds.size());

        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(Math.max(1, cutoffHours));

        long totalScanned = 0;
        long skippedRecent = 0;
        long skippedActiveRef = 0;
        long skippedUncertain = 0;
        long orphanedFilesFound = 0;
        long orphanedFilesDeleted = 0;
        long failedDeletions = 0;
        long bytesReclaimed = 0;
        List<String> failureReasons = new ArrayList<>();

        // 2. Evaluate StoredFile records (Bunny Storage)
        List<StoredFile> allFiles = storedFileRepository.findAll();
        totalScanned = allFiles.size();

        // Index in-memory path counts and active storage paths to protect shared paths without N+1 queries
        Map<String, Long> pathCounts = allFiles.stream()
                .map(StoredFile::getStoragePath)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.groupingBy(p -> p, java.util.stream.Collectors.counting()));

        Set<String> referencedStoragePaths = allFiles.stream()
                .filter(f -> isFileReferenced(f, referencedStorageItems))
                .map(StoredFile::getStoragePath)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        for (StoredFile file : allFiles) {
            // Check file age
            if (file.getCreatedAt() != null && file.getCreatedAt().isAfter(cutoff)) {
                skippedRecent++;
                continue;
            }

            // Check if referenced across any application entity
            boolean isReferenced = isFileReferenced(file, referencedStorageItems);

            String storagePath = file.getStoragePath();

            // If the file itself is referenced, or shares a storage_path with any referenced file -> PROTECT
            if (isReferenced || (storagePath != null && referencedStoragePaths.contains(storagePath))) {
                skippedActiveRef++;
                continue;
            }

            // Multiple stored_files rows share the same physical path -> DO NOT PURGE
            if (storagePath != null && (pathCounts.getOrDefault(storagePath, 0L) > 1 || storedFileRepository.countByStoragePath(storagePath) > 1)) {
                skippedUncertain++;
                continue;
            }

            // Confirmed Orphan Candidate
            orphanedFilesFound++;
            long fileSize = (file.getSizeBytes() != null ? file.getSizeBytes() : 0);
            bytesReclaimed += fileSize;

            if (!effectiveDryRun) {
                try {
                    // Safe deletion: delete DB metadata first, then purge physical storage if no other row uses it
                    storedFileRepository.delete(file);
                    if (storagePath != null && storedFileRepository.countByStoragePath(storagePath) == 0) {
                        storageProvider.delete(storagePath);
                    }
                    orphanedFilesDeleted++;
                    log.info("Cleaned orphaned file id={}, path={}, size={}", file.getId(), storagePath, fileSize);
                } catch (Exception e) {
                    failedDeletions++;
                    String reason = "File " + file.getId() + " deletion failed: " + sanitizeError(e.getMessage());
                    failureReasons.add(reason);
                    log.warn("Failed to delete orphaned file {}: {}", file.getId(), sanitizeError(e.getMessage()));
                }
            }
        }

        // 3. Evaluate Orphaned Video Records (Bunny Stream)
        long orphanedVideosFound = 0;
        long orphanedVideosDeleted = 0;
        List<Video> allVideos = videoRepository.findAll();
        Set<String> activeModuleIds = new HashSet<>(courseModuleRepository.findAll().stream().map(m -> m.getId()).toList());

        for (Video v : allVideos) {
            if (v.getCreatedAt() != null && v.getCreatedAt().isAfter(LocalDateTime.now().minusHours(cutoffHours))) {
                continue;
            }

            boolean hasModule = v.getModuleId() != null && activeModuleIds.contains(v.getModuleId());
            boolean isReferencedInStream = (v.getBunnyVideoId() != null && referencedStreamVideoIds.contains(v.getBunnyVideoId()));

            if (!hasModule && !isReferencedInStream) {
                orphanedVideosFound++;
                if (!effectiveDryRun) {
                    try {
                        if (v.getBunnyVideoId() != null) {
                            bunnyStreamService.deleteVideo(v.getBunnyVideoId());
                        }
                        videoRepository.delete(v);
                        orphanedVideosDeleted++;
                    } catch (Exception e) {
                        failedDeletions++;
                        failureReasons.add("Video " + v.getBunnyVideoId() + " deletion failed: " + sanitizeError(e.getMessage()));
                        log.warn("Failed to delete orphaned video {}: {}", v.getBunnyVideoId(), sanitizeError(e.getMessage()));
                    }
                }
            }
        }

        // 4. Student Submission Retention (Requirement C5)
        long submissionsPurged = 0;
        int retentionMonths = getSubmissionRetentionMonths();
        if (retentionMonths > 0) {
            LocalDateTime retentionCutoff = LocalDateTime.now().minusMonths(retentionMonths);
            List<AssignmentSubmission> submissions = submissionRepository.findAll();
            for (AssignmentSubmission sub : submissions) {
                LocalDateTime subDate = sub.getCreatedAt() != null ? sub.getCreatedAt() : sub.getUpdatedAt();
                if (subDate != null && subDate.isBefore(retentionCutoff)) {
                    if (sub.getAttachment() != null || sub.getCorrectionAttachment() != null || sub.getCorrectedFileUrl() != null) {
                        submissionsPurged++;
                        if (!effectiveDryRun) {
                            if (sub.getAttachment() != null) {
                                purgeFileFromText(sub.getAttachment());
                                sub.setAttachment(null);
                            }
                            if (sub.getCorrectionAttachment() != null) {
                                purgeFileFromText(sub.getCorrectionAttachment());
                                sub.setCorrectionAttachment(null);
                            }
                            if (sub.getCorrectedFileUrl() != null) {
                                purgeFileFromText(sub.getCorrectedFileUrl());
                                sub.setCorrectedFileUrl(null);
                            }
                            submissionRepository.save(sub);
                        }
                    }
                }
            }
        }

        result.setTotalScanned(totalScanned);
        result.setSkippedRecent(skippedRecent);
        result.setSkippedActiveRef(skippedActiveRef);
        result.setSkippedUncertain(skippedUncertain);
        result.setOrphanCandidates(orphanedFilesFound);
        result.setEligibleForDeletion(orphanedFilesFound);
        result.setOrphanedFilesFound(orphanedFilesFound);
        result.setOrphanedFilesDeleted(orphanedFilesDeleted);
        result.setOrphanedVideosFound(orphanedVideosFound);
        result.setOrphanedVideosDeleted(orphanedVideosDeleted);
        result.setSubmissionsPurged(submissionsPurged);
        result.setBytesReclaimed(bytesReclaimed);
        result.setFailedDeletions(failedDeletions);
        result.setFailureReasons(failureReasons);

        String msg = String.format("%s completed: %d files scanned, %d active/protected, %d recent skipped, %d files %s (%s bytes), %d videos %s, %d submissions purged, %d failures.",
                effectiveDryRun ? (requiresOptIn ? "Dry-run scan (confirmation required for live purge)" : "Dry-run scan") : "Live cleanup purge",
                totalScanned,
                skippedActiveRef,
                skippedRecent,
                effectiveDryRun ? orphanedFilesFound : orphanedFilesDeleted,
                effectiveDryRun ? "flagged as orphans" : "permanently deleted",
                formatBytes(bytesReclaimed),
                effectiveDryRun ? orphanedVideosFound : orphanedVideosDeleted,
                effectiveDryRun ? "flagged as orphans" : "permanently deleted",
                submissionsPurged,
                failedDeletions);
        result.setMessage(msg);

        this.lastCleanupTimestamp = OffsetDateTime.now();
        this.lastCleanupResult = result;

        return result;
    }

    private boolean isFileReferenced(StoredFile file, Set<String> referencedStorageItems) {
        if (file == null) return false;
        String id = file.getId();
        String storagePath = file.getStoragePath();

        // 1. Direct ID match
        if (id != null && referencedStorageItems.contains(id)) {
            return true;
        }

        // 2. Direct StoragePath match
        if (storagePath != null && referencedStorageItems.contains(storagePath)) {
            return true;
        }

        // 3. Normalized storage path (without leading slash)
        if (storagePath != null) {
            String clean = storagePath.startsWith("/") ? storagePath.substring(1) : storagePath;
            if (referencedStorageItems.contains(clean)) {
                return true;
            }
        }

        // 4. Logical Reference Counting (Requirement C4)
        if (file.getRefCount() != null && file.getRefCount() > 1) {
            return true;
        }

        // 5. Check if any stored reference contains this file ID as substring or path component
        if (id != null) {
            for (String ref : referencedStorageItems) {
                if (ref != null && ref.contains(id)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Objective A: Comprehensive Reference Collector for Bunny Storage Assets.
     * Gathers all legitimate media references across all 20+ entity locations.
     */
    public Set<String> collectAllReferencedStorageItems() {
        Set<String> refs = new HashSet<>();

        // 1. Assessment Questions (mediaRef) - Root Cause Fix
        if (assessmentQuestionRepository != null) {
            assessmentQuestionRepository.findAll().forEach(q -> {
                extractStorageRefs(q.getMediaRef(), refs);
            });
        }

        // 2. Candidate Exam Attempt Answers (voiceFileId, audioFileId)
        if (attemptAnswerRepository != null) {
            attemptAnswerRepository.findAll().forEach(ans -> {
                extractStorageRefs(ans.getAudioFileId(), refs);
                extractStorageRefs(ans.getVoiceFileId(), refs);
            });
        }

        // 3. Competition Study Materials (storedFileId)
        if (competitionStudyMaterialRepository != null) {
            competitionStudyMaterialRepository.findAll().forEach(sm -> {
                extractStorageRefs(sm.getStoredFileId(), refs);
            });
        }

        // 4. Competition Syllabus (storedFileId)
        if (competitionSyllabusRepository != null) {
            competitionSyllabusRepository.findAll().forEach(syl -> {
                extractStorageRefs(syl.getStoredFileId(), refs);
            });
        }

        // 5. Course Resources (fileUrl)
        if (courseResourceRepository != null) {
            courseResourceRepository.findAll().forEach(cr -> {
                extractStorageRefs(cr.getFileUrl(), refs);
            });
        }

        // 6. Expenses Receipts (receiptUrl)
        if (expenseRepository != null) {
            expenseRepository.findAll().forEach(exp -> {
                extractStorageRefs(exp.getReceiptUrl(), refs);
            });
        }

        // 7. Competition Registrations Certificates (certificateUrl)
        if (registrationRepository != null) {
            registrationRepository.findAll().forEach(reg -> {
                extractStorageRefs(reg.getCertificateUrl(), refs);
            });
        }

        // 8. Competition Modules Assessment JSONB Data
        if (competitionModuleRepository != null) {
            competitionModuleRepository.findAll().forEach(mod -> {
                extractJsonRefs(mod.getAssessmentData(), refs);
            });
        }

        // 9. Course Modules (thumbnails, notes, worksheets, assignments)
        courseModuleRepository.findAll().forEach(m -> {
            extractStorageRefs(m.getThumbnailUrl(), refs);
            extractStorageRefs(m.getNotesFileUrl(), refs);
            extractStorageRefs(m.getWorksheetFileUrl(), refs);
            extractStorageRefs(m.getAssignmentFileUrl(), refs);
        });

        // 10. Courses (thumbnail, previewVideoUrl if storage file)
        courseRepository.findAll().forEach(c -> {
            extractStorageRefs(c.getThumbnail(), refs);
            if (c.getPreviewVideoUrl() != null && !c.getPreviewVideoUrl().contains(".m3u8") && !c.getPreviewVideoUrl().contains("video.bunnycdn.com")) {
                extractStorageRefs(c.getPreviewVideoUrl(), refs);
            }
        });

        // 11. Schedules (notes, worksheets, assignments)
        scheduleRepository.findAll().forEach(s -> {
            extractStorageRefs(s.getNotesFileUrl(), refs);
            extractStorageRefs(s.getWorksheetFileUrl(), refs);
            extractStorageRefs(s.getAssignmentFileUrl(), refs);
        });

        // 12. Submissions (attachments, correction attachments, corrected file urls)
        submissionRepository.findAll().forEach(sub -> {
            extractJsonRefs(sub.getAttachment(), refs);
            extractJsonRefs(sub.getCorrectionAttachment(), refs);
            extractStorageRefs(sub.getCorrectedFileUrl(), refs);
        });

        // 13. Assignments (attachments)
        assignmentRepository.findAll().forEach(a -> {
            extractStorageRefs(a.getAttachment(), refs);
        });

        // 14. Users (avatars)
        userRepository.findAll().forEach(u -> {
            extractStorageRefs(u.getAvatar(), refs);
        });

        // 15. Competitions (rules PDF, banners)
        competitionRepository.findAll().forEach(comp -> {
            extractStorageRefs(comp.getRulesPdfUrl(), refs);
            extractStorageRefs(comp.getBannerUrl(), refs);
        });

        // 16. Website Settings
        websiteSettingsRepository.findAll().forEach(ws -> {
            extractJsonRefs(ws.getSettingsJson(), refs);
            extractStorageRefs(ws.getHeroHeadline(), refs);
            extractStorageRefs(ws.getBannerAnnouncement(), refs);
        });

        // 17. Hero Background Images
        if (heroImageRepository != null) {
            heroImageRepository.findAll().forEach(hero -> {
                extractStorageRefs(hero.getUrl(), refs);
                extractStorageRefs(hero.getStorageKey(), refs);
            });
        }

        // 18. Feedback Media (Images & Documents)
        if (feedbackMediaRepository != null) {
            feedbackMediaRepository.findAll().forEach(fm -> {
                extractStorageRefs(fm.getUrl(), refs);
                extractStorageRefs(fm.getThumbnailUrl(), refs);
                extractStorageRefs(fm.getStoredFileId(), refs);
            });
        }

        return refs;
    }

    /**
     * Objective B: Reference Collector for Bunny Stream Video Assets.
     * Segregates video GUIDs from standard stored_files UUIDs.
     */
    public Set<String> collectAllReferencedStreamVideoIds() {
        Set<String> videoIds = new HashSet<>();

        // 1. Course Modules (videoStorageRef JSON)
        courseModuleRepository.findAll().forEach(m -> {
            String ref = m.getVideoStorageRef();
            if (ref != null && !ref.isBlank()) {
                videoIds.add(ref.trim());
                try {
                    JsonNode node = objectMapper.readTree(ref);
                    if (node.has("videoId")) {
                        videoIds.add(node.get("videoId").asText());
                    }
                    if (node.has("guid")) {
                        videoIds.add(node.get("guid").asText());
                    }
                    if (node.has("storageKey")) {
                        videoIds.add(node.get("storageKey").asText().replace("bunny_", ""));
                    }
                } catch (Exception ignored) {}
            }
        });

        // 2. Competition Guidance Videos (bunnyVideoId, embedUrl, playbackUrl)
        if (guidanceVideoRepository != null) {
            guidanceVideoRepository.findAll().forEach(gv -> {
                if (gv.getBunnyVideoId() != null && !gv.getBunnyVideoId().isBlank()) {
                    videoIds.add(gv.getBunnyVideoId().trim());
                }
                extractStreamRefs(gv.getEmbedUrl(), videoIds);
                extractStreamRefs(gv.getPlaybackUrl(), videoIds);
            });
        }

        // 3. Feedback Media (bunnyVideoId)
        if (feedbackMediaRepository != null) {
            feedbackMediaRepository.findAll().forEach(fm -> {
                if (fm.getBunnyVideoId() != null && !fm.getBunnyVideoId().isBlank()) {
                    videoIds.add(fm.getBunnyVideoId().trim());
                }
            });
        }

        // 4. Course Preview Videos (if HLS stream URL)
        courseRepository.findAll().forEach(c -> {
            extractStreamRefs(c.getPreviewVideoUrl(), videoIds);
        });

        return videoIds;
    }

    private void extractStorageRefs(String text, Set<String> refs) {
        if (text == null || text.isBlank()) return;
        String trimmed = text.trim();
        refs.add(trimmed);

        // Normalize /api/files/UUID -> UUID
        if (trimmed.contains("/api/files/")) {
            String pathPart = trimmed.substring(trimmed.indexOf("/api/files/") + 11).split("[?#]")[0];
            refs.add(pathPart);
        }

        // Relative path segments (public/... or private/...)
        if (trimmed.contains("public/")) {
            refs.add(trimmed.substring(trimmed.indexOf("public/")).split("[?#]")[0]);
        } else if (trimmed.contains("private/")) {
            refs.add(trimmed.substring(trimmed.indexOf("private/")).split("[?#]")[0]);
        }

        Matcher matcher = UUID_PATTERN.matcher(trimmed);
        while (matcher.find()) {
            refs.add(matcher.group(1));
        }
    }

    private void extractJsonRefs(String jsonText, Set<String> refs) {
        if (jsonText == null || jsonText.isBlank()) return;
        try {
            JsonNode root = objectMapper.readTree(jsonText);
            inspectJsonNode(root, refs);
        } catch (Exception e) {
            // Fallback to text matching
            extractStorageRefs(jsonText, refs);
        }
    }

    private void inspectJsonNode(JsonNode node, Set<String> refs) {
        if (node == null) return;
        if (node.isTextual()) {
            extractStorageRefs(node.asText(), refs);
        } else if (node.isArray()) {
            for (JsonNode elem : node) {
                inspectJsonNode(elem, refs);
            }
        } else if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey().toLowerCase();
                JsonNode value = entry.getValue();
                if (key.contains("id") || key.contains("url") || key.contains("file") || key.contains("path") || key.contains("ref") || key.contains("media")) {
                    if (value.isTextual()) {
                        extractStorageRefs(value.asText(), refs);
                    }
                }
                inspectJsonNode(value, refs);
            });
        }
    }

    private void extractStreamRefs(String text, Set<String> videoIds) {
        if (text == null || text.isBlank()) return;
        videoIds.add(text.trim());
        Matcher matcher = UUID_PATTERN.matcher(text);
        while (matcher.find()) {
            videoIds.add(matcher.group(1));
        }
    }

    private void purgeFileFromText(String text) {
        if (text == null || text.isBlank()) return;
        Matcher matcher = UUID_PATTERN.matcher(text);
        while (matcher.find()) {
            try {
                fileStorageService.deleteFile(matcher.group(1));
            } catch (Exception ignored) {}
        }
    }

    public StorageMetricsDto getMetrics() {
        StorageMetricsDto metrics = new StorageMetricsDto();
        List<StoredFile> files = storedFileRepository.findAll();

        long totalFiles = files.size();
        long totalBytes = 0;
        Map<String, Long> sizeByCategory = new LinkedHashMap<>();
        Map<String, Long> countByCategory = new LinkedHashMap<>();

        for (StoredFile f : files) {
            long size = f.getSizeBytes() != null ? f.getSizeBytes() : 0;
            totalBytes += size;
            String cat = f.getCategory() != null ? f.getCategory() : "other";
            sizeByCategory.put(cat, sizeByCategory.getOrDefault(cat, 0L) + size);
            countByCategory.put(cat, countByCategory.getOrDefault(cat, 0L) + 1L);
        }

        metrics.setTotalFiles(totalFiles);
        metrics.setTotalSizeBytes(totalBytes);
        metrics.setSizeByCategory(sizeByCategory);
        metrics.setCountByCategory(countByCategory);

        // Lightweight safe orphan preview
        Set<String> activeRefs = collectAllReferencedStorageItems();
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(defaultCutoffHours);
        long orphanCount = 0;
        long orphanBytes = 0;

        for (StoredFile f : files) {
            if (f.getCreatedAt() != null && f.getCreatedAt().isAfter(cutoff)) continue;
            if (!isFileReferenced(f, activeRefs)) {
                orphanCount++;
                orphanBytes += (f.getSizeBytes() != null ? f.getSizeBytes() : 0);
            }
        }

        metrics.setOrphanCount(orphanCount);
        metrics.setOrphanSizeBytes(orphanBytes);

        if (lastCleanupTimestamp != null) {
            metrics.setLastCleanupTime(lastCleanupTimestamp.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        } else {
            metrics.setLastCleanupTime("Never");
        }

        if (lastCleanupResult != null) {
            metrics.setLastCleanedCount(lastCleanupResult.getOrphanedFilesDeleted());
            metrics.setLastReclaimedBytes(lastCleanupResult.getBytesReclaimed());
        }

        metrics.setSubmissionRetentionMonths(getSubmissionRetentionMonths());
        metrics.setDryRunDefault(dryRunDefault);
        metrics.setCleanupEnabled(cleanupEnabled);
        metrics.setOrphanRetentionHours(defaultCutoffHours);
        metrics.setLivePurgeAllowed(livePurgeAllowed);
        metrics.setCurrentlyRunning(isCleanupRunning.get());

        return metrics;
    }

    public int getSubmissionRetentionMonths() {
        return systemSettingRepository.findById("submission_retention_months")
                .map(s -> {
                    try {
                        return Integer.parseInt(s.getSettingValue().trim());
                    } catch (Exception e) {
                        return 0;
                    }
                })
                .orElse(0);
    }

    public void setSubmissionRetentionMonths(int months) {
        SystemSetting setting = systemSettingRepository.findById("submission_retention_months")
                .orElse(new SystemSetting("submission_retention_months", "0"));
        setting.setSettingValue(String.valueOf(Math.max(0, months)));
        systemSettingRepository.save(setting);
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format("%.2f %sB", bytes / Math.pow(1024, exp), pre);
    }

    private String sanitizeError(String message) {
        if (message == null) return "Unknown error";
        return message.replaceAll("(?i)(password|secret|accesskey|key)=[^& ]+", "$1=[REDACTED]");
    }
}
