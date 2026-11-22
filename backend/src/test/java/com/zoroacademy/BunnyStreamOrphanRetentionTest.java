package com.zoroacademy;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.controller.VideoController;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.*;
import com.zoroacademy.service.storage.StorageProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BunnyStreamOrphanRetentionTest {

    @Mock private BunnyStreamService bunnyStreamService;
    @Mock private OrphanedBunnyVideoRepository orphanedBunnyVideoRepository;
    @Mock private VideoRepository videoRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private CourseModuleRepository courseModuleRepository;
    @Mock private CourseResourceRepository courseResourceRepository;
    @Mock private UserRepository userRepository;
    @Mock private BatchRepository batchRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private StudentCourseBatchRepository studentCourseBatchRepository;
    @Mock private StudentFeeRepository studentFeeRepository;
    @Mock private ScheduleRepository scheduleRepository;
    @Mock private AssignmentRepository assignmentRepository;
    @Mock private AssignmentSubmissionRepository submissionRepository;
    @Mock private DoubtRepository doubtRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private StudentProgressRepository studentProgressRepository;
    @Mock private StudentModuleProgressRepository studentModuleProgressRepository;
    @Mock private FeedbackMediaRepository feedbackMediaRepository;
    @Mock private CompetitionGuidanceVideoRepository guidanceVideoRepository;
    @Mock private SystemSettingRepository systemSettingRepository;
    @Mock private StoredFileRepository storedFileRepository;
    @Mock private StorageProvider storageProvider;

    private CourseService courseService;
    private FeedbackMediaService feedbackMediaService;
    private CompetitionService competitionService;
    private StorageCleanupService cleanupService;
    private VideoController videoController;

    @BeforeEach
    void setUp() {
        courseService = new CourseService(
                courseRepository,
                courseModuleRepository,
                courseResourceRepository,
                userRepository,
                batchRepository,
                enrollmentRepository,
                studentCourseBatchRepository,
                studentFeeRepository,
                scheduleRepository,
                assignmentRepository,
                doubtRepository,
                bunnyStreamService,
                fileStorageService,
                videoRepository,
                studentProgressRepository,
                studentModuleProgressRepository,
                submissionRepository
        );

        feedbackMediaService = new FeedbackMediaService(
                feedbackMediaRepository,
                fileStorageService,
                bunnyStreamService,
                mock(BunnyTokenService.class)
        );

        competitionService = new CompetitionService(
                mock(CompetitionRepository.class),
                mock(CompetitionModuleRepository.class),
                mock(CompetitionRegistrationRepository.class),
                userRepository,
                fileStorageService,
                mock(CompetitionSetRepository.class),
                mock(CompetitionSetMemberRepository.class),
                mock(CompetitionSyllabusRepository.class),
                guidanceVideoRepository,
                mock(CompetitionStudyMaterialRepository.class),
                mock(CompetitionAssessmentRepository.class),
                mock(AssessmentQuestionRepository.class),
                mock(QuestionOptionRepository.class),
                mock(AssessmentEvaluationCriteriaRepository.class),
                storedFileRepository
        );
        try {
            java.lang.reflect.Field streamField = CompetitionService.class.getDeclaredField("bunnyStreamService");
            streamField.setAccessible(true);
            streamField.set(competitionService, bunnyStreamService);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        cleanupService = new StorageCleanupService(
                storedFileRepository,
                storageProvider,
                fileStorageService,
                courseRepository,
                courseModuleRepository,
                scheduleRepository,
                assignmentRepository,
                submissionRepository,
                userRepository,
                mock(CompetitionRepository.class),
                mock(WebsiteSettingsRepository.class),
                videoRepository,
                bunnyStreamService,
                systemSettingRepository,
                mock(HeroImageRepository.class),
                feedbackMediaRepository,
                mock(AssessmentQuestionRepository.class),
                mock(AttemptAnswerRepository.class),
                mock(CompetitionStudyMaterialRepository.class),
                mock(CompetitionSyllabusRepository.class),
                guidanceVideoRepository,
                mock(CourseResourceRepository.class),
                mock(ExpenseRepository.class),
                mock(CompetitionRegistrationRepository.class),
                mock(CompetitionModuleRepository.class)
        );
        cleanupService.setOrphanedBunnyVideoRepository(orphanedBunnyVideoRepository);
        try {
            java.lang.reflect.Field field = StorageCleanupService.class.getDeclaredField("livePurgeAllowed");
            field.setAccessible(true);
            field.set(cleanupService, true);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        videoController = new VideoController(bunnyStreamService);
    }

    @Test
    @DisplayName("1. Deleting a course does not immediately delete its Bunny Stream videos")
    void testDeleteCourseDoesNotImmediatelyDeleteVideos() {
        String courseId = "course-123";
        Course course = new Course();
        course.setId(courseId);
        course.setTitle("Spoken English Mastery");
        course.setMode("Online");

        CourseModule module = new CourseModule();
        module.setId("mod-1");
        module.setCourse(course);
        course.setModules(List.of(module));

        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));

        Video v1 = new Video();
        v1.setId("vid-1");
        v1.setBunnyVideoId("bunny-course-vid-1");
        v1.setTitle("Intro Video");

        when(videoRepository.findByModuleId("mod-1")).thenReturn(List.of(v1));
        when(videoRepository.findByCourseId(courseId)).thenReturn(List.of(v1));

        courseService.deleteCourse(courseId);

        // Verification: physical deleteVideo is NEVER called
        verify(bunnyStreamService, never()).deleteVideo(anyString());
        // Verification: recordOrphan is called to track 1-year retention
        verify(bunnyStreamService, atLeastOnce()).recordOrphan(eq("bunny-course-vid-1"), eq("COURSE_MODULE"), any(), any());
    }

    @Test
    @DisplayName("2. Deleting a module does not immediately delete its Bunny Stream videos")
    void testDeleteModuleDoesNotImmediatelyDeleteVideos() {
        String courseId = "course-123";
        String moduleId = "mod-2";
        Course course = new Course();
        course.setId(courseId);

        CourseModule module = new CourseModule();
        module.setId(moduleId);
        module.setCourse(course);
        module.setTitle("Grammar Basics");
        module.setVideoStorageRef("{\"videoId\": \"bunny-mod-vid-2\"}");

        when(courseModuleRepository.findById(moduleId)).thenReturn(Optional.of(module));
        when(courseModuleRepository.findByCourseIdOrderByModuleOrderAsc(courseId)).thenReturn(Collections.emptyList());

        Video v2 = new Video();
        v2.setId("vid-2");
        v2.setBunnyVideoId("bunny-mod-vid-2");
        v2.setTitle("Grammar Video");
        when(videoRepository.findByModuleId(moduleId)).thenReturn(List.of(v2));

        courseService.deleteModule(courseId, moduleId);

        verify(bunnyStreamService, never()).deleteVideo(anyString());
        verify(bunnyStreamService, atLeastOnce()).recordOrphan(eq("bunny-mod-vid-2"), eq("COURSE_MODULE"), any(), eq(moduleId));
    }

    @Test
    @DisplayName("3. Replacing a module video does not immediately delete the previous Bunny Stream video")
    void testReplaceModuleVideoDoesNotImmediatelyDeletePreviousVideo() {
        String courseId = "course-123";
        String moduleId = "mod-3";
        Course course = new Course();
        course.setId(courseId);

        CourseModule existing = new CourseModule();
        existing.setId(moduleId);
        existing.setCourse(course);
        existing.setVideoStorageRef("{\"videoId\": \"bunny-old-vid\"}");

        when(courseModuleRepository.findById(moduleId)).thenReturn(Optional.of(existing));
        when(courseModuleRepository.save(any(CourseModule.class))).thenAnswer(i -> i.getArgument(0));

        CourseModule update = new CourseModule();
        update.setVideoStorageRef("{\"videoId\": \"bunny-new-vid\"}");

        courseService.updateModule(courseId, moduleId, update);

        // Physical deletion of old video is NOT executed
        verify(bunnyStreamService, never()).deleteVideo("bunny-old-vid");
        // Replaced video is recorded as an orphan with 365-day retention
        verify(bunnyStreamService, times(1)).recordOrphan(eq("bunny-old-vid"), eq("COURSE_MODULE"), anyString(), eq(moduleId));
    }

    @Test
    @DisplayName("4. Deleting feedback video metadata does not immediately delete its Bunny Stream video")
    void testDeleteFeedbackVideoMetadataDoesNotImmediatelyDeleteVideo() {
        String mediaId = "fb-vid-1";
        FeedbackMedia media = new FeedbackMedia();
        media.setId(mediaId);
        media.setMediaType("VIDEO");
        media.setBunnyVideoId("bunny-feedback-vid-1");
        media.setOriginalFileName("testimonial.mp4");

        when(feedbackMediaRepository.findById(mediaId)).thenReturn(Optional.of(media));
        when(feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc()).thenReturn(Collections.emptyList());

        feedbackMediaService.deleteMedia(mediaId);

        // Physical video is NOT deleted immediately
        verify(bunnyStreamService, never()).deleteVideo("bunny-feedback-vid-1");
        // Tracked as orphan with category FEEDBACK
        verify(bunnyStreamService, times(1)).recordOrphan(eq("bunny-feedback-vid-1"), eq("FEEDBACK"), eq("testimonial.mp4"), eq(mediaId));
    }

    @Test
    @DisplayName("5. Replacing competition guidance video does not immediately delete the previous video")
    void testReplaceCompetitionGuidanceVideoDoesNotImmediatelyDeletePreviousVideo() {
        String guidanceId = "guidance-1";
        CompetitionGuidanceVideo gv = new CompetitionGuidanceVideo();
        gv.setId(guidanceId);
        gv.setBunnyVideoId("bunny-old-guidance-vid");
        gv.setTitle("Old Guidance Video");

        when(guidanceVideoRepository.findById(guidanceId)).thenReturn(Optional.of(gv));
        when(bunnyStreamService.uploadVideoBinary(any(), anyString())).thenReturn(Map.of("bunnyVideoId", "bunny-new-guidance-vid"));
        when(guidanceVideoRepository.save(any(CompetitionGuidanceVideo.class))).thenAnswer(i -> i.getArgument(0));

        MockMultipartFile file = new MockMultipartFile("file", "guidance.mp4", "video/mp4", new byte[]{1, 2, 3});
        competitionService.replaceGuidanceVideoFile(guidanceId, file, "Updated Guidance");

        // Old video is NOT immediately deleted
        verify(bunnyStreamService, never()).deleteVideo("bunny-old-guidance-vid");
        // Old video is recorded as orphan
        verify(bunnyStreamService, times(1)).recordOrphan(eq("bunny-old-guidance-vid"), eq("COMPETITION_GUIDANCE"), anyString(), eq(guidanceId));
    }

    @Test
    @DisplayName("6. Deleting competition guidance metadata does not immediately delete its Bunny Stream video")
    void testDeleteCompetitionGuidanceMetadataDoesNotImmediatelyDeleteVideo() {
        String guidanceId = "guidance-2";
        CompetitionGuidanceVideo gv = new CompetitionGuidanceVideo();
        gv.setId(guidanceId);
        gv.setBunnyVideoId("bunny-guidance-del-vid");
        gv.setTitle("Guidance Video To Delete");

        when(guidanceVideoRepository.findById(guidanceId)).thenReturn(Optional.of(gv));

        competitionService.deleteGuidanceVideo(guidanceId);

        verify(bunnyStreamService, never()).deleteVideo("bunny-guidance-del-vid");
        verify(bunnyStreamService, times(1)).recordOrphan(eq("bunny-guidance-del-vid"), eq("COMPETITION_GUIDANCE"), anyString(), eq(guidanceId));
        verify(guidanceVideoRepository, times(1)).delete(gv);
    }

    @Test
    @DisplayName("7. Orphaned videos younger than 365 days are retained")
    void testOrphanedVideosYoungerThan365DaysAreRetained() {
        String bId = "bunny-recent-orphan";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Recent Video",
                "mod-recent",
                OffsetDateTime.now().minusDays(100) // 100 days old < 365 days
        );

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        // Run live cleanup with 8760 cutoff
        cleanupService.runCleanup(false, 8760, true);

        // Must NOT be deleted because it is younger than 365 days!
        verify(bunnyStreamService, never()).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, never()).delete(orphan);
    }

    @Test
    @DisplayName("8. Orphaned videos older than 365 days are eligible for cleanup")
    void testOrphanedVideosOlderThan365DaysAreEligibleForCleanup() {
        String bId = "bunny-expired-orphan";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Expired Video",
                "mod-exp",
                OffsetDateTime.now().minusDays(366) // 366 days old >= 365 days
        );

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        // Run live cleanup
        cleanupService.runCleanup(false, 8760, true);

        // Must be deleted from Bunny Stream and orphan tracking removed
        verify(bunnyStreamService, times(1)).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, times(1)).delete(orphan);
    }

    @Test
    @DisplayName("9. Referenced videos are never deleted")
    void testReferencedVideosAreNeverDeleted() {
        String bId = "bunny-active-vid";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Active Video",
                "mod-active",
                OffsetDateTime.now().minusDays(400) // 400 days old
        );

        CourseModule activeModule = new CourseModule();
        activeModule.setId("mod-active");
        activeModule.setVideoStorageRef("{\"videoId\": \"bunny-active-vid\"}");

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        when(courseModuleRepository.findAll()).thenReturn(List.of(activeModule));
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        cleanupService.runCleanup(false, 8760, true);

        // Referenced video MUST NEVER be deleted!
        verify(bunnyStreamService, never()).deleteVideo(bId);
    }

    @Test
    @DisplayName("10. Unknown reference status prevents deletion")
    void testUnknownReferenceStatusPreventsDeletion() {
        String bId = "bunny-unknown-vid";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Video With DB Failure",
                "mod-unknown",
                OffsetDateTime.now().minusDays(400)
        );

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        // Repository failure causes UNKNOWN
        when(courseModuleRepository.findAll()).thenThrow(new RuntimeException("Database connection failed"));

        cleanupService.runCleanup(false, 8760, true);

        // UNKNOWN reference status MUST retain video
        verify(bunnyStreamService, never()).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, never()).delete(orphan);
    }

    @Test
    @DisplayName("11. Failed Bunny deletion preserves retry metadata")
    void testFailedBunnyDeletionPreservesRetryMetadata() {
        String bId = "bunny-fail-vid";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Video Failing API",
                "mod-fail",
                OffsetDateTime.now().minusDays(400)
        );

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        // Bunny API fails
        doThrow(new RuntimeException("Bunny 500 Internal Error")).when(bunnyStreamService).deleteVideo(bId);

        cleanupService.runCleanup(false, 8760, true);

        // Metadata preserved
        verify(orphanedBunnyVideoRepository, never()).delete(orphan);
        // Durable failure recorded in system settings
        verify(systemSettingRepository, atLeastOnce()).save(argThat(s ->
                s.getSettingKey() != null && s.getSettingKey().equals("cleanup.failed.video." + bId)));
    }

    @Test
    @DisplayName("12. Repeated cleanup does not create duplicate deletion operations")
    void testRepeatedCleanupDoesNotCreateDuplicateDeletionOperations() {
        String bId = "bunny-repeat-vid";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Repeat Test Video",
                "mod-rep",
                OffsetDateTime.now().minusDays(400)
        );

        // First run returns the orphan, second run returns empty list (already deleted)
        when(orphanedBunnyVideoRepository.findAll())
                .thenReturn(List.of(orphan))
                .thenReturn(Collections.emptyList());
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        // Run cleanup twice
        cleanupService.runCleanup(false, 8760, true);
        cleanupService.runCleanup(false, 8760, true);

        // deleteVideo was called only once!
        verify(bunnyStreamService, times(1)).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, times(1)).delete(orphan);
    }

    @Test
    @DisplayName("13. Existing explicit admin deletion continues to work")
    void testExistingExplicitAdminDeletionContinuesToWork() {
        String videoId = "explicit-admin-del-vid";

        ApiResponse<Void> response = videoController.deleteVideo(videoId);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        verify(bunnyStreamService, times(1)).deleteVideo(videoId);
    }

    @Test
    @DisplayName("14. Bunny Storage file cleanup continues to work independently")
    void testBunnyStorageFileCleanupContinuesToWorkIndependently() {
        // Bunny Storage file: unreferenced, older than 168 hours
        String fileId = "file-expired-1";
        String storagePath = "public/documents/expired.pdf";
        StoredFile expiredFile = new StoredFile(fileId, "expired.pdf", "application/pdf", 1024L, "documents", "admin", storagePath, true, "hash", 1);
        expiredFile.setCreatedAt(OffsetDateTime.now().minusHours(200));

        when(storedFileRepository.findAll()).thenReturn(List.of(expiredFile));
        when(storedFileRepository.countByStoragePath(storagePath)).thenReturn(1L);
        when(fileStorageService.checkEntityReferences(fileId, storagePath)).thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storageProvider.exists(storagePath)).thenReturn(true);

        // Bunny Stream video: unreferenced, but only 100 days old (< 365 days)
        String bId = "bunny-recent-100d";
        OrphanedBunnyVideo recentVideo = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Recent Video",
                "mod-1",
                OffsetDateTime.now().minusDays(100)
        );
        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(recentVideo));

        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        // Run cleanup with cutoff = 168 hours
        CleanupResultDto result = cleanupService.runCleanup(false, 168, true);

        // Bunny Storage file IS cleaned up
        verify(storageProvider, times(1)).delete(storagePath);
        verify(storedFileRepository, times(1)).delete(expiredFile);

        // Bunny Stream video IS RETAINED (1-year policy protects it independently)
        verify(bunnyStreamService, never()).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, never()).delete(recentVideo);
    }

    @Test
    @DisplayName("15. BunnyStreamService.deleteVideo propagates API failure and preserves local metadata")
    void testBunnyStreamServiceDeleteVideoFailurePreservesMetadataAndThrows() throws Exception {
        org.springframework.web.client.RestTemplate mockRest = mock(org.springframework.web.client.RestTemplate.class);
        com.zoroacademy.config.BunnyStreamProperties props = new com.zoroacademy.config.BunnyStreamProperties();
        props.setLibraryId("12345");
        props.setApiKey("test-api-key");

        BunnyStreamService realService = new BunnyStreamService(
                props,
                mock(BunnyTokenService.class),
                videoRepository,
                mock(EnrollmentRepository.class),
                mock(CourseModuleRepository.class)
        );
        java.lang.reflect.Field restField = BunnyStreamService.class.getDeclaredField("restTemplate");
        restField.setAccessible(true);
        restField.set(realService, mockRest);
        realService.setOrphanedBunnyVideoRepository(orphanedBunnyVideoRepository);

        String bId = "vid-fail-123";
        Video v = new Video();
        v.setId("v1");
        v.setBunnyVideoId(bId);
        v.setLibraryId(12345);
        when(videoRepository.findById(bId)).thenReturn(Optional.of(v));

        when(mockRest.exchange(anyString(), eq(org.springframework.http.HttpMethod.DELETE), any(), eq(Void.class)))
                .thenThrow(new RuntimeException("503 Service Unavailable"));

        // Must throw and NOT swallow
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> realService.deleteVideo(bId));
        assertTrue(thrown.getMessage().contains("Bunny Stream API deletion failed"));

        // Local Video entity MUST NOT be deleted
        verify(videoRepository, never()).delete(v);
        // Orphan tracking MUST NOT be deleted
        verify(orphanedBunnyVideoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("16. BunnyStreamService.deleteVideo removes local metadata only after confirmed remote deletion")
    void testBunnyStreamServiceDeleteVideoSuccessRemovesMetadata() throws Exception {
        org.springframework.web.client.RestTemplate mockRest = mock(org.springframework.web.client.RestTemplate.class);
        com.zoroacademy.config.BunnyStreamProperties props = new com.zoroacademy.config.BunnyStreamProperties();
        props.setLibraryId("12345");
        props.setApiKey("test-api-key");

        BunnyStreamService realService = new BunnyStreamService(
                props,
                mock(BunnyTokenService.class),
                videoRepository,
                mock(EnrollmentRepository.class),
                mock(CourseModuleRepository.class)
        );
        java.lang.reflect.Field restField = BunnyStreamService.class.getDeclaredField("restTemplate");
        restField.setAccessible(true);
        restField.set(realService, mockRest);
        realService.setOrphanedBunnyVideoRepository(orphanedBunnyVideoRepository);

        String bId = "vid-success-123";
        Video v = new Video();
        v.setId("v1");
        v.setBunnyVideoId(bId);
        v.setLibraryId(12345);
        when(videoRepository.findById(bId)).thenReturn(Optional.of(v));

        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(bId, "COURSE_MODULE", "Title", "mod1", OffsetDateTime.now());
        when(orphanedBunnyVideoRepository.findByBunnyVideoId(bId)).thenReturn(Optional.of(orphan));

        realService.deleteVideo(bId);

        // Local records deleted upon success
        verify(videoRepository, times(1)).delete(v);
        verify(orphanedBunnyVideoRepository, times(1)).delete(orphan);
    }

    @Test
    @DisplayName("17. BunnyStreamService.recordOrphan preserves original timestamp on duplicate registration")
    void testRecordOrphanPreservesOriginalTimestamp() {
        com.zoroacademy.config.BunnyStreamProperties props = new com.zoroacademy.config.BunnyStreamProperties();
        BunnyStreamService realService = new BunnyStreamService(
                props,
                mock(BunnyTokenService.class),
                videoRepository,
                mock(EnrollmentRepository.class),
                mock(CourseModuleRepository.class)
        );
        realService.setOrphanedBunnyVideoRepository(orphanedBunnyVideoRepository);

        String bId = "vid-dup-123";
        OffsetDateTime originalDate = OffsetDateTime.now().minusDays(100);
        OrphanedBunnyVideo existingOrphan = new OrphanedBunnyVideo(bId, "COURSE_MODULE", "Old Title", "mod1", originalDate);

        when(orphanedBunnyVideoRepository.findByBunnyVideoId(bId)).thenReturn(Optional.of(existingOrphan));

        // Re-record orphan with now()
        realService.recordOrphan(bId, "COURSE_MODULE", "New Title", "mod2", OffsetDateTime.now());

        // Original date preserved, not overwritten
        assertEquals(originalDate, existingOrphan.getOrphanedAt());
        verify(orphanedBunnyVideoRepository, never()).save(argThat(o -> o != existingOrphan));
    }

    @Test
    @DisplayName("18. BunnyStreamService.recordOrphan propagates repository failures and requires repository")
    void testRecordOrphanPropagatesFailures() {
        com.zoroacademy.config.BunnyStreamProperties props = new com.zoroacademy.config.BunnyStreamProperties();
        BunnyStreamService realService = new BunnyStreamService(
                props,
                mock(BunnyTokenService.class),
                videoRepository,
                mock(EnrollmentRepository.class),
                mock(CourseModuleRepository.class)
        );

        // Missing repository throws IllegalStateException
        assertThrows(IllegalStateException.class, () ->
                realService.recordOrphan("vid-1", "COURSE_MODULE", "Title", "mod1"));

        // Repository DB failure throws RuntimeException
        realService.setOrphanedBunnyVideoRepository(orphanedBunnyVideoRepository);
        when(orphanedBunnyVideoRepository.findByBunnyVideoId("vid-1")).thenThrow(new RuntimeException("DB Connection Timeout"));
        assertThrows(RuntimeException.class, () ->
                realService.recordOrphan("vid-1", "COURSE_MODULE", "Title", "mod1"));
    }

    @Test
    @DisplayName("19. StorageCleanupService preserves videos with null orphanedAt timestamp")
    void testNullOrphanTimestampIsPreservedAndNotDeleted() {
        String bId = "bunny-null-timestamp";
        OrphanedBunnyVideo orphan = new OrphanedBunnyVideo(
                bId,
                "COURSE_MODULE",
                "Video With Null Timestamp",
                "mod-null",
                null
        );
        orphan.setOrphanedAt(null); // Explicit null timestamp

        when(orphanedBunnyVideoRepository.findAll()).thenReturn(List.of(orphan));
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());

        cleanupService.runCleanup(false, 8760, true);

        // Null timestamp video MUST NOT be deleted
        verify(bunnyStreamService, never()).deleteVideo(bId);
        verify(orphanedBunnyVideoRepository, never()).delete(orphan);
        // Timestamp must be initialized to now
        assertNotNull(orphan.getOrphanedAt());
    }

    @Test
    @DisplayName("20. Retry processing enforces 365-day retention and reconstructs missing tracking records")
    void testRetryProcessingEnforcesRetentionAndReconstructsMissingRecords() {
        // Case A: Missing orphan tracking record -> reconstructs record and does NOT delete setting
        String missingOrphanId = "vid-missing-tracking";
        SystemSetting settingA = new SystemSetting("cleanup.failed.video." + missingOrphanId, "VIDEO|error|now");

        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());
        when(orphanedBunnyVideoRepository.findByBunnyVideoId(missingOrphanId)).thenReturn(Optional.empty());

        when(systemSettingRepository.findAll()).thenReturn(List.of(settingA));

        cleanupService.retryFailedDeletions();

        // Failure setting is NOT deleted
        verify(systemSettingRepository, never()).delete(settingA);
        // Orphan tracking is reconstructed
        verify(orphanedBunnyVideoRepository, times(1)).save(argThat(o ->
                o.getBunnyVideoId().equals(missingOrphanId) && o.getCategory().equals("RECONSTRUCTED")));
        // Video is NOT deleted
        verify(bunnyStreamService, never()).deleteVideo(missingOrphanId);

        // Case B: Video orphaned < 365 days -> deferred, setting preserved
        String recentOrphanId = "vid-recent-retry";
        SystemSetting settingB = new SystemSetting("cleanup.failed.video." + recentOrphanId, "VIDEO|error|now");
        OrphanedBunnyVideo recentOrphan = new OrphanedBunnyVideo(recentOrphanId, "COURSE_MODULE", "Recent", "mod1", OffsetDateTime.now().minusDays(100));
        when(orphanedBunnyVideoRepository.findByBunnyVideoId(recentOrphanId)).thenReturn(Optional.of(recentOrphan));
        when(systemSettingRepository.findAll()).thenReturn(List.of(settingB));

        cleanupService.retryFailedDeletions();

        verify(systemSettingRepository, never()).delete(settingB);
        verify(bunnyStreamService, never()).deleteVideo(recentOrphanId);

        // Case C: Video orphaned >= 365 days -> deleted and setting cleared
        String expiredOrphanId = "vid-expired-retry";
        SystemSetting settingC = new SystemSetting("cleanup.failed.video." + expiredOrphanId, "VIDEO|error|now");
        OrphanedBunnyVideo expiredOrphan = new OrphanedBunnyVideo(expiredOrphanId, "COURSE_MODULE", "Expired", "mod1", OffsetDateTime.now().minusDays(400));
        when(orphanedBunnyVideoRepository.findByBunnyVideoId(expiredOrphanId)).thenReturn(Optional.of(expiredOrphan));
        when(systemSettingRepository.findAll()).thenReturn(List.of(settingC));

        cleanupService.retryFailedDeletions();

        verify(bunnyStreamService, times(1)).deleteVideo(expiredOrphanId);
        verify(orphanedBunnyVideoRepository, times(1)).delete(expiredOrphan);
        verify(systemSettingRepository, times(1)).delete(settingC);
    }
}
