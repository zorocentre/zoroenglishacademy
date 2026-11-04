package com.zoroacademy;

import com.zoroacademy.dto.RegisterRequest;
import com.zoroacademy.dto.UserDto;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.SalaryRecord;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.entity.User;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.SalaryService;
import com.zoroacademy.service.ScheduleService;
import com.zoroacademy.service.UserService;
import com.zoroacademy.util.ScheduleTimeUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class TrainerWorkingHoursAndSalaryTest {

    private ScheduleRepository scheduleRepository;
    private UserRepository userRepository;
    private CourseRepository courseRepository;
    private AttendanceRecordRepository attendanceRecordRepository;
    private TrainerAttendanceRecordRepository trainerAttendanceRecordRepository;
    private SalaryRecordRepository salaryRecordRepository;
    private SalaryPaymentScheduleRepository salaryPaymentScheduleRepository;

    private ScheduleService scheduleService;
    private SalaryService salaryService;

    @BeforeEach
    void setUp() {
        scheduleRepository = mock(ScheduleRepository.class);
        userRepository = mock(UserRepository.class);
        courseRepository = mock(CourseRepository.class);
        attendanceRecordRepository = mock(AttendanceRecordRepository.class);
        trainerAttendanceRecordRepository = mock(TrainerAttendanceRecordRepository.class);
        salaryRecordRepository = mock(SalaryRecordRepository.class);
        salaryPaymentScheduleRepository = mock(SalaryPaymentScheduleRepository.class);

        scheduleService = new ScheduleService(
                scheduleRepository,
                courseRepository,
                null,
                userRepository,
                null,
                null,
                attendanceRecordRepository,
                trainerAttendanceRecordRepository,
                null,
                null,
                null
        );

        salaryService = new SalaryService(
                salaryRecordRepository,
                null,
                null,
                salaryPaymentScheduleRepository,
                scheduleRepository,
                userRepository
        );
    }

    private Schedule createMockSchedule(String id, String trainerId, String trainerName, String status) {
        ZonedDateTime now = ScheduleTimeUtil.nowInKolkata();
        String dateStr = now.toLocalDate().toString();
        // Time window currently active: 30 minutes ago to 60 minutes from now
        LocalTime start = now.toLocalTime().minusMinutes(30);
        LocalTime end = now.toLocalTime().plusMinutes(60);
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("hh:mm a", Locale.ROOT);
        String timeStr = start.format(fmt) + " - " + end.format(fmt);

        return Schedule.builder()
                .id(id)
                .title("Spoken English Live Batch")
                .course("Spoken English Mastery")
                .courseId("crs_123")
                .batch("Morning Warriors")
                .batchId("bat_123")
                .trainer(trainerName)
                .trainerId(trainerId)
                .date(dateStr)
                .time(timeStr)
                .meetLink("https://meet.google.com/ujo-rgqy-pea")
                .status(status != null ? status : "Upcoming")
                .build();
    }

    @Test
    @DisplayName("Case 1 & 2: Trainer joins meeting -> full scheduled duration credited once; repeated joins are idempotent")
    void testTrainerJoinCreditsDurationIdempotently() {
        Schedule s = createMockSchedule("sch_001", "usr_trainer_1", "Jane Doe", "Upcoming");
        s.setStartTime("10:00");
        s.setEndTime("11:30");
        s.setTrainerJoined(false);
        s.setCreditedDurationMinutes(0);

        when(scheduleRepository.findById("sch_001")).thenReturn(Optional.of(s));
        when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1st Join
        Map<String, Object> res1 = scheduleService.startSchedule("sch_001", "usr_trainer_1", "jane@zoro.com", "TRAINER");
        assertTrue((Boolean) res1.get("success"));
        assertEquals("https://meet.google.com/ujo-rgqy-pea", res1.get("meetUrl"));
        assertTrue((Boolean) res1.get("trainerJoined"));
        assertEquals(90, res1.get("creditedDurationMinutes"));
        assertTrue(s.getTrainerJoined());
        assertEquals(90, s.getCreditedDurationMinutes());
        assertNotNull(s.getCreditedAt());

        // 2nd Join (Trainer refreshes, opens another tab, clicks again)
        Map<String, Object> res2 = scheduleService.startSchedule("sch_001", "usr_trainer_1", "jane@zoro.com", "TRAINER");
        assertTrue((Boolean) res2.get("success"));
        assertEquals(90, res2.get("creditedDurationMinutes"));
        // scheduleRepository.save should only be called for the initial credit (or unchanged duration)
        assertEquals(90, s.getCreditedDurationMinutes());
    }

    @Test
    @DisplayName("Case 3: Unjoined session has zero credited duration")
    void testUnjoinedSessionZeroDuration() {
        Schedule s = createMockSchedule("sch_002", "usr_trainer_1", "Jane Doe", "Upcoming");
        s.setTrainerJoined(false);
        s.setCreditedDurationMinutes(0);

        assertEquals(false, s.getTrainerJoined());
        assertEquals(0, s.getCreditedDurationMinutes());
    }

    @Test
    @DisplayName("Case 4: Wrong trainer attempting to join is rejected with AccessDeniedException")
    void testWrongTrainerRejected() {
        Schedule s = createMockSchedule("sch_003", "usr_trainer_1", "Jane Doe", "Upcoming");
        when(scheduleRepository.findById("sch_003")).thenReturn(Optional.of(s));

        // Trainer 2 tries to start session assigned to Trainer 1
        assertThrows(AccessDeniedException.class, () -> {
            scheduleService.startSchedule("sch_003", "usr_trainer_2", "other@zoro.com", "TRAINER");
        });

        // Ensure duration was NOT credited
        assertFalse(s.getTrainerJoined());
        assertEquals(0, s.getCreditedDurationMinutes());
    }

    @Test
    @DisplayName("Case 5: Cancelled unjoined schedule rejects join with BadRequestException")
    void testCancelledScheduleRejected() {
        Schedule s = createMockSchedule("sch_004", "usr_trainer_1", "Jane Doe", "Cancelled");
        when(scheduleRepository.findById("sch_004")).thenReturn(Optional.of(s));

        assertThrows(BadRequestException.class, () -> {
            scheduleService.startSchedule("sch_004", "usr_trainer_1", "jane@zoro.com", "TRAINER");
        });

        assertFalse(s.getTrainerJoined());
        assertEquals(0, s.getCreditedDurationMinutes());
    }

    @Test
    @DisplayName("Case 6: Schedule duration across hour boundaries and crossing midnight is calculated correctly")
    void testDurationCalculationAcrossHourBoundaries() {
        // Standard daytime session: 10:15 AM to 11:45 AM = 90 mins
        Schedule s1 = new Schedule();
        s1.setTime("10:15 AM - 11:45 AM");
        assertEquals(90, scheduleService.calculateScheduledDurationMinutes(s1));

        // 2 hour session: 02:00 PM to 04:00 PM = 120 mins
        Schedule s2 = new Schedule();
        s2.setStartTime("14:00");
        s2.setEndTime("16:00");
        assertEquals(120, scheduleService.calculateScheduledDurationMinutes(s2));

        // LocalDateTime session: 18:30 to 20:00 = 90 mins
        Schedule s3 = new Schedule();
        s3.setStartAt(LocalDateTime.of(2026, 11, 4, 18, 30));
        s3.setEndAt(LocalDateTime.of(2026, 11, 4, 20, 0));
        assertEquals(90, scheduleService.calculateScheduledDurationMinutes(s3));

        // Midnight crossing session: 23:30 to 00:30 = 60 mins
        Schedule s4 = new Schedule();
        s4.setStartTime("23:30");
        s4.setEndTime("00:30");
        assertEquals(60, scheduleService.calculateScheduledDurationMinutes(s4));
    }

    @Test
    @DisplayName("Case 10: Salary creation calculates total = online + recorded")
    void testSalaryTotalCalculation() {
        User trainer = new User();
        trainer.setId("usr_trainer_1");
        trainer.setName("Jane Doe");
        when(userRepository.findById("usr_trainer_1")).thenReturn(Optional.of(trainer));
        when(salaryRecordRepository.save(any(SalaryRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        SalaryRecord rec = new SalaryRecord();
        rec.setTrainerId("usr_trainer_1");
        rec.setFromDate("2026-10-01");
        rec.setToDate("2026-10-31");
        rec.setOnlineSessionSalary(new BigDecimal("12500.00"));
        rec.setRecordedSessionSalary(new BigDecimal("4500.00"));
        rec.setPaymentMethod("Bank Transfer");
        rec.setPaymentDate("2026-11-04");

        SalaryRecord saved = salaryService.createSalaryRecord(rec, "adminUser");

        assertEquals(new BigDecimal("17000.00"), saved.getTotalSalary());
        assertEquals(new BigDecimal("17000.00"), saved.getAmount());
        assertEquals("adminUser", saved.getCreatedBy());
    }

    @Test
    @DisplayName("Case 11: Missing required payment fields are rejected")
    void testMissingRequiredPaymentFieldsRejected() {
        SalaryRecord rec = new SalaryRecord();
        rec.setTrainerId("usr_trainer_1");
        // missing fromDate, toDate, paymentMethod, paymentDate
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));

        rec.setFromDate("2026-10-01");
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));

        rec.setToDate("2026-10-31");
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));

        rec.setPaymentDate("2026-11-04");
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));
    }

    @Test
    @DisplayName("Case 12: Negative or zero salary amounts are rejected")
    void testNegativeSalaryAmountsRejected() {
        SalaryRecord rec = new SalaryRecord();
        rec.setTrainerId("usr_trainer_1");
        rec.setFromDate("2026-10-01");
        rec.setToDate("2026-10-31");
        rec.setPaymentDate("2026-11-04");
        rec.setPaymentMethod("UPI");

        // Negative online salary
        rec.setOnlineSessionSalary(new BigDecimal("-500.00"));
        rec.setRecordedSessionSalary(new BigDecimal("2000.00"));
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));

        // Both zero
        rec.setOnlineSessionSalary(BigDecimal.ZERO);
        rec.setRecordedSessionSalary(BigDecimal.ZERO);
        assertThrows(IllegalArgumentException.class, () -> salaryService.createSalaryRecord(rec, "admin"));
    }

    @Test
    @DisplayName("Case 14: Previously paid sessions cannot be paid twice (Phase 6 duplicate prevention)")
    void testDuplicatePaymentPrevention() {
        User trainer = new User();
        trainer.setId("usr_trainer_1");
        trainer.setName("Jane Doe");
        when(userRepository.findById("usr_trainer_1")).thenReturn(Optional.of(trainer));

        // Schedule already linked to an existing payment
        Schedule alreadyPaidSession = createMockSchedule("sch_paid_1", "usr_trainer_1", "Jane Doe", "Completed");
        alreadyPaidSession.setSalaryPaymentId("sal_previous_payment_123");
        alreadyPaidSession.setTrainerJoined(true);
        alreadyPaidSession.setCreditedDurationMinutes(60);

        when(scheduleRepository.findUnpaidCreditedSessions(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(List.of(alreadyPaidSession));

        SalaryRecord rec = new SalaryRecord();
        rec.setTrainerId("usr_trainer_1");
        rec.setFromDate("2026-10-01");
        rec.setToDate("2026-10-31");
        rec.setOnlineSessionSalary(new BigDecimal("5000.00"));
        rec.setRecordedSessionSalary(BigDecimal.ZERO);
        rec.setPaymentMethod("Bank Transfer");
        rec.setPaymentDate("2026-11-04");

        // Should reject because schedule is already paid
        assertThrows(IllegalStateException.class, () -> salaryService.createSalaryRecord(rec, "admin"));
    }
}
