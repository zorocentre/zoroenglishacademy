package com.zoroacademy;

import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.FileStorageService;
import com.zoroacademy.service.StorageCleanupService;
import com.zoroacademy.service.storage.StorageProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class StorageCleanupComprehensiveAuditTest {

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

    private AssessmentQuestionRepository assessmentQuestionRepository;
    private AttemptAnswerRepository attemptAnswerRepository;
    private CompetitionStudyMaterialRepository competitionStudyMaterialRepository;
    private CompetitionSyllabusRepository competitionSyllabusRepository;
    private CompetitionGuidanceVideoRepository guidanceVideoRepository;
    private CourseResourceRepository courseResourceRepository;
    private ExpenseRepository expenseRepository;
    private CompetitionRegistrationRepository registrationRepository;
    private CompetitionModuleRepository competitionModuleRepository;

    private StorageCleanupService storageCleanupService;

    @BeforeEach
    void setUp() {
        storedFileRepository = mock(StoredFileRepository.class);
        storageProvider = mock(StorageProvider.class);
        fileStorageService = mock(FileStorageService.class);
        courseRepository = mock(CourseRepository.class);
        courseModuleRepository = mock(CourseModuleRepository.class);
        scheduleRepository = mock(ScheduleRepository.class);
        assignmentRepository = mock(AssignmentRepository.class);
        submissionRepository = mock(AssignmentSubmissionRepository.class);
        userRepository = mock(UserRepository.class);
        competitionRepository = mock(CompetitionRepository.class);
        websiteSettingsRepository = mock(WebsiteSettingsRepository.class);
        videoRepository = mock(VideoRepository.class);
        bunnyStreamService = mock(com.zoroacademy.service.BunnyStreamService.class);
        systemSettingRepository = mock(SystemSettingRepository.class);
        heroImageRepository = mock(HeroImageRepository.class);
        feedbackMediaRepository = mock(FeedbackMediaRepository.class);

        assessmentQuestionRepository = mock(AssessmentQuestionRepository.class);
        attemptAnswerRepository = mock(AttemptAnswerRepository.class);
        competitionStudyMaterialRepository = mock(CompetitionStudyMaterialRepository.class);
        competitionSyllabusRepository = mock(CompetitionSyllabusRepository.class);
        guidanceVideoRepository = mock(CompetitionGuidanceVideoRepository.class);
        courseResourceRepository = mock(CourseResourceRepository.class);
        expenseRepository = mock(ExpenseRepository.class);
        registrationRepository = mock(CompetitionRegistrationRepository.class);
        competitionModuleRepository = mock(CompetitionModuleRepository.class);

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
                feedbackMediaRepository,
                assessmentQuestionRepository,
                attemptAnswerRepository,
                competitionStudyMaterialRepository,
                competitionSyllabusRepository,
                guidanceVideoRepository,
                courseResourceRepository,
                expenseRepository,
                registrationRepository,
                competitionModuleRepository
        );

        // Standard empty returns
        when(courseRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseModuleRepository.findAll()).thenReturn(Collections.emptyList());
        when(scheduleRepository.findAll()).thenReturn(Collections.emptyList());
        when(assignmentRepository.findAll()).thenReturn(Collections.emptyList());
        when(submissionRepository.findAll()).thenReturn(Collections.emptyList());
        when(userRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionRepository.findAll()).thenReturn(Collections.emptyList());
        when(websiteSettingsRepository.findAll()).thenReturn(Collections.emptyList());
        when(videoRepository.findAll()).thenReturn(Collections.emptyList());
        when(heroImageRepository.findAll()).thenReturn(Collections.emptyList());
        when(feedbackMediaRepository.findAll()).thenReturn(Collections.emptyList());

        when(assessmentQuestionRepository.findAll()).thenReturn(Collections.emptyList());
        when(attemptAnswerRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionStudyMaterialRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionSyllabusRepository.findAll()).thenReturn(Collections.emptyList());
        when(guidanceVideoRepository.findAll()).thenReturn(Collections.emptyList());
        when(courseResourceRepository.findAll()).thenReturn(Collections.emptyList());
        when(expenseRepository.findAll()).thenReturn(Collections.emptyList());
        when(registrationRepository.findAll()).thenReturn(Collections.emptyList());
        when(competitionModuleRepository.findAll()).thenReturn(Collections.emptyList());
    }

    private StoredFile createStoredFile(String id, String path, OffsetDateTime createdAt) {
        StoredFile sf = new StoredFile(
                id,
                "file_" + id + ".dat",
                "application/octet-stream",
                1024L,
                "test",
                "usr_test",
                path,
                false,
                "sha_" + id,
                1
        );
        sf.setCreatedAt(createdAt);
        return sf;
    }

    @Test
    @DisplayName("Safeguard A: Assessment question media (UUID or URL) is NEVER flagged as orphan")
    void testAssessmentQuestionMediaProtected() {
        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);

        String questionMediaId1 = "f774aa44-1b81-4610-985c-d03f9daec707";
        String questionMediaId2 = "e84c5489-d214-4bc9-aad3-5f644c449e49";
        StoredFile sf1 = createStoredFile(questionMediaId1, "public/questions/" + questionMediaId1 + ".png", oldDate);
        StoredFile sf2 = createStoredFile(questionMediaId2, "public/questions/" + questionMediaId2 + ".png", oldDate);

        StoredFile genuineOrphan = createStoredFile("orphan-1111-2222-3333", "private/tmp/orphan.dat", oldDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(sf1, sf2, genuineOrphan));

        AssessmentQuestion q1 = new AssessmentQuestion();
        q1.setId("aq_1");
        q1.setMediaRef(questionMediaId1); // Direct UUID

        AssessmentQuestion q2 = new AssessmentQuestion();
        q2.setId("aq_2");
        q2.setMediaRef("/api/files/" + questionMediaId2); // API URL reference

        when(assessmentQuestionRepository.findAll()).thenReturn(List.of(q1, q2));

        CleanupResultDto result = storageCleanupService.runCleanup(true, 168);

        assertEquals(1, result.getOrphanedFilesFound(), "Only genuine orphan should be found");
        assertEquals(0, result.getOrphanedFilesDeleted(), "In dry-run mode, 0 files should be deleted");
        assertTrue(result.isDryRun());
    }

    @Test
    @DisplayName("Safeguard B: Attempt answer voice/audio files and competition materials are protected")
    void testAttemptAnswerAndCompetitionMaterialsProtected() {
        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);

        String audioId = "audio-1111-2222-3333";
        String voiceId = "voice-4444-5555-6666";
        String materialId = "mat-7777-8888-9999";
        String syllabusId = "syl-aaaa-bbbb-cccc";

        StoredFile sfAudio = createStoredFile(audioId, "private/audio/" + audioId + ".mp3", oldDate);
        StoredFile sfVoice = createStoredFile(voiceId, "private/voice/" + voiceId + ".wav", oldDate);
        StoredFile sfMat = createStoredFile(materialId, "public/materials/" + materialId + ".pdf", oldDate);
        StoredFile sfSyl = createStoredFile(syllabusId, "public/syllabus/" + syllabusId + ".pdf", oldDate);
        StoredFile sfOrphan = createStoredFile("orphan-9999", "private/tmp/orphan.bin", oldDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(sfAudio, sfVoice, sfMat, sfSyl, sfOrphan));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setId("ans_1");
        answer.setAudioFileId(audioId);
        answer.setVoiceFileId(voiceId);
        when(attemptAnswerRepository.findAll()).thenReturn(List.of(answer));

        CompetitionStudyMaterial material = new CompetitionStudyMaterial();
        material.setId("csm_1");
        material.setStoredFileId(materialId);
        when(competitionStudyMaterialRepository.findAll()).thenReturn(List.of(material));

        CompetitionSyllabus syllabus = new CompetitionSyllabus();
        syllabus.setId("csyl_1");
        syllabus.setStoredFileId(syllabusId);
        when(competitionSyllabusRepository.findAll()).thenReturn(List.of(syllabus));

        CleanupResultDto result = storageCleanupService.runCleanup(true, 168);

        assertEquals(1, result.getOrphanedFilesFound(), "Only sfOrphan should be classified as orphan");
        assertEquals(1024L, result.getBytesReclaimed());
    }

    @Test
    @DisplayName("Safeguard C: JSON embedded assessment references in CompetitionModule are resolved")
    void testJsonEmbeddedAssessmentDataReferencesProtected() {
        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);

        String embeddedId = "embed-1234-5678-90ab";
        StoredFile sfEmbedded = createStoredFile(embeddedId, "public/media/" + embeddedId + ".jpg", oldDate);
        StoredFile sfOrphan = createStoredFile("orphan-8888", "private/tmp/orphan.bin", oldDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(sfEmbedded, sfOrphan));

        CompetitionModule module = new CompetitionModule();
        module.setId("cmod_1");
        module.setAssessmentData("{\"questions\":[{\"mediaRef\":\"" + embeddedId + "\",\"title\":\"Q1\"}]}");
        when(competitionModuleRepository.findAll()).thenReturn(List.of(module));

        CleanupResultDto result = storageCleanupService.runCleanup(true, 168);

        assertEquals(1, result.getOrphanedFilesFound(), "Embedded JSON reference should protect sfEmbedded");
    }

    @Test
    @DisplayName("Safeguard D: Files younger than retention period (168h default) are SKIPPED")
    void testRetentionWindowEnforced() {
        OffsetDateTime recentDate = OffsetDateTime.now().minusHours(12); // Under 168 hours
        OffsetDateTime olderDate = OffsetDateTime.now().minusHours(200);

        StoredFile recentUnreferenced = createStoredFile("recent-file", "private/tmp/recent.dat", recentDate);
        StoredFile olderUnreferenced = createStoredFile("older-file", "private/tmp/older.dat", olderDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(recentUnreferenced, olderUnreferenced));

        CleanupResultDto result = storageCleanupService.runCleanup(true, 168);

        // Only the older file should be flagged as orphan candidate
        assertEquals(1, result.getOrphanedFilesFound());
        assertEquals(1, result.getSkippedRecent());
    }

    @Test
    @DisplayName("Safeguard E: Shared physical storage path is protected if any record referencing it is active")
    void testSharedStoragePathProtected() {
        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);

        // Two StoredFile records sharing the exact same storage_path
        StoredFile sf1 = createStoredFile("sf-1", "public/common/shared-logo.png", oldDate);
        StoredFile sf2 = createStoredFile("sf-2", "public/common/shared-logo.png", oldDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(sf1, sf2));

        // Only sf1 is actively referenced by an entity
        AssessmentQuestion q = new AssessmentQuestion();
        q.setId("aq_shared");
        q.setMediaRef("sf-1");
        when(assessmentQuestionRepository.findAll()).thenReturn(List.of(q));

        CleanupResultDto result = storageCleanupService.runCleanup(true, 168);

        // Both sf1 (directly referenced) and sf2 (sharing storage_path with sf1) must be protected
        assertEquals(0, result.getOrphanedFilesFound(), "Shared storage path must protect both records");
        assertEquals(2, result.getSkippedActiveRef(), "Both records sharing the storage path must be protected from deletion");
    }

    @Test
    @DisplayName("Safeguard F: Live purge is BLOCKED if confirmPermanentDelete=false or livePurgeAllowed=false")
    void testLivePurgeBlockedWithoutStrictConfirmation() {
        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);
        StoredFile orphan = createStoredFile("orphan-test", "private/tmp/orphan.dat", oldDate);

        when(storedFileRepository.findAll()).thenReturn(List.of(orphan));

        // dryRun=false, but confirmPermanentDelete=false and default livePurgeAllowed=false
        CleanupResultDto result = storageCleanupService.runCleanup(false, 168, false);

        assertTrue(result.isDryRun(), "Must be automatically forced to dry-run when confirmation is missing");
        assertTrue(result.isRequiresOptIn());
        assertFalse(result.isLivePurgeAllowed());
        assertEquals(0, result.getOrphanedFilesDeleted());
        verify(storageProvider, never()).delete(any());
        verify(storedFileRepository, never()).delete(any());
    }
}
