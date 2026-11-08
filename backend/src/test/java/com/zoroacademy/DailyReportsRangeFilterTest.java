package com.zoroacademy;

import com.zoroacademy.entity.ActivityLog;
import com.zoroacademy.repository.ActivityLogRepository;
import com.zoroacademy.service.ActivityLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.*;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class DailyReportsRangeFilterTest {

    private ActivityLogRepository activityLogRepository;
    private ActivityLogService activityLogService;

    @BeforeEach
    void setUp() {
        activityLogRepository = mock(ActivityLogRepository.class);
        activityLogService = new ActivityLogService(activityLogRepository);
    }

    @Test
    void testIstDateCalculationsWithFixedClock() {
        // Mock a fixed clock at 2026-11-09 01:30:00 IST (which is 2026-11-08 20:00:00 UTC)
        ZoneId istZone = ZoneId.of("Asia/Kolkata");
        Instant instant = Instant.parse("2026-11-08T20:00:00Z");
        Clock fixedClock = Clock.fixed(instant, istZone);

        LocalDate todayIst = LocalDate.now(fixedClock);
        assertEquals(LocalDate.of(2026, 11, 9), todayIst, "In IST it should be 2026-11-09 despite UTC being 2026-11-08");

        LocalDate yesterdayIst = todayIst.minusDays(1);
        assertEquals(LocalDate.of(2026, 11, 8), yesterdayIst);

        // Monday-Sunday convention: DayOfWeek.MONDAY
        LocalDate mondayIst = todayIst.with(DayOfWeek.MONDAY);
        assertEquals(LocalDate.of(2026, 11, 9), mondayIst);

        // Test with a Sunday: 2026-11-15 15:00:00 IST
        Instant sundayInstant = Instant.parse("2026-11-15T09:30:00Z");
        Clock sundayClock = Clock.fixed(sundayInstant, istZone);
        LocalDate sundayIst = LocalDate.now(sundayClock);
        assertEquals(DayOfWeek.SUNDAY, sundayIst.getDayOfWeek());
        LocalDate mondayOfSundayWeek = sundayIst.with(DayOfWeek.MONDAY);
        assertEquals(LocalDate.of(2026, 11, 9), mondayOfSundayWeek);
    }

    @Test
    void testActivityLogServiceIstToUtcBoundaryConversion() {
        when(activityLogRepository.filterLogs(any(), any(), any(), any(), any()))
                .thenReturn(Collections.emptyList());

        // Request logs for Today (2026-11-09 to 2026-11-09 IST)
        activityLogService.getLogs("2026-11-09", "2026-11-09", "ALL", "ALL", "ALL");

        ArgumentCaptor<LocalDateTime> fromCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> toCaptor = ArgumentCaptor.forClass(LocalDateTime.class);

        verify(activityLogRepository).filterLogs(isNull(), isNull(), isNull(), fromCaptor.capture(), toCaptor.capture());

        LocalDateTime fromUtc = fromCaptor.getValue();
        LocalDateTime toUtc = toCaptor.getValue();

        assertNotNull(fromUtc);
        assertNotNull(toUtc);

        // 2026-11-09 00:00:00 IST = 2026-11-08 18:30:00 UTC
        assertEquals(LocalDateTime.of(2026, 11, 8, 18, 30, 0), fromUtc);

        // 2026-11-09 23:59:59.999 IST = 2026-11-09 18:29:59.999 UTC
        assertEquals(LocalDateTime.of(2026, 11, 9, 18, 29, 59, 999_000_000), toUtc);
    }

    @Test
    void testActivityLogServiceMultiDayRangeIstToUtc() {
        when(activityLogRepository.filterLogs(any(), any(), any(), any(), any()))
                .thenReturn(Collections.emptyList());

        // Request logs for This Week (Monday 2026-11-03 to Sunday 2026-11-09 IST)
        activityLogService.getLogs("2026-11-03", "2026-11-09", "COURSES", "COURSE_CREATED", "admin");

        ArgumentCaptor<LocalDateTime> fromCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> toCaptor = ArgumentCaptor.forClass(LocalDateTime.class);

        verify(activityLogRepository).filterLogs(eq("COURSES"), eq("COURSE_CREATED"), eq("admin"), fromCaptor.capture(), toCaptor.capture());

        LocalDateTime fromUtc = fromCaptor.getValue();
        LocalDateTime toUtc = toCaptor.getValue();

        assertEquals(LocalDateTime.of(2026, 11, 2, 18, 30, 0), fromUtc);
        assertEquals(LocalDateTime.of(2026, 11, 9, 18, 29, 59, 999_000_000), toUtc);
    }
}
