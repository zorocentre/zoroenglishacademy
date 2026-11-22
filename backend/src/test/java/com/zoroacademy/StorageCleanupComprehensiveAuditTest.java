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

    @Test
    @DisplayName("Section 4 Fix: Physical deletion failure preserves database metadata and records failure")
    void testPhysicalDeletionFailurePreservesMetadata() throws Exception {
        // Enable live purge allowance via reflection for this test
        java.lang.reflect.Field purgeAllowed = StorageCleanupService.class.getDeclaredField("livePurgeAllowed");
        purgeAllowed.setAccessible(true);
        purgeAllowed.set(storageCleanupService, true);

        OffsetDateTime oldDate = OffsetDateTime.now().minusHours(200);
        StoredFile orphan = createStoredFile("orphan-fail-id", "private/tmp/fail.dat", oldDate);
        when(storedFileRepository.findAll()).thenReturn(List.of(orphan));
        when(storedFileRepository.countByStoragePath("private/tmp/fail.dat")).thenReturn(1L);
        when(storageProvider.exists("private/tmp/fail.dat")).thenReturn(true);
        when(fileStorageService.checkEntityReferences(eq("orphan-fail-id"), eq("private/tmp/fail.dat")))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);

        // Simulate Bunny Storage exception during physical deletion
        doThrow(new RuntimeException("Bunny Storage 503 Service Unavailable"))
                .when(storageProvider).delete("private/tmp/fail.dat");

        CleanupResultDto result = storageCleanupService.runCleanup(false, 168, true);

        assertEquals(1, result.getFailedDeletions());
        assertEquals(0, result.getOrphanedFilesDeleted());
        // Verify database metadata was NOT deleted
        verify(storedFileRepository, never()).delete(orphan);
        // Verify failure was recorded in SystemSettings
        verify(systemSettingRepository, times(1)).save(argThat(s ->
                s.getSettingKey().equals("cleanup.failed.orphan-fail-id")
        ));
    }

    @Test
    @DisplayName("Section 4 Fix: retryFailedDeletions reconciles durable failure records")
    void testRetryFailedDeletionsReconciles() {
        SystemSetting failedSetting = new SystemSetting("cleanup.failed.f-1", "private/tmp/f-1.dat|error|date");
        when(systemSettingRepository.findAll()).thenReturn(List.of(failedSetting));
        when(fileStorageService.checkEntityReferences("f-1", "private/tmp/f-1.dat"))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storedFileRepository.countByStoragePath("private/tmp/f-1.dat")).thenReturn(1L);
        when(storageProvider.exists("private/tmp/f-1.dat")).thenReturn(true);
        when(storedFileRepository.existsById("f-1")).thenReturn(true);

        storageCleanupService.retryFailedDeletions();

        verify(storageProvider, times(1)).delete("private/tmp/f-1.dat");
        verify(storedFileRepository, times(1)).deleteById("f-1");
        verify(systemSettingRepository, times(1)).delete(failedSetting);
    }

    @Test
    @DisplayName("Section 5 Fix: Shared submission attachment is NOT physically deleted on retention purge")
    void testSharedSubmissionAttachmentNotPhysicallyDeleted() {
        String sharedFileId = "11111111-2222-3333-4444-555555555555";
        AssignmentSubmission sub1 = new AssignmentSubmission();
        sub1.setId("sub_1");
        sub1.setAttachment(sharedFileId);

        StoredFile sf = createStoredFile(sharedFileId, "private/submissions/work.pdf", OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(sharedFileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(sharedFileId)).thenReturn(true);

        // File is shared with another entity (e.g. checkEntityReferences returns REFERENCED)
        when(fileStorageService.checkEntityReferences(eq(sharedFileId), eq("private/submissions/work.pdf")))
                .thenReturn(FileStorageService.ReferenceCheckResult.REFERENCED);
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(sharedFileId), eq("private/submissions/work.pdf"), eq("sub_1")))
                .thenReturn(FileStorageService.ReferenceCheckResult.REFERENCED);

        // Invoke processSubmissionRetention
        storageCleanupService.processSubmissionRetention(sub1, Collections.emptySet());

        // Submission reference unlinked, but physical asset and metadata MUST be retained
        assertNull(sub1.getAttachment(), "Submission reference should be unlinked/cleared");
        verify(submissionRepository, times(1)).save(sub1);
        verify(storageProvider, never()).delete(anyString());
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Section 5 Fix: Submission reference is preserved if physical deletion fails")
    void testSubmissionReferencePreservedOnPhysicalDeletionFailure() {
        String fileId = "22222222-3333-4444-5555-666666666666";
        AssignmentSubmission sub = new AssignmentSubmission();
        sub.setId("sub_2");
        sub.setAttachment(fileId);

        StoredFile sf = createStoredFile(fileId, "private/submissions/work2.pdf", OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(fileId)).thenReturn(true);
        when(storedFileRepository.countByStoragePath("private/submissions/work2.pdf")).thenReturn(1L);
        when(submissionRepository.findAll()).thenReturn(List.of(sub));
        when(fileStorageService.checkEntityReferences(eq(fileId), eq("private/submissions/work2.pdf")))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(fileId), eq("private/submissions/work2.pdf"), eq("sub_2")))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storageProvider.exists("private/submissions/work2.pdf")).thenReturn(true);

        // Simulate physical deletion failure
        doThrow(new RuntimeException("Connection timeout")).when(storageProvider).delete("private/submissions/work2.pdf");

        storageCleanupService.processSubmissionRetention(sub, Collections.emptySet());

        // Since physical deletion failed, submission reference and metadata MUST be preserved!
        assertEquals(fileId, sub.getAttachment(), "Submission attachment reference must NOT be cleared if physical deletion fails");
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Regression Test 4: Current submission does not count as an external reference")
    void testCurrentSubmissionDoesNotCountAsExternalReference() {
        String fileId = "33333333-4444-5555-6666-777777777777";
        String path = "private/submissions/sub3.pdf";
        AssignmentSubmission currentSub = new AssignmentSubmission();
        currentSub.setId("sub_curr");
        currentSub.setAttachment(fileId);

        StoredFile sf = createStoredFile(fileId, path, OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(fileId)).thenReturn(true);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(submissionRepository.findAll()).thenReturn(List.of(currentSub));
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(fileId), eq(path), eq("sub_curr")))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storageProvider.exists(path)).thenReturn(true);

        // Current submission alone does NOT count as external sharing
        assertFalse(storageCleanupService.isFileSharedOutsideSubmission(fileId, "sub_curr", path));

        storageCleanupService.processSubmissionRetention(currentSub, Collections.emptySet());

        // Deletion proceeds because it is unshared outside sub_curr
        assertNull(currentSub.getAttachment());
        verify(storageProvider, times(1)).delete(path);
        verify(storedFileRepository, times(1)).delete(sf);
    }

    @Test
    @DisplayName("Regression Test 5: Another submission referencing the same file protects it")
    void testAnotherSubmissionReferencingSameFileProtectsIt() {
        String fileId = "44444444-5555-6666-7777-888888888888";
        String path = "private/submissions/shared_sub.pdf";
        AssignmentSubmission sub1 = new AssignmentSubmission();
        sub1.setId("sub_1");
        sub1.setAttachment(fileId);

        AssignmentSubmission sub2 = new AssignmentSubmission();
        sub2.setId("sub_2");
        sub2.setAttachment(fileId);

        StoredFile sf = createStoredFile(fileId, path, OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(fileId)).thenReturn(true);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(submissionRepository.findAll()).thenReturn(List.of(sub1, sub2));
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(fileId), eq(path), eq("sub_1")))
                .thenReturn(FileStorageService.ReferenceCheckResult.REFERENCED);

        // Must detect external submission reference
        assertTrue(storageCleanupService.isFileSharedOutsideSubmission(fileId, "sub_1", path));

        storageCleanupService.processSubmissionRetention(sub1, Collections.emptySet());

        // Physical asset and StoredFile metadata MUST be retained
        verify(storageProvider, never()).delete(anyString());
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Regression Test 6: Another entity referencing the same file protects it")
    void testAnotherEntityReferencingSameFileProtectsIt() {
        String fileId = "55555555-6666-7777-8888-999999999999";
        String path = "private/submissions/entity_shared.pdf";
        AssignmentSubmission sub = new AssignmentSubmission();
        sub.setId("sub_solo");
        sub.setAttachment(fileId);

        StoredFile sf = createStoredFile(fileId, path, OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(fileId)).thenReturn(true);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(submissionRepository.findAll()).thenReturn(List.of(sub));

        // Referenced in another entity (e.g. AssessmentQuestion or CourseResource)
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(fileId), eq(path), eq("sub_solo")))
                .thenReturn(FileStorageService.ReferenceCheckResult.REFERENCED);

        assertTrue(storageCleanupService.isFileSharedOutsideSubmission(fileId, "sub_solo", path));

        storageCleanupService.processSubmissionRetention(sub, Collections.emptySet());

        verify(storageProvider, never()).delete(anyString());
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Regression Test 7: Missing StoredFile metadata does not silently clear submission references")
    void testMissingStoredFileMetadataDoesNotSilentlyClearSubmissionReferences() {
        String fileId = "66666666-7777-8888-9999-000000000000";
        AssignmentSubmission sub = new AssignmentSubmission();
        sub.setId("sub_missing_meta");
        sub.setAttachment(fileId);

        // StoredFile record is MISSING from DB
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.empty());
        when(storedFileRepository.existsById(fileId)).thenReturn(false);

        storageCleanupService.processSubmissionRetention(sub, Collections.emptySet());

        // Submission reference MUST NOT be cleared; preserved for manual/metadata investigation
        assertEquals(fileId, sub.getAttachment());
        verify(storageProvider, never()).delete(anyString());
        verify(submissionRepository, never()).save(sub);
    }

    @Test
    @DisplayName("Regression Test 8: Repository failure during submission retention protects the attachment")
    void testRepositoryFailureDuringSubmissionRetentionProtectsAttachment() {
        String fileId = "77777777-8888-9999-0000-111111111111";
        String path = "private/submissions/db_fail.pdf";
        AssignmentSubmission sub = new AssignmentSubmission();
        sub.setId("sub_fail");
        sub.setAttachment(fileId);

        StoredFile sf = createStoredFile(fileId, path, OffsetDateTime.now().minusHours(500));
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));
        when(storedFileRepository.existsById(fileId)).thenReturn(true);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(submissionRepository.findAll()).thenReturn(List.of(sub));

        // Repository failure causes UNKNOWN
        when(fileStorageService.checkEntityReferencesExcludingSubmission(eq(fileId), eq(path), eq("sub_fail")))
                .thenReturn(FileStorageService.ReferenceCheckResult.UNKNOWN);

        assertTrue(storageCleanupService.isFileSharedOutsideSubmission(fileId, "sub_fail", path));

        storageCleanupService.processSubmissionRetention(sub, Collections.emptySet());

        verify(storageProvider, never()).delete(anyString());
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Regression Test 9: Retry refuses deletion when a new reference exists")
    void testRetryRefusesDeletionWhenNewReferenceExists() {
        String fileId = "f-new-ref-1";
        String path = "private/docs/newref.pdf";
        SystemSetting setting = new SystemSetting("cleanup.failed." + fileId, path + "|error|date");
        when(systemSettingRepository.findAll()).thenReturn(List.of(setting));

        // File has acquired a new reference
        when(fileStorageService.checkEntityReferences(fileId, path))
                .thenReturn(FileStorageService.ReferenceCheckResult.REFERENCED);

        storageCleanupService.retryFailedDeletions();

        // Must refuse deletion!
        verify(storageProvider, never()).delete(path);
        verify(storedFileRepository, never()).deleteById(fileId);
        // Failure setting is cleared because file is legitimate again
        verify(systemSettingRepository, times(1)).delete(setting);
    }

    @Test
    @DisplayName("Regression Test 10: Retry refuses deletion when reference verification is UNKNOWN")
    void testRetryRefusesDeletionWhenReferenceVerificationIsUnknown() {
        String fileId = "f-unknown-1";
        String path = "private/docs/unknown.pdf";
        SystemSetting setting = new SystemSetting("cleanup.failed." + fileId, path + "|error|date");
        when(systemSettingRepository.findAll()).thenReturn(List.of(setting));

        // Reference check fails -> UNKNOWN
        when(fileStorageService.checkEntityReferences(fileId, path))
                .thenReturn(FileStorageService.ReferenceCheckResult.UNKNOWN);

        storageCleanupService.retryFailedDeletions();

        // Must refuse deletion and preserve failure setting!
        verify(storageProvider, never()).delete(path);
        verify(storedFileRepository, never()).deleteById(fileId);
        verify(systemSettingRepository, never()).delete(setting);
    }

    @Test
    @DisplayName("Regression Test 11: Retry succeeds for a verified, genuinely unreferenced file")
    void testRetrySucceedsForVerifiedGenuinelyUnreferencedFile() {
        String fileId = "f-clean-1";
        String path = "private/docs/clean.pdf";
        SystemSetting setting = new SystemSetting("cleanup.failed." + fileId, path + "|error|date");
        when(systemSettingRepository.findAll()).thenReturn(List.of(setting));

        when(fileStorageService.checkEntityReferences(fileId, path))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(storageProvider.exists(path)).thenReturn(true);
        when(storedFileRepository.existsById(fileId)).thenReturn(true);

        storageCleanupService.retryFailedDeletions();

        verify(storageProvider, times(1)).delete(path);
        verify(storedFileRepository, times(1)).deleteById(fileId);
        verify(systemSettingRepository, times(1)).delete(setting);
    }

    @Test
    @DisplayName("Regression Test 12: Repeated retry does not cause inconsistent state")
    void testRepeatedRetryDoesNotCauseInconsistentState() {
        String fileId = "f-repeat-1";
        String path = "private/docs/repeat.pdf";
        SystemSetting setting = new SystemSetting("cleanup.failed." + fileId, path + "|error|date");
        when(systemSettingRepository.findAll()).thenReturn(List.of(setting));

        when(fileStorageService.checkEntityReferences(fileId, path))
                .thenReturn(FileStorageService.ReferenceCheckResult.NOT_REFERENCED);
        when(storedFileRepository.countByStoragePath(path)).thenReturn(1L);
        when(storageProvider.exists(path)).thenReturn(true);
        when(storedFileRepository.existsById(fileId)).thenReturn(true);

        // Run retry twice
        storageCleanupService.retryFailedDeletions();
        storageCleanupService.retryFailedDeletions();

        // Idempotent execution
        verify(storageProvider, atLeastOnce()).delete(path);
        verify(systemSettingRepository, atLeastOnce()).delete(setting);
    }
}
