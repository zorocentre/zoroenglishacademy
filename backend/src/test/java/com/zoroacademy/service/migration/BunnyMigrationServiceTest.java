package com.zoroacademy.service.migration;

import com.zoroacademy.dto.migration.MetadataRecoveryResultDto;
import com.zoroacademy.dto.migration.StorageMigrationPlanDto;
import com.zoroacademy.dto.migration.StreamMigrationPlanDto;
import com.zoroacademy.dto.migration.StreamMigrationResultDto;
import com.zoroacademy.entity.AssessmentQuestion;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.entity.Video;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.storage.StorageProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class BunnyMigrationServiceTest {

    private StoredFileRepository storedFileRepository;
    private VideoRepository videoRepository;
    private CourseModuleRepository courseModuleRepository;
    private CompetitionGuidanceVideoRepository guidanceVideoRepository;
    private FeedbackMediaRepository feedbackMediaRepository;
    private AssessmentQuestionRepository assessmentQuestionRepository;
    private CompetitionStudyMaterialRepository competitionStudyMaterialRepository;
    private CompetitionSyllabusRepository competitionSyllabusRepository;
    private StorageProvider storageProvider;

    private BunnyMigrationService migrationService;

    @BeforeEach
    void setUp() {
        storedFileRepository = mock(StoredFileRepository.class);
        videoRepository = mock(VideoRepository.class);
        courseModuleRepository = mock(CourseModuleRepository.class);
        guidanceVideoRepository = mock(CompetitionGuidanceVideoRepository.class);
        feedbackMediaRepository = mock(FeedbackMediaRepository.class);
        assessmentQuestionRepository = mock(AssessmentQuestionRepository.class);
        competitionStudyMaterialRepository = mock(CompetitionStudyMaterialRepository.class);
        competitionSyllabusRepository = mock(CompetitionSyllabusRepository.class);
        storageProvider = mock(StorageProvider.class);

        migrationService = new BunnyMigrationService(
                storedFileRepository,
                storageProvider,
                videoRepository,
                courseModuleRepository,
                assessmentQuestionRepository,
                competitionStudyMaterialRepository,
                competitionSyllabusRepository,
                guidanceVideoRepository,
                feedbackMediaRepository
        );

        when(storedFileRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());
        when(assessmentQuestionRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionStudyMaterialRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionSyllabusRepository.findAll()).thenReturn(Collections.emptyList());
    }

    @Test
    @DisplayName("Migration Plan: Accurately categorizes files and sizes for Storage migration")
    void testStorageMigrationPlanGeneration() {
        StoredFile sf1 = new StoredFile("id-1", "doc.pdf", "application/pdf", 1000L, "course", "usr", "public/doc.pdf", true, "sha1", 1);
        sf1.setCreatedAt(OffsetDateTime.now());
        StoredFile sf2 = new StoredFile("id-2", "img.jpg", "image/jpeg", 2500L, "hero", "usr", "public/img.jpg", true, "sha2", 1);
        sf2.setCreatedAt(OffsetDateTime.now());

        when(storedFileRepository.findAll()).thenReturn(List.of(sf1, sf2));

        StorageMigrationPlanDto plan = migrationService.generateStorageMigrationPlan();

        assertEquals(2, plan.getTotalFiles());
        assertEquals(3500L, plan.getTotalSizeBytes());
        assertTrue(plan.getCategoryCounts().containsKey("course"));
        assertTrue(plan.getCategoryCounts().containsKey("hero"));
        assertEquals(1, plan.getCategoryCounts().get("course"));
        assertEquals(1, plan.getCategoryCounts().get("hero"));
    }

    @Test
    @DisplayName("Stream Migration: Collects and maps Bunny video GUIDs accurately across entities")
    void testStreamMigrationPlanAndExecution() {
        Video v1 = new Video();
        v1.setId("v1");
        v1.setBunnyVideoId("old-guid-1");
        v1.setTitle("Intro Lecture");
        when(videoRepository.findAll()).thenReturn(List.of(v1));
        when(videoRepository.findByBunnyVideoId("old-guid-1")).thenReturn(Optional.of(v1));

        StreamMigrationPlanDto plan = migrationService.generateStreamMigrationPlan();
        assertEquals(1, plan.getTotalVideos());
        assertTrue(plan.getExistingVideoGuids().contains("old-guid-1"));

        // Dry-run simulation of re-mapping old GUID to new GUID
        Map<String, String> guidMapping = Map.of("old-guid-1", "new-guid-1");
        StreamMigrationResultDto resultDryRun = migrationService.executeStreamMigration(true, guidMapping);

        assertTrue(resultDryRun.isDryRun());
        assertEquals(1, resultDryRun.getUpdatedCourseVideosCount());
        // In dry run, repository save should NOT have been called
        verify(videoRepository, never()).save(any());

        // Actual execution
        StreamMigrationResultDto resultReal = migrationService.executeStreamMigration(false, guidMapping);
        assertFalse(resultReal.isDryRun());
        assertEquals("new-guid-1", v1.getBunnyVideoId());
        verify(videoRepository, times(1)).save(v1);
    }

    @Test
    @DisplayName("Metadata Recovery: Reconstructs missing StoredFile records for unindexed question media")
    void testRecoverUnindexedMediaMetadata() {
        String missingMediaId = "f774aa44-1b81-4610-985c-d03f9daec707";

        AssessmentQuestion aq = new AssessmentQuestion();
        aq.setId("aq_test_1");
        aq.setMediaRef(missingMediaId);
        when(assessmentQuestionRepository.findAll()).thenReturn(List.of(aq));

        // When storedFileRepository.existsById is queried for this missing ID, it returns false
        when(storedFileRepository.existsById(missingMediaId)).thenReturn(false);

        // Mock existence of physical asset in Bunny Storage
        String physicalPath = "public/question-media/" + missingMediaId + ".png";
        when(storageProvider.exists(physicalPath)).thenReturn(true);
        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(new byte[]{1, 2, 3});
        when(storageProvider.loadAsResource(physicalPath)).thenReturn(resource);

        // Dry run mode
        MetadataRecoveryResultDto dryRunResult = migrationService.recoverUnindexedMediaMetadata(true);
        assertTrue(dryRunResult.isDryRun());
        assertEquals(1, dryRunResult.getUnindexedReferencesScanned());
        assertEquals(1, dryRunResult.getRecoveredCount());
        verify(storedFileRepository, never()).save(any());

        // Real execution mode
        MetadataRecoveryResultDto realResult = migrationService.recoverUnindexedMediaMetadata(false);
        assertFalse(realResult.isDryRun());
        assertEquals(1, realResult.getRecoveredCount());
        verify(storedFileRepository, times(1)).save(argThat(sf ->
                sf.getId().equals(missingMediaId) &&
                sf.getCategory().equals("question-media") &&
                sf.getStoragePath().contains(missingMediaId)
        ));
    }
}
