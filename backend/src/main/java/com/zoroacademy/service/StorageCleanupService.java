package com.zoroacademy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.dto.StorageMetricsDto;
import com.zoroacademy.entity.*;
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
import java.util.stream.Collectors;

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
    private final DoubtRepository doubtRepository;
    private final NotificationRepository notificationRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.OrphanedBunnyVideoRepository orphanedBunnyVideoRepository;

    public void setOrphanedBunnyVideoRepository(com.zoroacademy.repository.OrphanedBunnyVideoRepository orphanedBunnyVideoRepository) {
        this.orphanedBunnyVideoRepository = orphanedBunnyVideoRepository;
    }

    public com.zoroacademy.repository.OrphanedBunnyVideoRepository getOrphanedBunnyVideoRepository() {
        return this.orphanedBunnyVideoRepository;
    }

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicBoolean isCleanupRunning = new AtomicBoolean(false);

    // Objective C: Permanent safe defaults
    @Value("${storage.cleanup.enabled:false}")
    private boolean cleanupEnabled;

    @Value("${storage.cleanup.dry-run:true}")
    private boolean dryRunDefault;

    @Value("${storage.cleanup.orphan-retention-hours:8760}")
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
            @Autowired(required = false) CompetitionModuleRepository competitionModuleRepository,
            @Autowired(required = false) DoubtRepository doubtRepository,
            @Autowired(required = false) NotificationRepository notificationRepository
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
        this.doubtRepository = doubtRepository;
        this.notificationRepository = notificationRepository;
    }

    // 25-arg constructor for tests
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
            FeedbackMediaRepository feedbackMediaRepository,
            AssessmentQuestionRepository assessmentQuestionRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            CompetitionStudyMaterialRepository competitionStudyMaterialRepository,
            CompetitionSyllabusRepository competitionSyllabusRepository,
            CompetitionGuidanceVideoRepository guidanceVideoRepository,
            CourseResourceRepository courseResourceRepository,
            ExpenseRepository expenseRepository,
            CompetitionRegistrationRepository registrationRepository,
            CompetitionModuleRepository competitionModuleRepository
    ) {
        this(storedFileRepository, storageProvider, fileStorageService,
                courseRepository, courseModuleRepository, scheduleRepository,
                assignmentRepository, submissionRepository, userRepository,
                competitionRepository, websiteSettingsRepository, videoRepository,
                bunnyStreamService, systemSettingRepository, heroImageRepository,
                feedbackMediaRepository, assessmentQuestionRepository, attemptAnswerRepository,
                competitionStudyMaterialRepository, competitionSyllabusRepository,
                guidanceVideoRepository, courseResourceRepository, expenseRepository,
                registrationRepository, competitionModuleRepository, null, null);
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
                feedbackMediaRepository, null, null, null, null, null, null, null, null, null, null, null);
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

        // Reconcile / retry any previously failed deletions recorded in durable storage
        if (!effectiveDryRun) {
            retryFailedDeletions();
        }

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
                    // Safety check 1: Re-verify all references immediately before deletion
                    FileStorageService.ReferenceCheckResult refCheck = (fileStorageService != null)
                            ? fileStorageService.checkEntityReferences(file.getId(), storagePath)
                            : FileStorageService.ReferenceCheckResult.UNKNOWN;

                    if (refCheck != FileStorageService.ReferenceCheckResult.NOT_REFERENCED) {
                        skippedActiveRef++;
                        log.info("Aborting cleanup deletion of file {}: re-verification detected reference status {}", file.getId(), refCheck);
                        continue;
                    }

                    // Safety check 2: Check for shared storage paths
                    if (storagePath != null && (pathCounts.getOrDefault(storagePath, 0L) > 1 || storedFileRepository.countByStoragePath(storagePath) > 1)) {
                        skippedUncertain++;
                        log.info("Aborting cleanup deletion of file {}: physical storage path {} is shared", file.getId(), storagePath);
                        continue;
                    }

                    // STEP 1: PHYSICAL DELETION FIRST (Section 4: Do not delete metadata before physical deletion is confirmed)
                    boolean physicalConfirmed = false;
                    if (storagePath != null && !storagePath.isBlank()) {
                        try {
                            if (storageProvider.exists(storagePath)) {
                                storageProvider.delete(storagePath);
                            }
                            physicalConfirmed = true;
                        } catch (Exception storageEx) {
                            failedDeletions++;
                            String reason = "Bunny Storage deletion failed for file " + file.getId() + " at " + storagePath + ": " + sanitizeError(storageEx.getMessage());
                            failureReasons.add(reason);
                            log.error("Failed to delete physical file from Bunny Storage id={}, path={}: {}", file.getId(), storagePath, sanitizeError(storageEx.getMessage()), storageEx);
                            recordFailedDeletion(file.getId(), storagePath, sanitizeError(storageEx.getMessage()));
                            // METADATA IS PRESERVED in database for retry/reconciliation!
                            continue;
                        }
                    } else {
                        physicalConfirmed = true;
                    }

                    // STEP 2: METADATA DELETION ONLY AFTER PHYSICAL DELETION IS CONFIRMED
                    if (physicalConfirmed) {
                        try {
                            storedFileRepository.delete(file);
                            orphanedFilesDeleted++;
                            clearFailedDeletion(file.getId());
                            log.info("Cleaned orphaned file id={}, path={}, size={}", file.getId(), storagePath, fileSize);
                        } catch (Exception dbEx) {
                            failedDeletions++;
                            String reason = "Database record deletion failed for file " + file.getId() + " after physical purge: " + sanitizeError(dbEx.getMessage());
                            failureReasons.add(reason);
                            log.error("Database deletion failed for file id={}: {}", file.getId(), sanitizeError(dbEx.getMessage()), dbEx);
                            recordTombstone(file.getId(), storagePath, "PHYSICAL_PURGED_DB_REMAINING");
                        }
                    }
                } catch (Exception e) {
                    failedDeletions++;
                    String reason = "File " + file.getId() + " cleanup failed: " + sanitizeError(e.getMessage());
                    failureReasons.add(reason);
                    log.warn("Failed to process orphan file {}: {}", file.getId(), sanitizeError(e.getMessage()));
                }
            }
        }

        // 3. Evaluate Orphaned Video Records (Bunny Stream 1-Year Retention Policy: 8760 Hours)
        long orphanedVideosFound = 0;
        long orphanedVideosDeleted = 0;

        int videoRetentionHours = 8760;
        OffsetDateTime videoCutoff = OffsetDateTime.now().minusHours(videoRetentionHours);

        // A. Discover unreferenced Video records in videos table and register newly orphaned videos
        if (videoRepository != null) {
            try {
                List<Video> allVideos = videoRepository.findAll();
                for (Video v : allVideos) {
                    String bId = v.getBunnyVideoId();
                    if (bId == null || bId.isBlank()) continue;

                    FileStorageService.ReferenceCheckResult refCheck = checkStreamVideoReferences(bId, referencedStreamVideoIds);
                    if (refCheck == FileStorageService.ReferenceCheckResult.NOT_REFERENCED) {
                        if (orphanedBunnyVideoRepository != null && !orphanedBunnyVideoRepository.existsByBunnyVideoId(bId)) {
                            com.zoroacademy.entity.OrphanedBunnyVideo newOrphan = new com.zoroacademy.entity.OrphanedBunnyVideo(
                                    bId,
                                    "COURSE_MODULE",
                                    v.getTitle(),
                                    v.getModuleId(),
                                    OffsetDateTime.now()
                            );
                            orphanedBunnyVideoRepository.save(newOrphan);
                            log.info("Discovered and recorded newly orphaned Bunny Stream video: {}", bId);
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Failed to scan videos repository for newly orphaned videos: {}", e.getMessage());
            }
        }

        // B. Process tracked orphaned videos from orphanedBunnyVideoRepository
        if (orphanedBunnyVideoRepository != null) {
            List<com.zoroacademy.entity.OrphanedBunnyVideo> trackedOrphans = orphanedBunnyVideoRepository.findAll();
            for (com.zoroacademy.entity.OrphanedBunnyVideo orphan : trackedOrphans) {
                String bId = orphan.getBunnyVideoId();
                if (bId == null || bId.isBlank()) continue;

                // 1. Check current references across all relevant entities
                FileStorageService.ReferenceCheckResult refCheck = checkStreamVideoReferences(bId, referencedStreamVideoIds);
                if (refCheck == FileStorageService.ReferenceCheckResult.REFERENCED) {
                    // Video is referenced by an active record -> Never delete!
                    log.info("Orphaned video {} is active/referenced by an application entity; unmarking orphan status", bId);
                    orphanedBunnyVideoRepository.delete(orphan);
                    continue;
                }
                if (refCheck == FileStorageService.ReferenceCheckResult.UNKNOWN) {
                    // Unknown reference status -> Retain!
                    log.warn("Orphaned video {} reference verification returned UNKNOWN; retaining video", bId);
                    skippedUncertain++;
                    continue;
                }

                // 2. Reference status is definitively NOT_REFERENCED. Check orphan retention period (365 days / 8760 hours)
                OffsetDateTime orphanedAt = orphan.getOrphanedAt();
                if (orphanedAt == null || orphanedAt.isAfter(videoCutoff)) {
                    if (orphanedAt == null) {
                        log.warn("Orphaned video {} has null/missing orphan timestamp; preserving video and setting timestamp to now", bId);
                        orphan.setOrphanedAt(OffsetDateTime.now());
                        orphanedBunnyVideoRepository.save(orphan);
                    }
                    // Orphaned for less than 365 days (or null timestamp) -> Retain!
                    skippedRecent++;
                    continue;
                }

                // 3. Confirmed orphaned for at least 365 days -> Eligible for cleanup!
                orphanedVideosFound++;

                if (!effectiveDryRun) {
                    try {
                        // Delete Bunny Stream object
                        if (bunnyStreamService != null) {
                            bunnyStreamService.deleteVideo(bId);
                        }
                        // Also remove any corresponding Video row if exists
                        if (videoRepository != null) {
                            videoRepository.findByBunnyVideoId(bId).ifPresent(videoRepository::delete);
                        }
                        // Only after successful deletion, remove orphan-tracking metadata!
                        orphanedBunnyVideoRepository.delete(orphan);
                        if (systemSettingRepository != null) {
                            String key = "cleanup.failed.video." + bId;
                            if (systemSettingRepository.existsById(key)) {
                                systemSettingRepository.deleteById(key);
                            }
                        }
                        orphanedVideosDeleted++;
                        log.info("Successfully purged expired orphaned Bunny Stream video: {}", bId);
                    } catch (Exception e) {
                        failedDeletions++;
                        String reason = "Video " + bId + " deletion failed: " + sanitizeError(e.getMessage());
                        failureReasons.add(reason);
                        log.warn("Failed to delete orphaned video {}: {}", bId, sanitizeError(e.getMessage()));

                        // Preserve metadata and record durable failure for retry
                        if (systemSettingRepository != null) {
                            try {
                                String key = "cleanup.failed.video." + bId;
                                String val = (orphan.getCategory() != null ? orphan.getCategory() : "VIDEO")
                                        + "|" + e.getMessage() + "|" + OffsetDateTime.now();
                                systemSettingRepository.save(new SystemSetting(key, val));
                            } catch (Exception ignored) {}
                        }
                    }
                }
            }
        }

        // 4. Student Submission Retention (Section 5)
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
                            processSubmissionRetention(sub, referencedStorageItems);
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

        // 1. Assessment Questions (mediaRef, text, explanation, guidance) - Root Cause Fix
        if (assessmentQuestionRepository != null) {
            assessmentQuestionRepository.findAll().forEach(q -> {
                extractStorageRefs(q.getMediaRef(), refs);
                extractStorageRefs(q.getQuestionText(), refs);
                extractStorageRefs(q.getExplanation(), refs);
                extractStorageRefs(q.getGuidanceText(), refs);
            });
        }

        // 2. Candidate Exam Attempt Answers (voiceFileId, audioFileId, textAnswer, feedback)
        if (attemptAnswerRepository != null) {
            attemptAnswerRepository.findAll().forEach(ans -> {
                extractStorageRefs(ans.getAudioFileId(), refs);
                extractStorageRefs(ans.getVoiceFileId(), refs);
                extractStorageRefs(ans.getTextAnswer(), refs);
                extractStorageRefs(ans.getTrainerFeedback(), refs);
                extractStorageRefs(ans.getFeedback(), refs);
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
        if (courseModuleRepository != null) {
            try {
                courseModuleRepository.findAll().forEach(m -> {
                    extractStorageRefs(m.getThumbnailUrl(), refs);
                    extractStorageRefs(m.getNotesFileUrl(), refs);
                    extractStorageRefs(m.getWorksheetFileUrl(), refs);
                    extractStorageRefs(m.getAssignmentFileUrl(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query courseModuleRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 10. Courses (thumbnail, previewVideoUrl if storage file)
        if (courseRepository != null) {
            try {
                courseRepository.findAll().forEach(c -> {
                    extractStorageRefs(c.getThumbnail(), refs);
                    if (c.getPreviewVideoUrl() != null && !c.getPreviewVideoUrl().contains(".m3u8") && !c.getPreviewVideoUrl().contains("video.bunnycdn.com")) {
                        extractStorageRefs(c.getPreviewVideoUrl(), refs);
                    }
                });
            } catch (Exception e) {
                log.error("Failed to query courseRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 11. Schedules (notes, worksheets, assignments)
        if (scheduleRepository != null) {
            try {
                scheduleRepository.findAll().forEach(s -> {
                    extractStorageRefs(s.getNotesFileUrl(), refs);
                    extractStorageRefs(s.getWorksheetFileUrl(), refs);
                    extractStorageRefs(s.getAssignmentFileUrl(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query scheduleRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 12. Submissions (attachments, correction attachments, corrected file urls)
        if (submissionRepository != null) {
            try {
                submissionRepository.findAll().forEach(sub -> {
                    extractJsonRefs(sub.getAttachment(), refs);
                    extractJsonRefs(sub.getCorrectionAttachment(), refs);
                    extractStorageRefs(sub.getCorrectedFileUrl(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query submissionRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 13. Assignments (attachments)
        if (assignmentRepository != null) {
            try {
                assignmentRepository.findAll().forEach(a -> {
                    extractStorageRefs(a.getAttachment(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query assignmentRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 14. Users (avatars)
        if (userRepository != null) {
            try {
                userRepository.findAll().forEach(u -> {
                    extractStorageRefs(u.getAvatar(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query userRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 15. Competitions (rules PDF, banners, rules text)
        if (competitionRepository != null) {
            try {
                competitionRepository.findAll().forEach(comp -> {
                    extractStorageRefs(comp.getRulesPdfUrl(), refs);
                    extractStorageRefs(comp.getBannerUrl(), refs);
                    extractStorageRefs(comp.getRules(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query competitionRepository during storage reference collection: {}", e.getMessage());
            }
        }

        // 16. Website Settings
        if (websiteSettingsRepository != null) {
            try {
                websiteSettingsRepository.findAll().forEach(ws -> {
                    extractJsonRefs(ws.getSettingsJson(), refs);
                    extractStorageRefs(ws.getHeroHeadline(), refs);
                    extractStorageRefs(ws.getBannerAnnouncement(), refs);
                });
            } catch (Exception e) {
                log.error("Failed to query websiteSettingsRepository during storage reference collection: {}", e.getMessage());
            }
        }

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

        // 19. Doubts
        if (doubtRepository != null) {
            doubtRepository.findAll().forEach(d -> {
                extractStorageRefs(d.getQuestion(), refs);
                extractStorageRefs(d.getReply(), refs);
            });
        }

        // 20. Notifications
        if (notificationRepository != null) {
            notificationRepository.findAll().forEach(n -> {
                extractStorageRefs(n.getMessage(), refs);
            });
        }

        // 21. System Settings (excluding cleanup tracking keys)
        if (systemSettingRepository != null) {
            systemSettingRepository.findAll().forEach(s -> {
                if (s.getSettingKey() != null && !s.getSettingKey().startsWith("cleanup.failed.") && !s.getSettingKey().startsWith("cleanup.tombstone.")) {
                    extractStorageRefs(s.getSettingValue(), refs);
                }
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
        if (courseModuleRepository != null) {
            try {
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
            } catch (Exception e) {
                log.error("Failed to query courseModuleRepository during stream reference collection: {}", e.getMessage());
            }
        }

        // 2. Competition Guidance Videos (bunnyVideoId, embedUrl, playbackUrl)
        if (guidanceVideoRepository != null) {
            try {
                guidanceVideoRepository.findAll().forEach(gv -> {
                    if (gv.getBunnyVideoId() != null && !gv.getBunnyVideoId().isBlank()) {
                        videoIds.add(gv.getBunnyVideoId().trim());
                    }
                    extractStreamRefs(gv.getEmbedUrl(), videoIds);
                    extractStreamRefs(gv.getPlaybackUrl(), videoIds);
                });
            } catch (Exception e) {
                log.error("Failed to query guidanceVideoRepository during stream reference collection: {}", e.getMessage());
            }
        }

        // 3. Feedback Media (bunnyVideoId)
        if (feedbackMediaRepository != null) {
            try {
                feedbackMediaRepository.findAll().forEach(fm -> {
                    if (fm.getBunnyVideoId() != null && !fm.getBunnyVideoId().isBlank()) {
                        videoIds.add(fm.getBunnyVideoId().trim());
                    }
                });
            } catch (Exception e) {
                log.error("Failed to query feedbackMediaRepository during stream reference collection: {}", e.getMessage());
            }
        }

        // 4. Course Preview Videos (if HLS stream URL)
        if (courseRepository != null) {
            try {
                courseRepository.findAll().forEach(c -> {
                    extractStreamRefs(c.getPreviewVideoUrl(), videoIds);
                });
            } catch (Exception e) {
                log.error("Failed to query courseRepository during stream reference collection: {}", e.getMessage());
            }
        }

        return videoIds;
    }

    /**
     * Verifies whether a Bunny Stream video is referenced across all relevant application entities.
     * Follows the fail-closed pattern: repository exceptions return UNKNOWN (which protects the video).
     */
    public FileStorageService.ReferenceCheckResult checkStreamVideoReferences(String bunnyVideoId, Set<String> referencedStreamVideoIds) {
        if (bunnyVideoId == null || bunnyVideoId.isBlank()) {
            return FileStorageService.ReferenceCheckResult.NOT_REFERENCED;
        }
        String cleanId = bunnyVideoId.trim();

        // Fail-closed requirement: Missing required repositories must NEVER produce NOT_REFERENCED
        if (courseModuleRepository == null || courseRepository == null
                || guidanceVideoRepository == null || feedbackMediaRepository == null) {
            log.warn("checkStreamVideoReferences: One or more required repositories is missing. Returning UNKNOWN for video {}", cleanId);
            return FileStorageService.ReferenceCheckResult.UNKNOWN;
        }

        try {
            // Check pre-collected in-memory referenced stream video IDs
            if (referencedStreamVideoIds != null && referencedStreamVideoIds.contains(cleanId)) {
                return FileStorageService.ReferenceCheckResult.REFERENCED;
            }

            // Direct check across course modules (exact ID / JSON attribute matching)
            for (CourseModule m : courseModuleRepository.findAll()) {
                if (matchesExactVideoId(m.getVideoStorageRef(), cleanId)) {
                    return FileStorageService.ReferenceCheckResult.REFERENCED;
                }
            }

            // Direct check across competition guidance videos
            for (CompetitionGuidanceVideo gv : guidanceVideoRepository.findAll()) {
                if (cleanId.equalsIgnoreCase(gv.getBunnyVideoId())) {
                    return FileStorageService.ReferenceCheckResult.REFERENCED;
                }
                if (matchesExactVideoId(gv.getEmbedUrl(), cleanId) || matchesExactVideoId(gv.getPlaybackUrl(), cleanId)) {
                    return FileStorageService.ReferenceCheckResult.REFERENCED;
                }
            }

            // Direct check across feedback media
            for (FeedbackMedia fm : feedbackMediaRepository.findAll()) {
                if (cleanId.equalsIgnoreCase(fm.getBunnyVideoId())) {
                    return FileStorageService.ReferenceCheckResult.REFERENCED;
                }
            }

            // Direct check across courses (preview videos)
            for (Course c : courseRepository.findAll()) {
                if (matchesExactVideoId(c.getPreviewVideoUrl(), cleanId)) {
                    return FileStorageService.ReferenceCheckResult.REFERENCED;
                }
            }

            // Direct check across videos table: if video has active module
            if (videoRepository != null) {
                List<Video> videos = videoRepository.findAll();
                Set<String> activeModuleIds = courseModuleRepository.findAll().stream()
                        .map(CourseModule::getId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
                for (Video v : videos) {
                    if (cleanId.equalsIgnoreCase(v.getBunnyVideoId())) {
                        if (v.getModuleId() != null && activeModuleIds.contains(v.getModuleId())) {
                            return FileStorageService.ReferenceCheckResult.REFERENCED;
                        }
                    }
                }
            }

            return FileStorageService.ReferenceCheckResult.NOT_REFERENCED;
        } catch (Exception e) {
            log.error("Failed to check stream video references for {}: {}", cleanId, e.getMessage());
            return FileStorageService.ReferenceCheckResult.UNKNOWN;
        }
    }

    private boolean matchesExactVideoId(String text, String cleanId) {
        if (text == null || text.isBlank() || cleanId == null || cleanId.isBlank()) return false;
        String trimmed = text.trim();
        if (trimmed.equalsIgnoreCase(cleanId)) return true;

        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                JsonNode node = objectMapper.readTree(trimmed);
                if (node.has("videoId") && cleanId.equalsIgnoreCase(node.get("videoId").asText().trim())) return true;
                if (node.has("guid") && cleanId.equalsIgnoreCase(node.get("guid").asText().trim())) return true;
                if (node.has("storageKey")) {
                    String sk = node.get("storageKey").asText().trim();
                    if (cleanId.equalsIgnoreCase(sk) || cleanId.equalsIgnoreCase(sk.replace("bunny_", ""))) return true;
                }
            } catch (Exception ignored) {}
        }

        String lowerTrimmed = trimmed.toLowerCase();
        String lowerClean = cleanId.toLowerCase();
        int idx = lowerTrimmed.indexOf(lowerClean);
        while (idx >= 0) {
            boolean startOk = (idx == 0) || (!Character.isLetterOrDigit(lowerTrimmed.charAt(idx - 1)) && lowerTrimmed.charAt(idx - 1) != '-');
            int endIdx = idx + lowerClean.length();
            boolean endOk = (endIdx == lowerTrimmed.length()) || (!Character.isLetterOrDigit(lowerTrimmed.charAt(endIdx)) && lowerTrimmed.charAt(endIdx) != '-');
            if (startOk && endOk) {
                return true;
            }
            idx = lowerTrimmed.indexOf(lowerClean, idx + 1);
        }
        return false;
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

    public void retryFailedDeletions() {
        if (systemSettingRepository == null) return;
        try {
            List<SystemSetting> failedSettings = systemSettingRepository.findAll().stream()
                    .filter(s -> s.getSettingKey() != null && s.getSettingKey().startsWith("cleanup.failed.") && !s.getSettingKey().startsWith("cleanup.failed.video."))
                    .toList();

            for (SystemSetting setting : failedSettings) {
                String fileId = setting.getSettingKey().replace("cleanup.failed.", "");
                String val = setting.getSettingValue();
                String storagePath = (val != null && val.contains("|")) ? val.split("\\|")[0] : val;

                // Section 4 Fix: Revalidate references before retry deletion
                if (fileStorageService == null) {
                    log.warn("Retry deletion skipped for file {}: fileStorageService is null (UNKNOWN).", fileId);
                    continue;
                }

                FileStorageService.ReferenceCheckResult refCheck;
                try {
                    refCheck = fileStorageService.checkEntityReferences(fileId, storagePath);
                } catch (Exception e) {
                    log.error("Retry deletion reference check failed for file {}: {}", fileId, e.getMessage());
                    refCheck = FileStorageService.ReferenceCheckResult.UNKNOWN;
                }

                // UNKNOWN or REFERENCED must stop retry deletion
                if (refCheck != FileStorageService.ReferenceCheckResult.NOT_REFERENCED) {
                    log.info("Retry deletion refused for file {}: reference status is {} (protected)", fileId, refCheck);
                    if (refCheck == FileStorageService.ReferenceCheckResult.REFERENCED) {
                        systemSettingRepository.delete(setting);
                        log.info("Cleared failure record for newly referenced file {}", fileId);
                    }
                    continue;
                }

                // Recheck shared storage paths
                if (storedFileRepository != null && storagePath != null) {
                    try {
                        if (storedFileRepository.countByStoragePath(storagePath) > 1) {
                            log.info("Retry deletion refused for file {}: physical storage path {} is shared", fileId, storagePath);
                            continue;
                        }
                    } catch (Exception e) {
                        log.error("Retry deletion countByStoragePath failed for file {}: {}", fileId, e.getMessage());
                        continue;
                    }
                }

                try {
                    boolean physicalDeleted = false;
                    if (storagePath != null && !storagePath.isBlank() && storageProvider.exists(storagePath)) {
                        storageProvider.delete(storagePath);
                        physicalDeleted = true;
                    } else {
                        physicalDeleted = true;
                    }

                    if (physicalDeleted) {
                        if (storedFileRepository != null && storedFileRepository.existsById(fileId)) {
                            storedFileRepository.deleteById(fileId);
                        }
                        systemSettingRepository.delete(setting);
                        log.info("Successfully retried and reconciled failed deletion for file {}", fileId);
                    }
                } catch (Exception ex) {
                    log.warn("Retry failed deletion for file {} still unsuccessful: {}", fileId, sanitizeError(ex.getMessage()));
                }
            }

            // Section 6 Fix: Reconcile tombstones safely with reference checking
            List<SystemSetting> tombstoneSettings = systemSettingRepository.findAll().stream()
                    .filter(s -> s.getSettingKey() != null && s.getSettingKey().startsWith("cleanup.tombstone."))
                    .toList();

            for (SystemSetting tombstone : tombstoneSettings) {
                String fileId = tombstone.getSettingKey().replace("cleanup.tombstone.", "");
                try {
                    if (storedFileRepository != null && storedFileRepository.existsById(fileId)) {
                        StoredFile sf = storedFileRepository.findById(fileId).orElse(null);
                        if (sf != null) {
                            String storagePath = sf.getStoragePath();
                            // Section 6: Check references before deleting metadata
                            if (fileStorageService == null) {
                                log.info("Tombstone reconciliation skipped for file {}: fileStorageService is null (UNKNOWN)", fileId);
                                continue;
                            }
                            FileStorageService.ReferenceCheckResult refCheck = fileStorageService.checkEntityReferences(fileId, storagePath);
                            if (refCheck == FileStorageService.ReferenceCheckResult.REFERENCED) {
                                log.info("Tombstone reconciliation refused for file {}: reference status is REFERENCED (protected)", fileId);
                                systemSettingRepository.delete(tombstone);
                                continue;
                            }
                            if (refCheck == FileStorageService.ReferenceCheckResult.UNKNOWN) {
                                log.info("Tombstone reconciliation refused for file {}: reference status is UNKNOWN (protected)", fileId);
                                continue; // preserve tombstone and metadata for retry
                            }
                            // NOT_REFERENCED: continue only after checking shared storage paths
                            if (storagePath != null && storedFileRepository.countByStoragePath(storagePath) > 1) {
                                log.info("Tombstone reconciliation for file {}: storage path is shared (count > 1); deleting only DB record", fileId);
                            }
                            storedFileRepository.deleteById(fileId);
                        }
                    }
                    systemSettingRepository.delete(tombstone);
                    log.info("Successfully reconciled tombstone for file {}", fileId);
                } catch (Exception ex) {
                    log.warn("Failed to reconcile tombstone for file {}: {}", fileId, sanitizeError(ex.getMessage()));
                    // On errors: preserve tombstone and metadata for retry
                }
            }

            // Retry failed Bunny Stream video deletions
            List<SystemSetting> videoFailedSettings = systemSettingRepository.findAll().stream()
                    .filter(s -> s.getSettingKey() != null && s.getSettingKey().startsWith("cleanup.failed.video."))
                    .toList();

            for (SystemSetting setting : videoFailedSettings) {
                String bId = setting.getSettingKey().replace("cleanup.failed.video.", "");
                try {
                    // Fail-safe if required components are missing
                    if (bunnyStreamService == null || orphanedBunnyVideoRepository == null) {
                        log.warn("Retry video deletion skipped for {}: bunnyStreamService or orphanedBunnyVideoRepository is null", bId);
                        continue;
                    }

                    FileStorageService.ReferenceCheckResult refCheck = checkStreamVideoReferences(bId, null);
                    if (refCheck == FileStorageService.ReferenceCheckResult.REFERENCED) {
                        log.info("Retry video deletion refused for {}: actively referenced; clearing failure record and unmarking orphan", bId);
                        systemSettingRepository.delete(setting);
                        orphanedBunnyVideoRepository.findByBunnyVideoId(bId).ifPresent(orphanedBunnyVideoRepository::delete);
                        continue;
                    }
                    if (refCheck == FileStorageService.ReferenceCheckResult.UNKNOWN) {
                        log.info("Retry video deletion refused for {}: reference status is UNKNOWN (protected)", bId);
                        continue; // Preserve setting and metadata
                    }

                    // refCheck is NOT_REFERENCED
                    Optional<com.zoroacademy.entity.OrphanedBunnyVideo> orphanOpt = orphanedBunnyVideoRepository.findByBunnyVideoId(bId);
                    if (orphanOpt.isEmpty()) {
                        // Missing tracking records must NEVER bypass retention! Reconstruct orphan record and preserve failure setting
                        log.warn("Missing orphan tracking record for failed video {}; reconstructing orphan record and preserving failure setting", bId);
                        com.zoroacademy.entity.OrphanedBunnyVideo reconstructed = new com.zoroacademy.entity.OrphanedBunnyVideo(
                                bId,
                                "RECONSTRUCTED",
                                "Reconstructed from retry failure",
                                null,
                                OffsetDateTime.now()
                        );
                        orphanedBunnyVideoRepository.save(reconstructed);
                        continue;
                    }

                    com.zoroacademy.entity.OrphanedBunnyVideo orphan = orphanOpt.get();
                    OffsetDateTime orphanedAt = orphan.getOrphanedAt();
                    if (orphanedAt == null || orphanedAt.isAfter(OffsetDateTime.now().minusHours(8760))) {
                        if (orphanedAt == null) {
                            orphan.setOrphanedAt(OffsetDateTime.now());
                            orphanedBunnyVideoRepository.save(orphan);
                        }
                        log.info("Retry video deletion deferred for {}: orphaned less than 365 days (or null timestamp)", bId);
                        continue;
                    }

                    // Confirmed orphaned for at least 8760 hours and NOT_REFERENCED
                    bunnyStreamService.deleteVideo(bId);
                    if (videoRepository != null) {
                        videoRepository.findByBunnyVideoId(bId).ifPresent(videoRepository::delete);
                    }
                    orphanedBunnyVideoRepository.delete(orphan);
                    systemSettingRepository.delete(setting);
                    log.info("Successfully retried and reconciled failed video deletion for {}", bId);
                } catch (Exception ex) {
                    log.warn("Retry failed video deletion for {} still unsuccessful: {}", bId, sanitizeError(ex.getMessage()));
                }
            }
        } catch (Exception e) {
            log.error("Error during retryFailedDeletions: {}", sanitizeError(e.getMessage()));
        }
    }

    public void recordFailedDeletion(String fileId, String storagePath, String error) {
        if (systemSettingRepository == null || fileId == null) return;
        try {
            String key = "cleanup.failed." + fileId;
            String value = (storagePath != null ? storagePath : "") + "|" + error + "|" + OffsetDateTime.now();
            systemSettingRepository.save(new SystemSetting(key, value));
        } catch (Exception e) {
            log.error("Failed to record failed deletion setting for file {}: {}", fileId, sanitizeError(e.getMessage()));
        }
    }

    public void clearFailedDeletion(String fileId) {
        if (systemSettingRepository == null || fileId == null) return;
        try {
            String key = "cleanup.failed." + fileId;
            if (systemSettingRepository.existsById(key)) {
                systemSettingRepository.deleteById(key);
            }
        } catch (Exception ignored) {}
    }

    public void recordTombstone(String fileId, String storagePath, String reason) {
        if (systemSettingRepository == null || fileId == null) return;
        try {
            String key = "cleanup.tombstone." + fileId;
            String value = (storagePath != null ? storagePath : "") + "|" + reason + "|" + OffsetDateTime.now();
            systemSettingRepository.save(new SystemSetting(key, value));
        } catch (Exception e) {
            log.error("Failed to record tombstone for file {}: {}", fileId, sanitizeError(e.getMessage()));
        }
    }

    public void processSubmissionRetention(AssignmentSubmission sub, Set<String> activeRefs) {
        if (sub == null) return;
        boolean modified = false;

        if (sub.getAttachment() != null && !sub.getAttachment().isBlank()) {
            boolean handled = handleSubmissionAttachmentRetention(sub.getAttachment(), sub.getId(), activeRefs);
            if (handled) {
                sub.setAttachment(null);
                modified = true;
            }
        }

        if (sub.getCorrectionAttachment() != null && !sub.getCorrectionAttachment().isBlank()) {
            boolean handled = handleSubmissionAttachmentRetention(sub.getCorrectionAttachment(), sub.getId(), activeRefs);
            if (handled) {
                sub.setCorrectionAttachment(null);
                modified = true;
            }
        }

        if (sub.getCorrectedFileUrl() != null && !sub.getCorrectedFileUrl().isBlank()) {
            boolean handled = handleSubmissionAttachmentRetention(sub.getCorrectedFileUrl(), sub.getId(), activeRefs);
            if (handled) {
                sub.setCorrectedFileUrl(null);
                modified = true;
            }
        }

        if (modified) {
            submissionRepository.save(sub);
        }
    }

    private boolean handleSubmissionAttachmentRetention(String attachmentRef, String submissionId, Set<String> activeRefs) {
        if (attachmentRef == null || attachmentRef.isBlank()) return true;

        List<String> fileIds = extractUuidsFromText(attachmentRef);
        if (fileIds.isEmpty()) {
            String trimmed = attachmentRef.trim();
            if (storedFileRepository != null && storedFileRepository.existsById(trimmed)) {
                fileIds = List.of(trimmed);
            } else {
                return true;
            }
        }

        boolean allHandled = true;
        for (String fileId : fileIds) {
            Optional<StoredFile> fileOpt = (storedFileRepository != null) ? storedFileRepository.findById(fileId) : Optional.empty();
            if (fileOpt.isEmpty()) {
                // Section 3: Missing StoredFile metadata does not silently clear submission references
                log.warn("Retention policy: StoredFile metadata record missing for fileId={} in submission {}. Preserving attachment reference.", fileId, submissionId);
                allHandled = false;
                continue;
            }
            StoredFile file = fileOpt.get();
            String storagePath = file.getStoragePath();

            // Section 3: Check whether the file is referenced anywhere else in the application (excluding current submission)
            boolean sharedWithOtherEntities = isFileSharedOutsideSubmission(fileId, submissionId, storagePath, activeRefs);

            if (sharedWithOtherEntities) {
                log.info("Retention policy: File {} from submission {} is shared with other entities; retaining physical asset and unlinking submission reference.", fileId, submissionId);
                continue;
            }

            // Not referenced elsewhere: Attempt physical deletion FIRST from Bunny Storage
            boolean physicalDeleted = false;
            try {
                if (storagePath != null && !storagePath.isBlank() && storageProvider.exists(storagePath)) {
                    storageProvider.delete(storagePath);
                }
                physicalDeleted = true;
            } catch (Exception e) {
                log.error("Retention policy: Failed to physically delete file {} for submission {}: {}", fileId, submissionId, sanitizeError(e.getMessage()));
                recordFailedDeletion(fileId, storagePath, sanitizeError(e.getMessage()));
                allHandled = false;
            }

            if (physicalDeleted) {
                try {
                    storedFileRepository.delete(file);
                    clearFailedDeletion(fileId);
                    log.info("Retention policy: Deleted unreferenced submission file {} (path: {})", fileId, storagePath);
                } catch (Exception dbEx) {
                    log.error("Retention policy: Database metadata deletion failed for file {} after physical purge: {}", fileId, sanitizeError(dbEx.getMessage()));
                    recordTombstone(fileId, storagePath, "SUBMISSION_PURGED_PHYSICAL_DB_FAILED");
                }
            }
        }

        return allHandled;
    }

    public boolean isFileSharedOutsideSubmission(String fileId, String submissionId, String storagePath) {
        return isFileSharedOutsideSubmission(fileId, submissionId, storagePath, null);
    }

    public boolean isFileSharedOutsideSubmission(String fileId, String submissionId, String storagePath, Set<String> activeRefs) {
        // 1. Fail closed if fileStorageService is missing
        if (fileStorageService == null) {
            log.warn("fileStorageService is null during submission retention check for file {}. Failing closed (treating as protected).", fileId);
            return true;
        }

        // 2. Check if shared by multiple StoredFile records
        if (storedFileRepository != null && storagePath != null) {
            try {
                if (storedFileRepository.countByStoragePath(storagePath) > 1) {
                    log.info("File {} storagePath {} is shared by multiple StoredFile records.", fileId, storagePath);
                    return true;
                }
            } catch (Exception e) {
                log.error("Failed querying countByStoragePath for {}: {}. Failing closed.", storagePath, e.getMessage());
                return true;
            }
        }

        // 3. Check if referenced in any other submission (strictly excluding the current submission)
        if (submissionRepository != null) {
            try {
                boolean sharedInOtherSubmissions = submissionRepository.findAll().stream()
                        .filter(s -> !Objects.equals(s.getId(), submissionId))
                        .anyMatch(s -> (s.getAttachment() != null && s.getAttachment().contains(fileId))
                                || (s.getCorrectionAttachment() != null && s.getCorrectionAttachment().contains(fileId))
                                || (s.getCorrectedFileUrl() != null && s.getCorrectedFileUrl().contains(fileId)));
                if (sharedInOtherSubmissions) {
                    log.info("File {} is referenced by another submission outside submission {}.", fileId, submissionId);
                    return true;
                }
            } catch (Exception e) {
                log.error("Failed querying submissionRepository for file {}: {}. Failing closed.", fileId, e.getMessage());
                return true;
            }
        }

        // 4. Check all other application entities via FileStorageService (excluding the current submission)
        try {
            FileStorageService.ReferenceCheckResult refCheck = fileStorageService.checkEntityReferencesExcludingSubmission(fileId, storagePath, submissionId);
            if (refCheck != FileStorageService.ReferenceCheckResult.NOT_REFERENCED) {
                log.info("File {} is protected: entity reference check returned {}", fileId, refCheck);
                return true;
            }
        } catch (Exception e) {
            log.error("Exception checking entity references for file {}: {}. Failing closed.", fileId, e.getMessage());
            return true;
        }

        return false;
    }

    public List<String> extractUuidsFromText(String text) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        List<String> list = new ArrayList<>();
        Matcher matcher = UUID_PATTERN.matcher(text);
        while (matcher.find()) {
            list.add(matcher.group(1));
        }
        return list;
    }

    private void purgeFileFromText(String text) {
        if (text == null || text.isBlank()) return;
        List<String> ids = extractUuidsFromText(text);
        for (String id : ids) {
            try {
                fileStorageService.deleteFile(id);
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
