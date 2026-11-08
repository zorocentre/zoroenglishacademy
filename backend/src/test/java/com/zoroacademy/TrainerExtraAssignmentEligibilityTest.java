package com.zoroacademy;

import com.zoroacademy.entity.*;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ForbiddenException;
import com.zoroacademy.repository.*;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.ActivityLogService;
import com.zoroacademy.service.AssignmentService;
import com.zoroacademy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TrainerExtraAssignmentEligibilityTest {

    private AssignmentRepository assignmentRepository;
    private AssignmentSubmissionRepository submissionRepository;
    private CourseRepository courseRepository;
    private BatchRepository batchRepository;
    private UserRepository userRepository;
    private StudentCourseBatchRepository studentCourseBatchRepository;
    private EnrollmentRepository enrollmentRepository;
    private NotificationService notificationService;
    private ActivityLogService activityLogService;
    private AssignmentService assignmentService;

    private User trainerUser;
    private Batch batch;

    @BeforeEach
    void setUp() {
        assignmentRepository = mock(AssignmentRepository.class);
        submissionRepository = mock(AssignmentSubmissionRepository.class);
        courseRepository = mock(CourseRepository.class);
        batchRepository = mock(BatchRepository.class);
        userRepository = mock(UserRepository.class);
        studentCourseBatchRepository = mock(StudentCourseBatchRepository.class);
        enrollmentRepository = mock(EnrollmentRepository.class);
        notificationService = mock(NotificationService.class);
        activityLogService = mock(ActivityLogService.class);

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
        assignmentService.setEnrollmentRepository(enrollmentRepository);

        trainerUser = User.builder()
                .id("trn-eligible")
                .name("Alex Trainer")
                .email("alex@zoro.com")
                .role("TRAINER")
                .build();

        batch = Batch.builder()
                .id("batch-online-1")
                .name("Morning Online Batch")
                .courseId("crs-online-eligible")
                .courseName("Online English")
                .trainerId("trn-eligible")
                .trainerName("Alex Trainer")
                .build();

        UserPrincipal principal = new UserPrincipal(
                "trn-eligible",
                "alex@zoro.com",
                "password",
                "Alex Trainer",
                "TRAINER",
                Collections.emptyList()
        );
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        when(userRepository.findById("trn-eligible")).thenReturn(Optional.of(trainerUser));
        when(batchRepository.findById("batch-online-1")).thenReturn(Optional.of(batch));
        when(batchRepository.findByTrainerIdOrTrainerNameIgnoreCase("trn-eligible", "Alex Trainer"))
                .thenReturn(List.of(batch));
    }

    private Assignment createTestAssignment(String courseId, String batchId) {
        Assignment asg = new Assignment();
        asg.setCourseId(courseId);
        asg.setTitle("Task Title");
        asg.setTargetType("batch");
        asg.setBatchId(batchId);
        return asg;
    }

    @Test
    @DisplayName("Task F14: Rejects assignment creation on trainer-audience course with BadRequestException (HTTP 400)")
    void testRejectsTrainerAudienceCourse() {
        Course trainerCourse = Course.builder()
                .id("crs-trainer-1")
                .title("Train the Trainer")
                .audience("trainer")
                .mode("Online")
                .status("Active")
                .build();

        when(courseRepository.findById("crs-trainer-1")).thenReturn(Optional.of(trainerCourse));

        Assignment asg = createTestAssignment("crs-trainer-1", "batch-online-1");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> assignmentService.createAssignment(asg));
        assertTrue(ex.getMessage().contains("Cannot create extra assignments for trainer-audience courses"));
    }

    @Test
    @DisplayName("Task F14: Rejects assignment creation on Recorded mode course with ForbiddenException (HTTP 403)")
    void testRejectsRecordedModeCourse() {
        Course recordedCourse = Course.builder()
                .id("crs-rec-1")
                .title("Recorded Grammar")
                .audience("student")
                .mode("Recorded")
                .status("Active")
                .build();

        when(courseRepository.findById("crs-rec-1")).thenReturn(Optional.of(recordedCourse));

        Assignment asg = createTestAssignment("crs-rec-1", "batch-online-1");

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> assignmentService.createAssignment(asg));
        assertTrue(ex.getMessage().contains("Extra assignments are only permitted for Online and Hybrid courses"));
    }

    @Test
    @DisplayName("Task F14: Rejects assignment creation on Inactive course with BadRequestException (HTTP 400)")
    void testRejectsInactiveCourse() {
        Course inactiveCourse = Course.builder()
                .id("crs-inact-1")
                .title("Old Inactive Course")
                .audience("student")
                .mode("Online")
                .status("Inactive")
                .build();

        when(courseRepository.findById("crs-inact-1")).thenReturn(Optional.of(inactiveCourse));

        Assignment asg = createTestAssignment("crs-inact-1", "batch-online-1");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> assignmentService.createAssignment(asg));
        assertTrue(ex.getMessage().contains("Cannot create extra assignments for inactive courses"));
    }

    @Test
    @DisplayName("Task F14: Rejects assignment creation when trainer is not batch instructor with ForbiddenException (HTTP 403)")
    void testRejectsWhenNotBatchTrainer() {
        Course otherCourse = Course.builder()
                .id("crs-other-1")
                .title("Other Course")
                .audience("student")
                .mode("Online")
                .status("Active")
                .build();

        when(courseRepository.findById("crs-other-1")).thenReturn(Optional.of(otherCourse));

        Assignment asg = createTestAssignment("crs-other-1", "batch-online-1");

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> assignmentService.createAssignment(asg));
        assertTrue(ex.getMessage().contains("You are not allocated to teach course"));
    }

    @Test
    @DisplayName("Task F14: Rejects assignment creation when course has no active student enrollments with BadRequestException (HTTP 400)")
    void testRejectsWhenNoActiveStudentEnrollments() {
        Course emptyCourse = Course.builder()
                .id("crs-online-eligible")
                .title("Online English")
                .audience("student")
                .mode("Online")
                .status("Active")
                .build();

        when(courseRepository.findById("crs-online-eligible")).thenReturn(Optional.of(emptyCourse));
        when(enrollmentRepository.findByCourseId("crs-online-eligible")).thenReturn(Collections.emptyList());

        Assignment asg = createTestAssignment("crs-online-eligible", "batch-online-1");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> assignmentService.createAssignment(asg));
        assertTrue(ex.getMessage().contains("Course has no active student enrollments"));
    }

    @Test
    @DisplayName("Task F14: Allows assignment creation when course is student-audience, Online/Hybrid, Active, trainer is batch trainer, and has active students")
    void testAllowsEligibleCourseAssignmentCreation() {
        Course eligibleCourse = Course.builder()
                .id("crs-online-eligible")
                .title("Online English")
                .audience("student")
                .mode("Online")
                .status("Active")
                .build();

        Enrollment activeEnr = Enrollment.builder()
                .id("enr-1")
                .courseId("crs-online-eligible")
                .studentId("std-1")
                .status("Active")
                .build();

        when(courseRepository.findById("crs-online-eligible")).thenReturn(Optional.of(eligibleCourse));
        when(enrollmentRepository.findByCourseId("crs-online-eligible")).thenReturn(List.of(activeEnr));
        when(assignmentRepository.save(any(Assignment.class))).thenAnswer(i -> i.getArgument(0));

        Assignment asg = createTestAssignment("crs-online-eligible", "batch-online-1");
        asg.setCourse("Online English");

        Assignment created = assignmentService.createAssignment(asg);
        assertNotNull(created);
        assertEquals("crs-online-eligible", created.getCourseId());
        assertEquals("Online English", created.getCourse());
        assertEquals("trn-eligible", created.getTrainerId());
        assertEquals("Alex Trainer", created.getTrainer());
    }
}
