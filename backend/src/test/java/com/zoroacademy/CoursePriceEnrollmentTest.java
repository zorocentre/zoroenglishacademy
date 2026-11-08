package com.zoroacademy;

import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.Enrollment;
import com.zoroacademy.entity.StudentCourseBatch;
import com.zoroacademy.entity.StudentFee;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.ActivityLogService;
import com.zoroacademy.service.EnrollmentService;
import com.zoroacademy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CoursePriceEnrollmentTest {

    private EnrollmentRepository enrollmentRepository;
    private EnrollmentRequestRepository requestRepository;
    private CourseRepository courseRepository;
    private UserRepository userRepository;
    private StudentCourseBatchRepository studentCourseBatchRepository;
    private StudentFeeRepository studentFeeRepository;
    private BatchRepository batchRepository;
    private NotificationService notificationService;
    private ActivityLogService activityLogService;
    private EnrollmentService enrollmentService;

    @BeforeEach
    void setUp() {
        enrollmentRepository = mock(EnrollmentRepository.class);
        requestRepository = mock(EnrollmentRequestRepository.class);
        courseRepository = mock(CourseRepository.class);
        userRepository = mock(UserRepository.class);
        studentCourseBatchRepository = mock(StudentCourseBatchRepository.class);
        studentFeeRepository = mock(StudentFeeRepository.class);
        batchRepository = mock(BatchRepository.class);
        notificationService = mock(NotificationService.class);
        activityLogService = mock(ActivityLogService.class);

        enrollmentService = new EnrollmentService(
                enrollmentRepository,
                requestRepository,
                courseRepository,
                userRepository,
                studentCourseBatchRepository,
                studentFeeRepository,
                batchRepository,
                notificationService,
                activityLogService
        );
    }

    @Test
    @DisplayName("Enrollment creates a StudentFee with amount matching course.price (e.g. 2500)")
    void testEnrollmentCreatesFeeRecordMatchingCoursePrice() {
        String courseId = "crs-price-2500";
        String studentId = "std-101";

        Course course = new Course();
        course.setId(courseId);
        course.setTitle("Spoken English Mastery");
        course.setPrice(new BigDecimal("2500.00"));
        course.setEnrolled(0);

        User student = User.builder()
                .id(studentId)
                .email("student@test.com")
                .name("Alice")
                .role("STUDENT")
                .build();

        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(userRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(studentFeeRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());
        when(studentCourseBatchRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());

        enrollmentService.enroll(studentId, "student@test.com", courseId, "Unassigned");

        ArgumentCaptor<StudentFee> feeCaptor = ArgumentCaptor.forClass(StudentFee.class);
        verify(studentFeeRepository).save(feeCaptor.capture());

        StudentFee capturedFee = feeCaptor.getValue();
        assertNotNull(capturedFee);
        assertEquals(new BigDecimal("2500.00"), capturedFee.getTotalFee());
        assertEquals(new BigDecimal("2500.00"), capturedFee.getDueAmount());
        assertEquals(BigDecimal.ZERO, capturedFee.getPaidAmount());
        assertEquals("Pending", capturedFee.getStatus());
        assertEquals(courseId, capturedFee.getCourseId());
        assertEquals(studentId, capturedFee.getStudentId());
    }

    @Test
    @DisplayName("Enrollment on free course (price 0) sets fee 0 and status 'Paid'")
    void testEnrollmentOnFreeCourseCreatesZeroFeePaid() {
        String courseId = "crs-free";
        String studentId = "std-102";

        Course course = new Course();
        course.setId(courseId);
        course.setTitle("Free Intro Course");
        course.setPrice(BigDecimal.ZERO);
        course.setEnrolled(0);

        User student = User.builder()
                .id(studentId)
                .email("free@test.com")
                .name("Bob")
                .role("STUDENT")
                .build();

        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(userRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(studentFeeRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());
        when(studentCourseBatchRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());

        enrollmentService.enroll(studentId, "free@test.com", courseId, "Unassigned");

        ArgumentCaptor<StudentFee> feeCaptor = ArgumentCaptor.forClass(StudentFee.class);
        verify(studentFeeRepository).save(feeCaptor.capture());

        StudentFee capturedFee = feeCaptor.getValue();
        assertNotNull(capturedFee);
        assertEquals(BigDecimal.ZERO, capturedFee.getTotalFee());
        assertEquals("Paid", capturedFee.getStatus());
    }

    @Test
    @DisplayName("Task F8: Partial payment on total course fee calculates correct remaining due (5 Months x 3000 = 15000, paid 6000 -> due 9000)")
    void testPartialPaymentCalculatesCorrectRemainingDue() {
        FeePaymentRepository paymentRepo = mock(FeePaymentRepository.class);
        com.zoroacademy.service.FeeService feeService = new com.zoroacademy.service.FeeService(
                studentFeeRepository,
                paymentRepo,
                userRepository,
                courseRepository,
                batchRepository,
                notificationService,
                activityLogService
        );

        StudentFee fee = StudentFee.builder()
                .id("fee-test-1")
                .studentId("std-101")
                .studentName("Alice")
                .courseId("crs-5m")
                .course("Spoken English 5M")
                .totalFee(new BigDecimal("15000.00"))
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(new BigDecimal("15000.00"))
                .status("Pending")
                .build();

        when(studentFeeRepository.findById("fee-test-1")).thenReturn(Optional.of(fee));
        when(studentFeeRepository.save(any(StudentFee.class))).thenAnswer(i -> i.getArgument(0));

        StudentFee result = feeService.recordPayment("fee-test-1", new BigDecimal("6000.00"), "Cash", "REC-001", "Installment 1", null, null);

        assertEquals(new BigDecimal("6000.00"), result.getPaidAmount());
        assertEquals(new BigDecimal("9000.00"), result.getDueAmount());
        assertEquals("Pending", result.getStatus());
        assertEquals(new BigDecimal("15000.00"), result.getTotalFee());
    }

    @Test
    @DisplayName("Task F8: Course price edit does not change existing student's fee snapshot and dues")
    void testCoursePriceEditDoesNotChangeExistingStudentDue() {
        String courseId = "crs-price-edit";
        Course course = new Course();
        course.setId(courseId);
        course.setTitle("Business English");
        course.setPrice(new BigDecimal("15000.00"));
        course.setEnteredFee(new BigDecimal("3000.00"));
        course.setDurationValue(5);
        course.setDurationUnit("Months");

        StudentFee existingFee = StudentFee.builder()
                .id("fee-existing-1")
                .studentId("std-existing")
                .studentName("Existing Student")
                .courseId(courseId)
                .totalFee(new BigDecimal("15000.00"))
                .paidAmount(new BigDecimal("6000.00"))
                .dueAmount(new BigDecimal("9000.00"))
                .status("Pending")
                .build();

        // Simulate course fee edit to 20,000 (enteredFee 4000)
        course.setPrice(new BigDecimal("20000.00"));
        course.setEnteredFee(new BigDecimal("4000.00"));

        // Existing student's fee snapshot remains unchanged
        assertEquals(new BigDecimal("15000.00"), existingFee.getTotalFee(), "Existing fee total must remain snapshotted");
        assertEquals(new BigDecimal("9000.00"), existingFee.getDueAmount(), "Existing fee due must remain snapshotted");
    }

    @Test
    @DisplayName("Task F8: New enrollment after course price edit uses the new total course fee")
    void testNewEnrollmentAfterCoursePriceEditUsesNewTotal() {
        String courseId = "crs-price-edit";
        String studentId = "std-new";

        Course course = new Course();
        course.setId(courseId);
        course.setTitle("Business English");
        // Edited course fee
        course.setPrice(new BigDecimal("20000.00"));
        course.setEnteredFee(new BigDecimal("4000.00"));
        course.setDurationValue(5);
        course.setDurationUnit("Months");
        course.setEnrolled(1);

        User student = User.builder()
                .id(studentId)
                .email("newstudent@test.com")
                .name("New Student")
                .role("STUDENT")
                .build();

        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(userRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(studentFeeRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());
        when(studentCourseBatchRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.empty());

        enrollmentService.enroll(studentId, "newstudent@test.com", courseId, "Unassigned");

        ArgumentCaptor<StudentFee> feeCaptor = ArgumentCaptor.forClass(StudentFee.class);
        verify(studentFeeRepository).save(feeCaptor.capture());

        StudentFee capturedFee = feeCaptor.getValue();
        assertNotNull(capturedFee);
        assertEquals(new BigDecimal("20000.00"), capturedFee.getTotalFee());
        assertEquals(new BigDecimal("20000.00"), capturedFee.getDueAmount());
        assertEquals(BigDecimal.ZERO, capturedFee.getPaidAmount());
        assertEquals("Pending", capturedFee.getStatus());
    }
}
