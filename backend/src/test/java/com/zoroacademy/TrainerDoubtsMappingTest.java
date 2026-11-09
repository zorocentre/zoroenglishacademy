package com.zoroacademy;

import com.zoroacademy.entity.Batch;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.Doubt;
import com.zoroacademy.entity.StudentCourseBatch;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.BatchRepository;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.DoubtRepository;
import com.zoroacademy.repository.StudentCourseBatchRepository;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.service.DoubtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class TrainerDoubtsMappingTest {

    @Autowired
    private DoubtService doubtService;

    @Autowired
    private DoubtRepository doubtRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private StudentCourseBatchRepository studentCourseBatchRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String TEST_PREFIX = "ZZTEST_";
    private String trainerId;
    private String studentId;
    private String onlineCourseId;
    private String recordedCourseId;
    private String batchId;
    private Long enrollmentId;
    private String doubtOnlineWithBatchId;
    private String doubtOnlineEnrollmentId;
    private String doubtRecordedId;

    @BeforeEach
    void setUp() {
        cleanTestData();

        trainerId = TEST_PREFIX + "trainer_d_" + System.currentTimeMillis();
        User trainer = new User();
        trainer.setId(trainerId);
        trainer.setName("ZZTEST Trainer Doubts");
        trainer.setEmail(TEST_PREFIX + "trainer_d@test.com");
        trainer.setPassword("password123!");
        trainer.setRole("TRAINER");
        userRepository.save(trainer);

        studentId = TEST_PREFIX + "student_d_" + System.currentTimeMillis();
        User student = new User();
        student.setId(studentId);
        student.setName("ZZTEST Student Doubts");
        student.setEmail(TEST_PREFIX + "student_d@test.com");
        student.setPassword("password123!");
        student.setRole("STUDENT");
        userRepository.save(student);

        // Course 1: Online
        onlineCourseId = TEST_PREFIX + "crs_onl_" + System.currentTimeMillis();
        Course c1 = new Course();
        c1.setId(onlineCourseId);
        c1.setTitle("ZZTEST Spoken English Online");
        c1.setMode("Online");
        c1.setAudience("student");
        c1.setAssignedTrainer("ZZTEST Trainer Doubts");
        c1.setTrainerId(trainerId);
        courseRepository.save(c1);

        // Batch for Course 1
        batchId = TEST_PREFIX + "btc_onl_" + System.currentTimeMillis();
        Batch b = new Batch();
        b.setId(batchId);
        b.setName("Morning Batch A");
        b.setCourseName("ZZTEST Spoken English Online");
        b.setCourseId(onlineCourseId);
        b.setTrainerId(trainerId);
        batchRepository.save(b);

        // Student enrollment in batch
        StudentCourseBatch scb = new StudentCourseBatch();
        scb.setStudentId(studentId);
        scb.setCourseName("ZZTEST Spoken English Online");
        scb.setCourseId(onlineCourseId);
        scb.setBatchName("Morning Batch A");
        scb.setBatchId(batchId);
        StudentCourseBatch savedScb = studentCourseBatchRepository.save(scb);
        enrollmentId = savedScb.getId();

        // Course 2: Recorded
        recordedCourseId = TEST_PREFIX + "crs_rec_" + System.currentTimeMillis();
        Course c2 = new Course();
        c2.setId(recordedCourseId);
        c2.setTitle("ZZTEST Recorded Grammar");
        c2.setMode("Recorded");
        c2.setAudience("student");
        c2.setAssignedTrainer("ZZTEST Trainer Doubts");
        c2.setTrainerId(trainerId);
        courseRepository.save(c2);

        // Doubt 1: Online with explicit batchId
        doubtOnlineWithBatchId = TEST_PREFIX + "dbt_1_" + System.currentTimeMillis();
        Doubt d1 = new Doubt();
        d1.setId(doubtOnlineWithBatchId);
        d1.setStudentId(studentId);
        d1.setStudentName("ZZTEST Student Doubts");
        d1.setCourseId(onlineCourseId);
        d1.setCourseTitle("ZZTEST Spoken English Online");
        d1.setCourseMode("Online");
        d1.setBatchId(batchId);
        d1.setQuestion("How to improve fluency?");
        d1.setTrainerId(trainerId);
        d1.setStatus("Pending");
        doubtRepository.save(d1);

        // Doubt 2: Online with null batchId (should be resolved from student enrollment)
        doubtOnlineEnrollmentId = TEST_PREFIX + "dbt_2_" + System.currentTimeMillis();
        Doubt d2 = new Doubt();
        d2.setId(doubtOnlineEnrollmentId);
        d2.setStudentId(studentId);
        d2.setStudentName("ZZTEST Student Doubts");
        d2.setCourseId(onlineCourseId);
        d2.setCourseTitle("ZZTEST Spoken English Online");
        d2.setCourseMode("Online");
        d2.setBatchId(null);
        d2.setQuestion("Grammar rules question?");
        d2.setTrainerId(trainerId);
        d2.setStatus("Pending");
        doubtRepository.save(d2);

        // Doubt 3: Recorded course (batch must be null/empty)
        doubtRecordedId = TEST_PREFIX + "dbt_3_" + System.currentTimeMillis();
        Doubt d3 = new Doubt();
        d3.setId(doubtRecordedId);
        d3.setStudentId(studentId);
        d3.setStudentName("ZZTEST Student Doubts");
        d3.setCourseId(recordedCourseId);
        d3.setCourseTitle("ZZTEST Recorded Grammar");
        d3.setCourseMode("Recorded");
        d3.setBatchId("dummy_batch");
        d3.setQuestion("Recorded module 2 question?");
        d3.setTrainerId(trainerId);
        d3.setStatus("Pending");
        doubtRepository.save(d3);
    }

    @AfterEach
    void tearDown() {
        cleanTestData();
    }

    private void cleanTestData() {
        if (doubtOnlineWithBatchId != null) doubtRepository.findById(doubtOnlineWithBatchId).ifPresent(doubtRepository::delete);
        if (doubtOnlineEnrollmentId != null) doubtRepository.findById(doubtOnlineEnrollmentId).ifPresent(doubtRepository::delete);
        if (doubtRecordedId != null) doubtRepository.findById(doubtRecordedId).ifPresent(doubtRepository::delete);
        if (enrollmentId != null) studentCourseBatchRepository.findById(enrollmentId).ifPresent(studentCourseBatchRepository::delete);
        if (batchId != null) batchRepository.findById(batchId).ifPresent(batchRepository::delete);
        if (onlineCourseId != null) courseRepository.findById(onlineCourseId).ifPresent(courseRepository::delete);
        if (recordedCourseId != null) courseRepository.findById(recordedCourseId).ifPresent(courseRepository::delete);
        if (studentId != null) userRepository.findById(studentId).ifPresent(userRepository::delete);
        if (trainerId != null) userRepository.findById(trainerId).ifPresent(userRepository::delete);
    }

    @Test
    @DisplayName("Doubts resolve batchName for Online/Hybrid and omit batch for Recorded")
    void testDoubtsBatchResolution() {
        List<Doubt> doubts = doubtService.getDoubtsByTrainer(trainerId);

        Doubt d1 = doubts.stream().filter(d -> d.getId().equals(doubtOnlineWithBatchId)).findFirst().orElseThrow();
        assertThat(d1.getBatchName()).isEqualTo("Morning Batch A");

        Doubt d2 = doubts.stream().filter(d -> d.getId().equals(doubtOnlineEnrollmentId)).findFirst().orElseThrow();
        assertThat(d2.getBatchName()).isEqualTo("Morning Batch A");

        Doubt d3 = doubts.stream().filter(d -> d.getId().equals(doubtRecordedId)).findFirst().orElseThrow();
        assertThat(d3.getBatchId()).isNull();
        assertThat(d3.getBatchName()).isNull();
        assertThat(d3.getCourseMode()).isEqualTo("Recorded");
    }
}
