package com.zoroacademy;

import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.ScheduleRepository;
import com.zoroacademy.service.ScheduleService;
import com.zoroacademy.util.ScheduleTimeUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TrainerSessionsWorkflowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private CourseRepository courseRepository;

    private static final String TEST_PREFIX = "ZZTEST_";
    private String testCourseId;
    private String testScheduleUpcomingId;
    private String testScheduleLiveId;
    private String testScheduleEndedId;

    @BeforeEach
    void setUp() {
        cleanTestData();

        // Create trainer course
        testCourseId = TEST_PREFIX + "CRS_TRAINER";
        Course trainerCourse = new Course();
        trainerCourse.setId(testCourseId);
        trainerCourse.setTitle("ZZTEST Advanced Trainer Pedagogy");
        trainerCourse.setSlug("zztest-trainer-pedagogy");
        trainerCourse.setAudience("trainer");
        trainerCourse.setMode("Online");
        trainerCourse.setEnrolled(5);
        trainerCourse.setGoogleMeetUrl("https://meet.google.com/pqr-stuv-wxy");
        courseRepository.save(trainerCourse);

        ZonedDateTime now = ScheduleTimeUtil.nowInKolkata();
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("hh:mm a");

        // 1. Upcoming session (tomorrow)
        testScheduleUpcomingId = TEST_PREFIX + "SCH_UPCOMING";
        Schedule upcoming = new Schedule();
        upcoming.setId(testScheduleUpcomingId);
        upcoming.setTitle("ZZTEST Upcoming Trainer Session");
        upcoming.setCourse("ZZTEST Advanced Trainer Pedagogy");
        upcoming.setCourseId(testCourseId);
        upcoming.setBatch("Trainer Cohort 1");
        upcoming.setTrainer("Admin");
        upcoming.setDate(now.plusDays(1).format(dateFmt));
        upcoming.setTime("10:00 AM - 11:00 AM");
        upcoming.setMeetLink("https://meet.google.com/pqr-stuv-wxy");
        upcoming.setAudience("TRAINER");
        scheduleRepository.save(upcoming);

        // 2. Live session (current time window)
        testScheduleLiveId = TEST_PREFIX + "SCH_LIVE";
        Schedule live = new Schedule();
        live.setId(testScheduleLiveId);
        live.setTitle("ZZTEST Live Trainer Session");
        live.setCourse("ZZTEST Advanced Trainer Pedagogy");
        live.setCourseId(testCourseId);
        live.setBatch("Trainer Cohort 1");
        live.setTrainer("Admin");
        live.setDate(now.format(dateFmt));
        ZonedDateTime liveStart = now.minusMinutes(5);
        ZonedDateTime liveEnd = (now.getHour() == 23 && now.getMinute() >= 50)
                ? now.withMinute(59)
                : now.plusMinutes(10);
        live.setTime(liveStart.format(timeFmt) + " - " + liveEnd.format(timeFmt));
        live.setMeetLink("https://meet.google.com/pqr-stuv-wxy");
        live.setAudience("TRAINER");
        scheduleRepository.save(live);

        // 3. Ended session (yesterday)
        testScheduleEndedId = TEST_PREFIX + "SCH_ENDED";
        Schedule ended = new Schedule();
        ended.setId(testScheduleEndedId);
        ended.setTitle("ZZTEST Ended Trainer Session");
        ended.setCourse("ZZTEST Advanced Trainer Pedagogy");
        ended.setCourseId(testCourseId);
        ended.setBatch("Trainer Cohort 1");
        ended.setTrainer("Admin");
        ended.setDate(now.minusDays(1).format(dateFmt));
        ended.setTime("10:00 AM - 11:00 AM");
        ended.setMeetLink("https://meet.google.com/pqr-stuv-wxy");
        ended.setAudience("TRAINER");
        scheduleRepository.save(ended);
    }

    @AfterEach
    void tearDown() {
        cleanTestData();
    }

    private void cleanTestData() {
        if (testScheduleUpcomingId != null) scheduleRepository.deleteById(testScheduleUpcomingId);
        if (testScheduleLiveId != null) scheduleRepository.deleteById(testScheduleLiveId);
        if (testScheduleEndedId != null) scheduleRepository.deleteById(testScheduleEndedId);
        if (testCourseId != null) courseRepository.deleteById(testCourseId);
    }

    @Test
    @DisplayName("P3.1: Admin gets trainer-audience live course schedules; non-admin is forbidden")
    @WithMockUser(username = "admin@zoro.com", roles = {"ADMIN"})
    void testGetTrainerAudienceSchedulesAsAdmin() throws Exception {
        mockMvc.perform(get("/api/schedules/admin/trainer-sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        List<Schedule> list = scheduleService.getTrainerAudienceSchedules();
        assertThat(list).isNotEmpty();
        assertThat(list).anyMatch(s -> s.getId().equals(testScheduleLiveId));
        assertThat(list).anyMatch(s -> s.getId().equals(testScheduleUpcomingId));
        assertThat(list).anyMatch(s -> s.getId().equals(testScheduleEndedId));

        // Check enrichment (Task I1 computes Ongoing during active session window)
        Schedule liveItem = list.stream().filter(s -> s.getId().equals(testScheduleLiveId)).findFirst().orElseThrow();
        assertThat(liveItem.getStatus()).isEqualTo("Ongoing");
        assertThat(liveItem.getStudentsCount()).isGreaterThanOrEqualTo(0);

        Schedule upcomingItem = list.stream().filter(s -> s.getId().equals(testScheduleUpcomingId)).findFirst().orElseThrow();
        assertThat(upcomingItem.getStatus()).isEqualTo("Upcoming");
    }

    @Test
    @DisplayName("P3.2: Non-admin calling /api/schedules/admin/trainer-sessions receives 403 Forbidden")
    @WithMockUser(username = "student@example.com", roles = {"STUDENT"})
    void testGetTrainerAudienceSchedulesAsStudentForbidden() throws Exception {
        mockMvc.perform(get("/api/schedules/admin/trainer-sessions"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("P3.3: Start session outside window throws 403 Forbidden; inside window returns 200 OK with meetUrl")
    void testStartSessionTimeWindowRestrictions() {
        // 1. Upcoming session -> AccessDeniedException outside window
        assertThatThrownBy(() -> scheduleService.startSchedule(testScheduleUpcomingId, "admin_1", "admin@zoro.com", "ADMIN"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Session has not started yet");

        // 2. Ended session -> AccessDeniedException outside window
        assertThatThrownBy(() -> scheduleService.startSchedule(testScheduleEndedId, "admin_1", "admin@zoro.com", "ADMIN"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Session has already ended");

        // 3. Live session inside window -> 200 OK with meetUrl
        Map<String, Object> liveResult = scheduleService.startSchedule(testScheduleLiveId, "admin_1", "admin@zoro.com", "ADMIN");
        assertThat(liveResult).isNotNull();
        assertThat(liveResult.get("meetUrl")).isNotNull();
        assertThat(liveResult.get("status")).isEqualTo("Present");
    }
}
