package com.zoroacademy.service;

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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
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

    @Value("${storage.cleanup.enabled:true}")
    private boolean cleanupEnabled;

    @Value("${storage.cleanup.dry-run:false}")
    private boolean dryRunDefault;

    @Value("${storage.cleanup.orphan-retention-hours:24}")
    private int defaultCutoffHours;

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
            @Autowired(required = false) FeedbackMediaRepository feedbackMediaRepository
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
    }

    @Scheduled(cron = "${storage.cleanup.cron:0 0 2 * * ?}")
    public void scheduledCleanup() {
        if (!cleanupEnabled) {
            log.info("Storage cleanup job is disabled by configuration.");
            return;
        }
        log.info("Executing scheduled storage cleanup job (dryRun={})...", dryRunDefault);
        try {
            CleanupResultDto result = runCleanup(dryRunDefault, defaultCutoffHours);
            log.info("Scheduled storage cleanup completed: {}", result.getMessage());
        } catch (Exception e) {
            log.error("Error during scheduled storage cleanup: {}", e.getMessage(), e);
        }
    }

    public CleanupResultDto runCleanup(boolean dryRun) {
        return runCleanup(dryRun, defaultCutoffHours);
    }

    @Transactional
    public CleanupResultDto runCleanup(boolean dryRun, int cutoffHours) {
        CleanupResultDto result = new CleanupResultDto();
        result.setDryRun(dryRun);
        result.setExecutionTime(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        Set<String> referencedItems = collectAllReferencedItems();
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(cutoffHours);

        long orphanedFilesFound = 0;
        long orphanedFilesDeleted = 0;
        long bytesReclaimed = 0;

        List<StoredFile> allFiles = storedFileRepository.findAll();
        for (StoredFile file : allFiles) {
            if (file.getCreatedAt() != null && file.getCreatedAt().isAfter(cutoff)) {
                continue; // Younger than cutoff window
            }

            boolean isReferenced = referencedItems.contains(file.getId())
                    || referencedItems.contains(file.getStoragePath())
                    || referencedItems.stream().anyMatch(ref -> ref.contains(file.getId()));

            if (!isReferenced) {
                orphanedFilesFound++;
                bytesReclaimed += (file.getSizeBytes() != null ? file.getSizeBytes() : 0);

                if (!dryRun) {
                    try {
                        String storagePath = file.getStoragePath();
                        storedFileRepository.delete(file);
                        if (storedFileRepository.countByStoragePath(storagePath) == 0) {
                            storageProvider.delete(storagePath);
                        }
                        orphanedFilesDeleted++;
                    } catch (Exception e) {
                        log.warn("Failed to delete orphaned file {}: {}", file.getId(), e.getMessage());
                    }
                }
            }
        }

        // 2. Orphaned Video Cleanup
        long orphanedVideosFound = 0;
        long orphanedVideosDeleted = 0;
        List<Video> allVideos = videoRepository.findAll();
        Set<String> activeModuleIds = new HashSet<>(courseModuleRepository.findAll().stream().map(m -> m.getId()).toList());

        for (Video v : allVideos) {
            if (v.getCreatedAt() != null && v.getCreatedAt().isAfter(LocalDateTime.now().minusHours(cutoffHours))) {
                continue;
            }

            boolean hasModule = v.getModuleId() != null && activeModuleIds.contains(v.getModuleId());
            boolean isReferenced = hasModule || (v.getBunnyVideoId() != null && referencedItems.contains(v.getBunnyVideoId()));

            if (!isReferenced) {
                orphanedVideosFound++;
                if (!dryRun) {
                    try {
                        bunnyStreamService.deleteVideo(v.getBunnyVideoId());
                        videoRepository.delete(v);
                        orphanedVideosDeleted++;
                    } catch (Exception e) {
                        log.warn("Failed to delete orphaned video {}: {}", v.getBunnyVideoId(), e.getMessage());
                    }
                }
            }
        }

        // 3. Student Submission Retention (Requirement C5)
        long submissionsPurged = 0;
        int retentionMonths = getSubmissionRetentionMonths();
        if (retentionMonths > 0) {
            LocalDateTime retentionCutoff = LocalDateTime.now().minusMonths(retentionMonths);
            List<AssignmentSubmission> submissions = submissionRepository.findAll();
            for (AssignmentSubmission sub : submissions) {
                LocalDateTime subDate = sub.getCreatedAt() != null ? sub.getCreatedAt() : sub.getUpdatedAt();
                if (subDate != null && subDate.isBefore(retentionCutoff)) {
                    if (sub.getAttachment() != null || sub.getCorrectionAttachment() != null) {
                        submissionsPurged++;
                        if (!dryRun) {
                            if (sub.getAttachment() != null) {
                                purgeFileFromText(sub.getAttachment());
                                sub.setAttachment(null);
                            }
                            if (sub.getCorrectionAttachment() != null) {
                                purgeFileFromText(sub.getCorrectionAttachment());
                                sub.setCorrectionAttachment(null);
                            }
                            submissionRepository.save(sub);
                        }
                    }
                }
            }
        }

        result.setOrphanedFilesFound(orphanedFilesFound);
        result.setOrphanedFilesDeleted(orphanedFilesDeleted);
        result.setOrphanedVideosFound(orphanedVideosFound);
        result.setOrphanedVideosDeleted(orphanedVideosDeleted);
        result.setSubmissionsPurged(submissionsPurged);
        result.setBytesReclaimed(bytesReclaimed);

        String msg = String.format("%s completed: %d files %s (%s bytes), %d videos %s, %d submissions purged.",
                dryRun ? "Dry-run scan" : "Cleanup purge",
                dryRun ? orphanedFilesFound : orphanedFilesDeleted,
                dryRun ? "flagged as orphans" : "permanently deleted",
                formatBytes(bytesReclaimed),
                dryRun ? orphanedVideosFound : orphanedVideosDeleted,
                dryRun ? "flagged as orphans" : "permanently deleted",
                submissionsPurged);
        result.setMessage(msg);

        this.lastCleanupTimestamp = OffsetDateTime.now();
        this.lastCleanupResult = result;

        return result;
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

        // Run lightweight orphan preview
        Set<String> activeRefs = collectAllReferencedItems();
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(defaultCutoffHours);
        long orphanCount = 0;
        long orphanBytes = 0;

        for (StoredFile f : files) {
            if (f.getCreatedAt() != null && f.getCreatedAt().isAfter(cutoff)) continue;
            boolean isRef = activeRefs.contains(f.getId())
                    || activeRefs.contains(f.getStoragePath())
                    || activeRefs.stream().anyMatch(r -> r.contains(f.getId()));
            if (!isRef) {
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

    @Transactional
    public void setSubmissionRetentionMonths(int months) {
        SystemSetting setting = systemSettingRepository.findById("submission_retention_months")
                .orElse(new SystemSetting("submission_retention_months", "0"));
        setting.setSettingValue(String.valueOf(Math.max(0, months)));
        systemSettingRepository.save(setting);
    }

    private Set<String> collectAllReferencedItems() {
        Set<String> refs = new HashSet<>();

        // Modules
        courseModuleRepository.findAll().forEach(m -> {
            extractRefs(m.getThumbnailUrl(), refs);
            extractRefs(m.getNotesFileUrl(), refs);
            extractRefs(m.getWorksheetFileUrl(), refs);
            extractRefs(m.getAssignmentFileUrl(), refs);
            extractRefs(m.getVideoStorageRef(), refs);
        });

        // Courses
        courseRepository.findAll().forEach(c -> {
            extractRefs(c.getThumbnail(), refs);
            extractRefs(c.getPreviewVideoUrl(), refs);
        });

        // Schedules
        scheduleRepository.findAll().forEach(s -> {
            extractRefs(s.getNotesFileUrl(), refs);
            extractRefs(s.getWorksheetFileUrl(), refs);
            extractRefs(s.getAssignmentFileUrl(), refs);
        });

        // Submissions
        submissionRepository.findAll().forEach(sub -> {
            extractRefs(sub.getAttachment(), refs);
            extractRefs(sub.getCorrectionAttachment(), refs);
        });

        // Assignments
        assignmentRepository.findAll().forEach(a -> {
            extractRefs(a.getAttachment(), refs);
        });

        // Users
        userRepository.findAll().forEach(u -> {
            extractRefs(u.getAvatar(), refs);
        });

        // Competitions
        competitionRepository.findAll().forEach(comp -> {
            extractRefs(comp.getRulesPdfUrl(), refs);
            extractRefs(comp.getBannerUrl(), refs);
        });

        // Website Settings
        websiteSettingsRepository.findAll().forEach(ws -> {
            extractRefs(ws.getSettingsJson(), refs);
            extractRefs(ws.getHeroHeadline(), refs);
            extractRefs(ws.getBannerAnnouncement(), refs);
        });

        // Hero Background Images (Requirement I6)
        if (heroImageRepository != null) {
            heroImageRepository.findAll().forEach(hero -> {
                extractRefs(hero.getUrl(), refs);
                extractRefs(hero.getStorageKey(), refs);
            });
        }

        // Feedback Media (Requirement I6)
        if (feedbackMediaRepository != null) {
            feedbackMediaRepository.findAll().forEach(fm -> {
                extractRefs(fm.getUrl(), refs);
                extractRefs(fm.getThumbnailUrl(), refs);
                extractRefs(fm.getStoredFileId(), refs);
                extractRefs(fm.getBunnyVideoId(), refs);
            });
        }

        return refs;
    }

    private void extractRefs(String text, Set<String> refs) {
        if (text == null || text.isBlank()) return;
        refs.add(text.trim());
        Matcher matcher = UUID_PATTERN.matcher(text);
        while (matcher.find()) {
            refs.add(matcher.group(1));
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

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format("%.2f %sB", bytes / Math.pow(1024, exp), pre);
    }
}
