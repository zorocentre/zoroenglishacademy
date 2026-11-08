package com.zoroacademy;

import com.zoroacademy.entity.Course;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.service.CourseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class CourseFeeCalculationAndModeLockTest {

    private CourseRepository courseRepository;
    private com.zoroacademy.repository.BatchRepository batchRepository;
    private com.zoroacademy.repository.EnrollmentRepository enrollmentRepository;
    private com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository;
    private com.zoroacademy.repository.StudentFeeRepository studentFeeRepository;
    private CourseService courseService;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        batchRepository = mock(com.zoroacademy.repository.BatchRepository.class);
        enrollmentRepository = mock(com.zoroacademy.repository.EnrollmentRepository.class);
        studentCourseBatchRepository = mock(com.zoroacademy.repository.StudentCourseBatchRepository.class);
        studentFeeRepository = mock(com.zoroacademy.repository.StudentFeeRepository.class);
        when(batchRepository.findByCourseId(anyString())).thenReturn(java.util.Collections.emptyList());
        when(enrollmentRepository.findByCourseId(anyString())).thenReturn(java.util.Collections.emptyList());
        when(studentCourseBatchRepository.findByCourseId(anyString())).thenReturn(java.util.Collections.emptyList());
        when(studentFeeRepository.findByCourseId(anyString())).thenReturn(java.util.Collections.emptyList());
        when(courseRepository.save(any(Course.class))).thenAnswer(i -> i.getArgument(0));
        courseService = new CourseService(
                courseRepository,
                null, null, null, batchRepository, enrollmentRepository, studentCourseBatchRepository, studentFeeRepository, null, null, null, null, null, null, null, null, null
        );
    }

    @Test
    @DisplayName("Task F6: Authoritative Total Course Fee calculation with BigDecimal")
    void testAuthoritativeTotalFeeCalculations() {
        // 40 Hours 5000 -> 5000
        BigDecimal t1 = CourseService.calculateTotalFee(new BigDecimal("5000.00"), 40, "Hours");
        assertEquals(new BigDecimal("5000.00"), t1);

        // 30 Days 4000 -> 4000
        BigDecimal t2 = CourseService.calculateTotalFee(new BigDecimal("4000.00"), 30, "Days");
        assertEquals(new BigDecimal("4000.00"), t2);

        // 5 Months 3000 -> 15000
        BigDecimal t3 = CourseService.calculateTotalFee(new BigDecimal("3000.00"), 5, "Months");
        assertEquals(new BigDecimal("15000.00"), t3);

        // 3 Years 2000 -> 72000 (3 * 12 * 2000)
        BigDecimal t4 = CourseService.calculateTotalFee(new BigDecimal("2000.00"), 3, "Years");
        assertEquals(new BigDecimal("72000.00"), t4);

        // 12 Months 1500 -> 18000
        BigDecimal t5 = CourseService.calculateTotalFee(new BigDecimal("1500.00"), 12, "Months");
        assertEquals(new BigDecimal("18000.00"), t5);

        // 2 Years 2500 -> 60000 (2 * 12 * 2500)
        BigDecimal t6 = CourseService.calculateTotalFee(new BigDecimal("2500.00"), 2, "Years");
        assertEquals(new BigDecimal("60000.00"), t6);
    }

    @Test
    @DisplayName("Task F6: Populate duration and fee stores entered_fee and recomputes total")
    void testPopulateDurationAndFeeStoresBothValues() {
        Course course = new Course();
        course.setId("crs_test_fee");
        course.setTitle("Business English");

        // Admin enters 5 Months, entered fee 3000
        CourseService.populateDurationAndFee(course, new BigDecimal("3000.00"), 5, "Months", null);

        assertEquals(new BigDecimal("3000.00"), course.getEnteredFee());
        assertEquals(new BigDecimal("15000.00"), course.getPrice());
        assertEquals(5, course.getDurationValue());
        assertEquals("Months", course.getDurationUnit());
        assertEquals("5 Months", course.getDuration());

        // Saving repeatedly does not multiply total fee again
        CourseService.populateDurationAndFee(course, course.getEnteredFee(), course.getDurationValue(), course.getDurationUnit(), null);
        assertEquals(new BigDecimal("3000.00"), course.getEnteredFee());
        assertEquals(new BigDecimal("15000.00"), course.getPrice());
    }

    @Test
    @DisplayName("Task F10: Course mode cannot be changed after creation")
    void testCourseModeLockOnUpdate() {
        Course existing = new Course();
        existing.setId("crs_online");
        existing.setTitle("Online Course");
        existing.setMode("Online");
        existing.setPrice(new BigDecimal("5000.00"));
        existing.setGoogleMeetUrl("https://meet.google.com/abc-defg-hij");

        when(courseRepository.findById("crs_online")).thenReturn(Optional.of(existing));

        // 1. Same mode succeeds
        Course sameModeUpdate = new Course();
        sameModeUpdate.setMode("Online");
        sameModeUpdate.setTitle("Online Course");
        sameModeUpdate.setGoogleMeetUrl("https://meet.google.com/abc-defg-hij");

        Course updated = courseService.updateCourse("crs_online", sameModeUpdate);
        assertEquals("Online Course", updated.getTitle());
        assertEquals("Online", updated.getMode());

        // 2. Online -> Recorded is rejected (HTTP 400 BadRequestException)
        Course recordedUpdate = new Course();
        recordedUpdate.setMode("Recorded");
        BadRequestException ex1 = assertThrows(BadRequestException.class, () ->
                courseService.updateCourse("crs_online", recordedUpdate)
        );
        assertEquals("Course mode cannot be changed after creation.", ex1.getMessage());

        // 3. Online -> Hybrid is rejected
        Course hybridUpdate = new Course();
        hybridUpdate.setMode("Hybrid");
        BadRequestException ex2 = assertThrows(BadRequestException.class, () ->
                courseService.updateCourse("crs_online", hybridUpdate)
        );
        assertEquals("Course mode cannot be changed after creation.", ex2.getMessage());

        // 4. Recorded -> Online is rejected
        Course existingRecorded = new Course();
        existingRecorded.setId("crs_rec");
        existingRecorded.setMode("Recorded");
        when(courseRepository.findById("crs_rec")).thenReturn(Optional.of(existingRecorded));

        Course toOnlineUpdate = new Course();
        toOnlineUpdate.setMode("Online");
        BadRequestException ex3 = assertThrows(BadRequestException.class, () ->
                courseService.updateCourse("crs_rec", toOnlineUpdate)
        );
        assertEquals("Course mode cannot be changed after creation.", ex3.getMessage());

        // 5. Hybrid -> Online is rejected
        Course existingHybrid = new Course();
        existingHybrid.setId("crs_hyb");
        existingHybrid.setMode("Hybrid");
        when(courseRepository.findById("crs_hyb")).thenReturn(Optional.of(existingHybrid));

        BadRequestException ex4 = assertThrows(BadRequestException.class, () ->
                courseService.updateCourse("crs_hyb", toOnlineUpdate)
        );
        assertEquals("Course mode cannot be changed after creation.", ex4.getMessage());
    }
}
