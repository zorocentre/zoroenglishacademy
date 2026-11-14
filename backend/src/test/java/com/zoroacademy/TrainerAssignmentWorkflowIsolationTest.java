package com.zoroacademy;

import com.zoroacademy.entity.AssignmentSubmission;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.TrainerCourseRequest;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.ActivityLogService;
import com.zoroacademy.service.AssignmentService;
import com.zoroacademy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class TrainerAssignmentWorkflowIsolationTest {

    private AssignmentRepository assignmentRepository;
    private AssignmentSubmissionRepository submissionRepository;
    private CourseRepository courseRepository;
    private BatchRepository batchRepository;
    private UserRepository userRepository;
    private StudentCourseBatchRepository studentCourseBatchRepository;
    private NotificationService notificationService;
    private ActivityLogService activityLogService;
    private TrainerCourseRequestRepository trainerCourseRequestRepository;

    private AssignmentService assignmentService;

    private final String TRAINER_ID = "trn_test_1";
    private final String TRAINER_EMAIL = "trainer1@example.com";
    private final String ENROLLED_COURSE_ID = "crs_trainer_enrolled_1";
    private final String UNENROLLED_COURSE_ID = "crs_trainer_other_99";

    @BeforeEach
    void setUp() {
        assignmentRepository = Mockito.mock(AssignmentRepository.class);
        submissionRepository = Mockito.mock(AssignmentSubmissionRepository.class);
        courseRepository = Mockito.mock(CourseRepository.class);
        batchRepository = Mockito.mock(BatchRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        studentCourseBatchRepository = Mockito.mock(StudentCourseBatchRepository.class);
        notificationService = Mockito.mock(NotificationService.class);
        activityLogService = Mockito.mock(ActivityLogService.class);
        trainerCourseRequestRepository = Mockito.mock(TrainerCourseRequestRepository.class);

        assignmentService = new AssignmentService(
                assignmentRepository,
                submissionRepository,
                courseRepository,
                batchRepository,
                userRepository,
                studentCourseBatchRepository,
                notificationService,
                activityLogService
        );

        // Inject trainerCourseRequestRepository
        try {
            var field = AssignmentService.class.getDeclaredField("trainerCourseRequestRepository");
            field.setAccessible(true);
            field.set(assignmentService, trainerCourseRequestRepository);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        // Mock enrolled course request
        TrainerCourseRequest req = new TrainerCourseRequest();
        req.setTrainerId(TRAINER_ID);
        req.setTrainerEmail(TRAINER_EMAIL);
        req.setCourseId(ENROLLED_COURSE_ID);
        req.setStatus("Approved");

        when(trainerCourseRequestRepository.findByTrainerId(TRAINER_ID)).thenReturn(List.of(req));
        when(trainerCourseRequestRepository.findByTrainerEmailIgnoreCase(TRAINER_EMAIL)).thenReturn(List.of(req));
    }

    @Test
    @DisplayName("Backend Isolation: Trainer querying enrolled course succeeds, querying unassigned course throws 403 Forbidden")
    void testTrainerCourseScopingAndForbidden() {
        AssignmentSubmission sub1 = new AssignmentSubmission();
        sub1.setId("sub_1");
        sub1.setStudentId(TRAINER_ID);
        sub1.setCourseId(ENROLLED_COURSE_ID);
        sub1.setSubmitterRole("TRAINER");

        when(submissionRepository.findByStudentIdAndSubmitterRoleIgnoreCase(TRAINER_ID, "TRAINER"))
                .thenReturn(List.of(sub1));

        // 1. Querying enrolled course succeeds
        List<AssignmentSubmission> enrolledResults = assignmentService.getTrainerCourseAssignments(TRAINER_ID, TRAINER_EMAIL, ENROLLED_COURSE_ID);
        assertEquals(1, enrolledResults.size());
        assertEquals("sub_1", enrolledResults.get(0).getId());

        // 2. Querying unenrolled course throws 403 Forbidden
        assertThrows(ResponseStatusException.class, () -> {
            assignmentService.getTrainerCourseAssignments(TRAINER_ID, TRAINER_EMAIL, UNENROLLED_COURSE_ID);
        });
    }

    @Test
    @DisplayName("Validation: Submission requires solution file AND notes; submitterRole set to TRAINER and reviewer to ADMIN")
    void testSubmissionValidationAndRole() {
        User trainerUser = new User();
        trainerUser.setId(TRAINER_ID);
        trainerUser.setName("Test Trainer");
        trainerUser.setEmail(TRAINER_EMAIL);
        trainerUser.setRole("TRAINER");
        when(userRepository.findById(TRAINER_ID)).thenReturn(Optional.of(trainerUser));

        when(submissionRepository.save(any(AssignmentSubmission.class))).thenAnswer(i -> i.getArgument(0));

        // Missing file throws IllegalArgumentException
        AssignmentSubmission noFile = new AssignmentSubmission();
        noFile.setStudentId(TRAINER_ID);
        noFile.setAnswerText("Some notes");
        assertThrows(IllegalArgumentException.class, () -> assignmentService.createSubmission(noFile));

        // Missing notes throws IllegalArgumentException
        AssignmentSubmission noNotes = new AssignmentSubmission();
        noNotes.setStudentId(TRAINER_ID);
        noNotes.setAttachment("file_url.pdf");
        assertThrows(IllegalArgumentException.class, () -> assignmentService.createSubmission(noNotes));

        // Valid submission sets TRAINER role and ADMIN reviewer
        AssignmentSubmission valid = new AssignmentSubmission();
        valid.setStudentId(TRAINER_ID);
        valid.setCourseId(ENROLLED_COURSE_ID);
        valid.setAttachment("file_url.pdf");
        valid.setAnswerText("Completed task solution");

        AssignmentSubmission created = assignmentService.createSubmission(valid);
        assertEquals("TRAINER", created.getSubmitterRole());
        assertEquals("ADMIN", created.getReviewer());
        assertEquals("Pending Correction", created.getStatus());
    }

    @Test
    @DisplayName("Evaluation flow: Admin evaluates submission, returns score and remarks to trainer")
    void testAdminEvaluationReflectsToTrainer() {
        AssignmentSubmission sub = new AssignmentSubmission();
        sub.setId("sub_eval_1");
        sub.setStudentId(TRAINER_ID);
        sub.setSubmitterRole("TRAINER");
        sub.setStatus("Pending Correction");

        when(submissionRepository.findById("sub_eval_1")).thenReturn(Optional.of(sub));
        when(submissionRepository.save(any(AssignmentSubmission.class))).thenAnswer(i -> i.getArgument(0));

        AssignmentSubmission reviewed = assignmentService.reviewSubmission(
                "sub_eval_1",
                "95/100",
                "Excellent phonics breakdown and lesson design.",
                "Admin",
                null,
                null
        );

        assertEquals("Corrected", reviewed.getStatus());
        assertEquals("95/100", reviewed.getScore());
        assertEquals("Excellent phonics breakdown and lesson design.", reviewed.getRemarks());
    }
}
