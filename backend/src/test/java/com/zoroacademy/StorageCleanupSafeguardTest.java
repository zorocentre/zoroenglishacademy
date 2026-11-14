package com.zoroacademy;

import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.entity.FeedbackMedia;
import com.zoroacademy.entity.HeroImage;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.FileStorageService;
import com.zoroacademy.service.StorageCleanupService;
import com.zoroacademy.service.storage.StorageProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

public class StorageCleanupSafeguardTest {

    private StoredFileRepository storedFileRepository;
    private StorageProvider storageProvider;
    private FileStorageService fileStorageService;
    private CourseRepository courseRepository;
    private CourseModuleRepository courseModuleRepository;
    private ScheduleRepository scheduleRepository;
    private AssignmentRepository assignmentRepository;
    private AssignmentSubmissionRepository submissionRepository;
    private UserRepository userRepository;
    private CompetitionRepository competitionRepository;
    private WebsiteSettingsRepository websiteSettingsRepository;
    private VideoRepository videoRepository;
    private com.zoroacademy.service.BunnyStreamService bunnyStreamService;
    private SystemSettingRepository systemSettingRepository;
    private HeroImageRepository heroImageRepository;
    private FeedbackMediaRepository feedbackMediaRepository;

    private StorageCleanupService storageCleanupService;

    @BeforeEach
    void setUp() {
        storedFileRepository = Mockito.mock(StoredFileRepository.class);
        storageProvider = Mockito.mock(StorageProvider.class);
        fileStorageService = Mockito.mock(FileStorageService.class);
        courseRepository = Mockito.mock(CourseRepository.class);
        courseModuleRepository = Mockito.mock(CourseModuleRepository.class);
        scheduleRepository = Mockito.mock(ScheduleRepository.class);
        assignmentRepository = Mockito.mock(AssignmentRepository.class);
        submissionRepository = Mockito.mock(AssignmentSubmissionRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        competitionRepository = Mockito.mock(CompetitionRepository.class);
        websiteSettingsRepository = Mockito.mock(WebsiteSettingsRepository.class);
        videoRepository = Mockito.mock(VideoRepository.class);
        bunnyStreamService = Mockito.mock(com.zoroacademy.service.BunnyStreamService.class);
        systemSettingRepository = Mockito.mock(SystemSettingRepository.class);
        heroImageRepository = Mockito.mock(HeroImageRepository.class);
        feedbackMediaRepository = Mockito.mock(FeedbackMediaRepository.class);

        storageCleanupService = new StorageCleanupService(
                storedFileRepository,
                storageProvider,
                fileStorageService,
                courseRepository,
                courseModuleRepository,
                scheduleRepository,
                assignmentRepository,
                submissionRepository,
                userRepository,
                competitionRepository,
                websiteSettingsRepository,
                videoRepository,
                bunnyStreamService,
                systemSettingRepository,
                heroImageRepository,
                feedbackMediaRepository
        );

        // Standard empty returns for unrelated repositories
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(scheduleRepository.findAll()).thenReturn(Collections.emptyList());
        when(assignmentRepository.findAll()).thenReturn(Collections.emptyList());
        when(submissionRepository.findAll()).thenReturn(Collections.emptyList());
        when(userRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionRepository.findAll()).thenReturn(Collections.emptyList());
        when(websiteSettingsRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());
    }

    @Test
    @DisplayName("Safeguard: Hero images and Feedback media files older than 24h are NEVER deleted, genuine orphans ARE deleted")
    void testHeroAndFeedbackFilesProtectedFromCleanup() {
        OffsetDateTime olderThan24Hours = OffsetDateTime.now().minusHours(48);

        // 1. Hero Image StoredFile
        StoredFile heroFile = new StoredFile(
                "33333333-3333-3333-3333-333333333333",
                "hero_bg.webp",
                "image/webp",
                204800L,
                "hero",
                "usr_admin",
                "public/hero/33333333-3333-3333-3333-333333333333.webp",
                true,
                "sha_hero",
                1
        );
        heroFile.setCreatedAt(olderThan24Hours);

        HeroImage heroImage = new HeroImage(
                "hero_1",
                "/api/files/33333333-3333-3333-3333-333333333333",
                "33333333-3333-3333-3333-333333333333",
                0,
                "Hero Background",
                true
        );
        when(heroImageRepository.findAll()).thenReturn(List.of(heroImage));

        // 2. Feedback Media StoredFile
        StoredFile feedbackFile = new StoredFile(
                "44444444-4444-4444-4444-444444444444",
                "student_feedback.jpg",
                "image/jpeg",
                102400L,
                "feedback",
                "usr_admin",
                "public/feedback/44444444-4444-4444-4444-444444444444.jpg",
                true,
                "sha_feedback",
                1
        );
        feedbackFile.setCreatedAt(olderThan24Hours);

        FeedbackMedia feedbackMedia = new FeedbackMedia(
                "fbm_1",
                "IMAGE",
                "44444444-4444-4444-4444-444444444444",
                null,
                "/api/files/44444444-4444-4444-4444-444444444444",
                null,
                "student_feedback.jpg",
                "image/jpeg",
                102400L,
                0,
                "READY",
                "usr_admin"
        );
        when(feedbackMediaRepository.findAll()).thenReturn(List.of(feedbackMedia));

        // 3. Genuinely Unreferenced Orphan File
        StoredFile orphanFile = new StoredFile(
                "99999999-9999-9999-9999-999999999999",
                "abandoned.tmp",
                "text/plain",
                512L,
                "temp",
                "usr_admin",
                "private/temp/99999999-9999-9999-9999-999999999999.tmp",
                false,
                "sha_orphan",
                1
        );
        orphanFile.setCreatedAt(olderThan24Hours);

        // All 3 files exist in stored_files and are older than 24h
        when(storedFileRepository.findAll()).thenReturn(List.of(heroFile, feedbackFile, orphanFile));

        // Run dry-run cleanup with 24h cutoff
        CleanupResultDto result = storageCleanupService.runCleanup(true, 24);

        // Verification: Exactly 1 file (the genuine orphan) was flagged; hero and feedback files were protected
        assertEquals(1, result.getOrphanedFilesFound(), "Only the unreferenced file should be flagged as orphan");
        assertEquals(512L, result.getBytesReclaimed(), "Reclaimed bytes should match only the orphan file");
        assertEquals(0, result.getOrphanedFilesDeleted(), "In dry-run, no files should be deleted");
    }
}
