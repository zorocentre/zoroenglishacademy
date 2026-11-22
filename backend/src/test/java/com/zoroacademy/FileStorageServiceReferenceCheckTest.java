package com.zoroacademy;

import com.zoroacademy.entity.AssessmentQuestion;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.FileStorageService;
import com.zoroacademy.service.FileStorageService.ReferenceCheckResult;
import com.zoroacademy.service.storage.StorageProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class FileStorageServiceReferenceCheckTest {

    private StoredFileRepository storedFileRepository;
    private StorageProvider storageProvider;
    private AssessmentQuestionRepository assessmentQuestionRepository;
    private CompetitionStudyMaterialRepository studyMaterialRepository;
    private CompetitionSyllabusRepository syllabusRepository;
    private AttemptAnswerRepository attemptAnswerRepository;
    private AssignmentSubmissionRepository submissionRepository;
    private CourseResourceRepository courseResourceRepository;
    private ExpenseRepository expenseRepository;
    private CompetitionRegistrationRepository registrationRepository;
    private CompetitionModuleRepository competitionModuleRepository;

    private FileStorageService fileStorageService;

    @BeforeEach
    void setUp() {
        storedFileRepository = mock(StoredFileRepository.class);
        storageProvider = mock(StorageProvider.class);
        assessmentQuestionRepository = mock(AssessmentQuestionRepository.class);
        studyMaterialRepository = mock(CompetitionStudyMaterialRepository.class);
        syllabusRepository = mock(CompetitionSyllabusRepository.class);
        attemptAnswerRepository = mock(AttemptAnswerRepository.class);
        submissionRepository = mock(AssignmentSubmissionRepository.class);
        courseResourceRepository = mock(CourseResourceRepository.class);
        expenseRepository = mock(ExpenseRepository.class);
        registrationRepository = mock(CompetitionRegistrationRepository.class);
        competitionModuleRepository = mock(CompetitionModuleRepository.class);

        fileStorageService = new FileStorageService(
                storedFileRepository,
                storageProvider,
                assessmentQuestionRepository,
                studyMaterialRepository,
                syllabusRepository,
                attemptAnswerRepository,
                submissionRepository,
                courseResourceRepository,
                expenseRepository,
                registrationRepository,
                competitionModuleRepository
        );
    }

    @Test
    @DisplayName("Reference Check: Returns REFERENCED when found in AssessmentQuestion")
    void testReferencedInAssessmentQuestion() {
        String fileId = "file-123";
        AssessmentQuestion q = new AssessmentQuestion();
        q.setId("q-1");
        q.setMediaRef(fileId);

        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(List.of(q));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "public/question-media/file-123.png");
        assertEquals(ReferenceCheckResult.REFERENCED, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "public/question-media/file-123.png"));
    }

    @Test
    @DisplayName("Reference Check: Returns NOT_REFERENCED when unreferenced in all repositories")
    void testNotReferencedAcrossAllRepositories() {
        String fileId = "orphan-file-999";

        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(syllabusRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(fileId, fileId)).thenReturn(Collections.emptyList());
        when(submissionRepository.findByAnyFileUrlContaining(fileId)).thenReturn(Collections.emptyList());
        when(courseResourceRepository.findByFileUrlContaining(fileId)).thenReturn(Collections.emptyList());

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "public/orphan/file.png");
        assertEquals(ReferenceCheckResult.NOT_REFERENCED, result);
        assertFalse(fileStorageService.isReferencedInApplicationEntities(fileId, "public/orphan/file.png"));
    }

    @Test
    @DisplayName("Section 3 Fix: AssessmentQuestion query failure returns UNKNOWN and protects file from deletion")
    void testAssessmentQuestionQueryFailureProtectsFile() {
        String fileId = "file-safe-1";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId))
                .thenThrow(new RuntimeException("Database timeout on assessment_questions"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "public/question-media/file-1.png");
        assertEquals(ReferenceCheckResult.UNKNOWN, result, "Database failure must yield UNKNOWN, never NOT_REFERENCED");
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "public/question-media/file-1.png"), "UNKNOWN must always mean PROTECTED");

        StoredFile sf = new StoredFile(fileId, "file.png", "image/png", 100L, "question-media", "admin", "public/question-media/file-1.png", true, "hash", 1);
        when(storedFileRepository.findById(fileId)).thenReturn(Optional.of(sf));

        fileStorageService.deleteFile(fileId);

        verify(storageProvider, never()).delete(anyString());
        verify(storedFileRepository, never()).delete(any(StoredFile.class));
    }

    @Test
    @DisplayName("Section 3 Fix: StudyMaterial query failure returns UNKNOWN and protects file")
    void testStudyMaterialQueryFailureProtectsFile() {
        String fileId = "file-safe-2";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId))
                .thenThrow(new RuntimeException("Connection pool exhausted"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "private/study-material/doc.pdf");
        assertEquals(ReferenceCheckResult.UNKNOWN, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "private/study-material/doc.pdf"));
    }

    @Test
    @DisplayName("Section 3 Fix: Syllabus query failure returns UNKNOWN and protects file")
    void testSyllabusQueryFailureProtectsFile() {
        String fileId = "file-safe-3";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(syllabusRepository.findByStoredFileId(fileId))
                .thenThrow(new RuntimeException("Table lock"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "public/syllabus/syl.pdf");
        assertEquals(ReferenceCheckResult.UNKNOWN, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "public/syllabus/syl.pdf"));
    }

    @Test
    @DisplayName("Section 3 Fix: AttemptAnswer query failure returns UNKNOWN and protects file")
    void testAttemptAnswerQueryFailureProtectsFile() {
        String fileId = "file-safe-4";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(syllabusRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(fileId, fileId))
                .thenThrow(new RuntimeException("I/O Error on attempt_answers"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "private/voice/audio.mp3");
        assertEquals(ReferenceCheckResult.UNKNOWN, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "private/voice/audio.mp3"));
    }

    @Test
    @DisplayName("Section 3 Fix: Submission query failure returns UNKNOWN and protects file")
    void testSubmissionQueryFailureProtectsFile() {
        String fileId = "file-safe-5";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(syllabusRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(fileId, fileId)).thenReturn(Collections.emptyList());
        when(submissionRepository.findByAnyFileUrlContaining(fileId))
                .thenThrow(new RuntimeException("PostgreSQL connection reset"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "private/submissions/work.pdf");
        assertEquals(ReferenceCheckResult.UNKNOWN, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "private/submissions/work.pdf"));
    }

    @Test
    @DisplayName("Section 3 Fix: CourseResource query failure returns UNKNOWN and protects file")
    void testCourseResourceQueryFailureProtectsFile() {
        String fileId = "file-safe-6";
        when(assessmentQuestionRepository.findByMediaRefContaining(fileId)).thenReturn(Collections.emptyList());
        when(studyMaterialRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(syllabusRepository.findByStoredFileId(fileId)).thenReturn(Collections.emptyList());
        when(attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(fileId, fileId)).thenReturn(Collections.emptyList());
        when(submissionRepository.findByAnyFileUrlContaining(fileId)).thenReturn(Collections.emptyList());
        when(courseResourceRepository.findByFileUrlContaining(fileId))
                .thenThrow(new RuntimeException("SocketTimeoutException"));

        ReferenceCheckResult result = fileStorageService.checkEntityReferences(fileId, "public/course-resources/res.pdf");
        assertEquals(ReferenceCheckResult.UNKNOWN, result);
        assertTrue(fileStorageService.isReferencedInApplicationEntities(fileId, "public/course-resources/res.pdf"));
    }
}
