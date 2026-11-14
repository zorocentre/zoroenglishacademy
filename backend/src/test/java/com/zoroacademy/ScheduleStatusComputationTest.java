package com.zoroacademy;

import com.zoroacademy.entity.Schedule;
import com.zoroacademy.repository.BatchRepository;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.ScheduleRepository;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.service.ScheduleService;
import com.zoroacademy.util.ScheduleTimeUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class ScheduleStatusComputationTest {

    private ScheduleService scheduleService;
    private static final ZoneId KOLKATA_ZONE = ScheduleTimeUtil.KOLKATA_ZONE;

    @BeforeEach
    void setUp() {
        ScheduleRepository scheduleRepository = Mockito.mock(ScheduleRepository.class);
        CourseRepository courseRepository = Mockito.mock(CourseRepository.class);
        BatchRepository batchRepository = Mockito.mock(BatchRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);

        scheduleService = new ScheduleService(scheduleRepository, courseRepository, batchRepository, userRepository);
    }

    private Schedule createTestSchedule(String date, String time, String initialStatus) {
        Schedule s = new Schedule();
        s.setId("sch_test_1");
        s.setTitle("Test Session");
        s.setDate(date);
        s.setTime(time);
        s.setStatus(initialStatus);
        return s;
    }

    @Test
    @DisplayName("Case 1: Before session start -> Status is Upcoming")
    void testBeforeStartIsUpcoming() {
        // Session 10:00 AM - 11:00 AM on 2026-11-20
        Schedule s = createTestSchedule("2026-11-20", "10:00 AM - 11:00 AM", "Upcoming");

        // Mock time at 09:59 AM IST
        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 20, 9, 59, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Upcoming", s.getStatus());
    }

    @Test
    @DisplayName("Case 2: Exactly at session start -> Status is Ongoing")
    void testExactlyAtStartIsOngoing() {
        Schedule s = createTestSchedule("2026-11-20", "10:00 AM - 11:00 AM", "Upcoming");

        // Mock time at 10:00:00 AM IST
        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 20, 10, 0, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Ongoing", s.getStatus());
    }

    @Test
    @DisplayName("Case 3: During session -> Status is Ongoing")
    void testDuringSessionIsOngoing() {
        Schedule s = createTestSchedule("2026-11-20", "10:00 AM - 11:00 AM", "Upcoming");

        // Mock time at 10:30 AM IST
        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 20, 10, 30, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Ongoing", s.getStatus());
    }

    @Test
    @DisplayName("Case 4: Exactly at session end -> Status is Completed")
    void testExactlyAtEndIsCompleted() {
        Schedule s = createTestSchedule("2026-11-20", "10:00 AM - 11:00 AM", "Upcoming");

        // Mock time at 11:00:00 AM IST
        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 20, 11, 0, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Completed", s.getStatus());
    }

    @Test
    @DisplayName("Case 5: After session end -> Status is Completed")
    void testAfterEndIsCompleted() {
        // Session 11:00 AM - 01:00 PM on 2026-11-13 (historical session from symptom)
        Schedule s = createTestSchedule("2026-11-13", "11:00 AM - 01:00 PM", "Upcoming");

        // Mock time at 2026-11-15 00:30 IST
        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 15, 0, 30, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Completed", s.getStatus());
    }

    @Test
    @DisplayName("Case 6: Rescheduled status keeps priority even after session end")
    void testRescheduledPreservesPriority() {
        Schedule s = createTestSchedule("2026-11-13", "11:00 AM - 01:00 PM", "Rescheduled");

        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 15, 0, 30, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Rescheduled", s.getStatus());
    }

    @Test
    @DisplayName("Case 7: Cancelled status keeps priority")
    void testCancelledPreservesPriority() {
        Schedule s = createTestSchedule("2026-11-13", "11:00 AM - 01:00 PM", "Cancelled");

        ZonedDateTime mockTime = ZonedDateTime.of(2026, 11, 15, 0, 30, 0, 0, KOLKATA_ZONE);
        scheduleService.setClock(Clock.fixed(mockTime.toInstant(), KOLKATA_ZONE));

        scheduleService.enrichSchedule(s);
        assertEquals("Cancelled", s.getStatus());
    }
}
