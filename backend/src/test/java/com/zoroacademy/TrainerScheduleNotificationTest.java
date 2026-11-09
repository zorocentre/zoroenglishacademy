package com.zoroacademy;

import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.Notification;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.NotificationRepository;
import com.zoroacademy.repository.ScheduleRepository;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.service.ScheduleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class TrainerScheduleNotificationTest {

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String TEST_PREFIX = "ZZTEST_";
    private String trainerId;
    private String courseId;
    private String scheduleId;

    @BeforeEach
    void setUp() {
        cleanTestData();

        trainerId = TEST_PREFIX + "trainer_s_" + System.currentTimeMillis();
        User trainer = new User();
        trainer.setId(trainerId);
        trainer.setName("ZZTEST Trainer S");
        trainer.setEmail(TEST_PREFIX + "trainer_s@test.com");
        trainer.setPassword("password123!");
        trainer.setRole("TRAINER");
        userRepository.save(trainer);

        courseId = TEST_PREFIX + "crs_s_" + System.currentTimeMillis();
        Course course = new Course();
        course.setId(courseId);
        course.setTitle("ZZTEST Notification Course");
        course.setMode("Online");
        course.setAudience("student");
        course.setAssignedTrainer("ZZTEST Trainer S");
        course.setTrainerId(trainerId);
        courseRepository.save(course);
    }

    @AfterEach
    void tearDown() {
        cleanTestData();
    }

    private void cleanTestData() {
        if (scheduleId != null) {
            scheduleRepository.findById(scheduleId).ifPresent(scheduleRepository::delete);
        }
        if (courseId != null) {
            courseRepository.findById(courseId).ifPresent(courseRepository::delete);
        }
        if (trainerId != null) {
            List<Notification> notifs = notificationRepository.findAll();
            for (Notification n : notifs) {
                if (trainerId.equals(n.getRecipientId()) || (n.getMessage() != null && n.getMessage().contains(TEST_PREFIX))) {
                    notificationRepository.delete(n);
                }
            }
            userRepository.findById(trainerId).ifPresent(userRepository::delete);
        }
    }

    @Test
    @DisplayName("Creates exactly one schedule notification in IST for assigned trainer on create and update")
    void testTrainerScheduleNotification() {
        Schedule sched = new Schedule();
        sched.setTitle("ZZTEST Live Session 1");
        sched.setCourse("ZZTEST Notification Course");
        sched.setCourseId(courseId);
        sched.setTrainerId(trainerId);
        sched.setTrainer("ZZTEST Trainer S");
        sched.setDate(LocalDate.now().plusDays(1).toString());
        sched.setTime("10:00 AM - 11:00 AM");
        sched.setMeetLink("https://meet.google.com/meet/rks-qoss-swb");

        Schedule created = scheduleService.createSchedule(sched);
        scheduleId = created.getId();

        // 1. Verify meet link was normalized
        assertThat(created.getMeetLink()).isEqualTo("https://meet.google.com/rks-qoss-swb");

        // 2. Verify trainer notification was created
        List<Notification> trainerNotifs = notificationRepository.findAll().stream()
                .filter(n -> trainerId.equals(n.getRecipientId()))
                .toList();

        assertThat(trainerNotifs).hasSize(1);
        Notification notif = trainerNotifs.get(0);
        assertThat(notif.getTitle()).contains("Scheduled");
        assertThat(notif.getTitle()).contains("ZZTEST Live Session 1");
        assertThat(notif.getMessage()).contains("IST");
        assertThat(notif.getMessage()).contains("ZZTEST Notification Course");

        // 3. Update / Reschedule
        Schedule updateDto = new Schedule();
        updateDto.setStartTime("11:30");
        updateDto.setEndTime("12:30");
        updateDto.setTime("11:30 AM - 12:30 PM");
        updateDto.setDate(created.getDate());
        updateDto.setCourseId(courseId);
        updateDto.setTrainerId(trainerId);
        scheduleService.updateSchedule(scheduleId, updateDto);

        List<Notification> updatedNotifs = notificationRepository.findAll().stream()
                .filter(n -> trainerId.equals(n.getRecipientId()))
                .toList();

        assertThat(updatedNotifs).hasSize(2);
        Notification updateNotif = updatedNotifs.stream()
                .filter(n -> n.getTitle() != null && n.getTitle().contains("Rescheduled"))
                .findFirst()
                .orElseThrow();

        assertThat(updateNotif.getMessage()).contains("IST");
        assertThat(updateNotif.getMessage()).contains("11:30 AM");
    }
}
