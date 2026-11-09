package com.zoroacademy;

import com.zoroacademy.entity.Batch;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.TrainerCourseRequest;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.BatchRepository;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.TrainerCourseRequestRepository;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.service.CourseService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class TrainerEligibleStudentCoursesTest {

    @Autowired
    private CourseService courseService;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private TrainerCourseRequestRepository trainerCourseRequestRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String TEST_PREFIX = "ZZTEST_";
    private String trainerId;
    private String trainerEmail;
    private String studentOnlineCourseId;
    private String studentRecordedCourseId;
    private String trainerAudienceCourseId;
    private String unassignedCourseId;
    private String testBatchId;
    private String testRequestId;

    @BeforeEach
    void setUp() {
        cleanTestData();

        trainerId = TEST_PREFIX + "trainer_" + System.currentTimeMillis();
        trainerEmail = TEST_PREFIX + "trainer@test.com";

        User trainer = new User();
        trainer.setId(trainerId);
        trainer.setName("ZZTEST Trainer");
        trainer.setEmail(trainerEmail);
        trainer.setPassword("password123!");
        trainer.setRole("TRAINER");
        userRepository.save(trainer);

        // 1. Student Online Course directly assigned
        studentOnlineCourseId = TEST_PREFIX + "crs_online_" + System.currentTimeMillis();
        Course onlineCrs = new Course();
        onlineCrs.setId(studentOnlineCourseId);
        onlineCrs.setTitle("ZZTEST Student Online");
        onlineCrs.setMode("Online");
        onlineCrs.setAudience("student");
        onlineCrs.setAssignedTrainer("ZZTEST Trainer");
        onlineCrs.setTrainerId(trainerId);
        courseRepository.save(onlineCrs);

        // 2. Student Recorded Course assigned via approved request
        studentRecordedCourseId = TEST_PREFIX + "crs_rec_" + System.currentTimeMillis();
        Course recCrs = new Course();
        recCrs.setId(studentRecordedCourseId);
        recCrs.setTitle("ZZTEST Student Recorded");
        recCrs.setMode("Recorded");
        recCrs.setAudience("student");
        courseRepository.save(recCrs);

        testRequestId = TEST_PREFIX + "req_" + System.currentTimeMillis();
        TrainerCourseRequest req = new TrainerCourseRequest();
        req.setId(testRequestId);
        req.setTrainerId(trainerId);
        req.setCourseId(studentRecordedCourseId);
        req.setStatus("Approved");
        trainerCourseRequestRepository.save(req);

        // 3. Trainer-Audience Course assigned to trainer (MUST BE EXCLUDED)
        trainerAudienceCourseId = TEST_PREFIX + "crs_trainer_pedagogy_" + System.currentTimeMillis();
        Course trainerCrs = new Course();
        trainerCrs.setId(trainerAudienceCourseId);
        trainerCrs.setTitle("ZZTEST Trainer Pedagogy");
        trainerCrs.setMode("Recorded");
        trainerCrs.setAudience("trainer");
        trainerCrs.setAssignedTrainer("ZZTEST Trainer");
        trainerCrs.setTrainerId(trainerId);
        courseRepository.save(trainerCrs);

        // 4. Unassigned course
        unassignedCourseId = TEST_PREFIX + "crs_unassigned_" + System.currentTimeMillis();
        Course unassigned = new Course();
        unassigned.setId(unassignedCourseId);
        unassigned.setTitle("ZZTEST Unassigned Course");
        unassigned.setMode("Online");
        unassigned.setAudience("student");
        courseRepository.save(unassigned);
    }

    @AfterEach
    void tearDown() {
        cleanTestData();
    }

    private void cleanTestData() {
        if (testRequestId != null) {
            trainerCourseRequestRepository.findById(testRequestId).ifPresent(trainerCourseRequestRepository::delete);
        }
        if (studentOnlineCourseId != null) {
            courseRepository.findById(studentOnlineCourseId).ifPresent(courseRepository::delete);
        }
        if (studentRecordedCourseId != null) {
            courseRepository.findById(studentRecordedCourseId).ifPresent(courseRepository::delete);
        }
        if (trainerAudienceCourseId != null) {
            courseRepository.findById(trainerAudienceCourseId).ifPresent(courseRepository::delete);
        }
        if (unassignedCourseId != null) {
            courseRepository.findById(unassignedCourseId).ifPresent(courseRepository::delete);
        }
        if (trainerId != null) {
            userRepository.findById(trainerId).ifPresent(userRepository::delete);
        }
    }

    @Test
    @DisplayName("Returns only eligible student courses and strictly excludes trainer-audience courses")
    void testEligibleStudentCoursesFilter() {
        List<Course> allEligible = courseService.getTrainerEligibleStudentCourses(trainerId, null);

        assertThat(allEligible).extracting(Course::getId)
                .contains(studentOnlineCourseId, studentRecordedCourseId)
                .doesNotContain(trainerAudienceCourseId, unassignedCourseId);

        // Submissions filter: Online/Hybrid only
        List<Course> submissionsEligible = courseService.getTrainerEligibleStudentCourses(trainerId, Set.of("Online", "Hybrid"));
        assertThat(submissionsEligible).extracting(Course::getId)
                .contains(studentOnlineCourseId)
                .doesNotContain(studentRecordedCourseId, trainerAudienceCourseId, unassignedCourseId);

        // Recorded sessions filter: Recorded only
        List<Course> recordedEligible = courseService.getTrainerEligibleStudentCourses(trainerId, Set.of("Recorded"));
        assertThat(recordedEligible).extracting(Course::getId)
                .contains(studentRecordedCourseId)
                .doesNotContain(studentOnlineCourseId, trainerAudienceCourseId, unassignedCourseId);

        // Eligibility check
        assertThat(courseService.isTrainerEligibleForStudentCourse(trainerId, studentOnlineCourseId, Set.of("Online", "Hybrid"))).isTrue();
        assertThat(courseService.isTrainerEligibleForStudentCourse(trainerId, studentRecordedCourseId, Set.of("Online", "Hybrid"))).isFalse();
        assertThat(courseService.isTrainerEligibleForStudentCourse(trainerId, trainerAudienceCourseId, Set.of("Recorded"))).isFalse();
    }
}
