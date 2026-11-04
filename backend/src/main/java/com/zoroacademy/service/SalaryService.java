package com.zoroacademy.service;

import com.zoroacademy.entity.Notification;
import com.zoroacademy.entity.SalaryRecord;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.repository.NotificationRepository;
import com.zoroacademy.repository.SalaryPaymentScheduleRepository;
import com.zoroacademy.repository.SalaryRecordRepository;
import com.zoroacademy.repository.ScheduleRepository;
import com.zoroacademy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class SalaryService {

    private final SalaryRecordRepository salaryRepository;
    private final NotificationRepository notificationRepository;
    private final ActivityLogService activityLogService;
    private final SalaryPaymentScheduleRepository salaryPaymentScheduleRepository;
    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;

    @Autowired
    public SalaryService(SalaryRecordRepository salaryRepository,
                         @Autowired(required = false) NotificationRepository notificationRepository,
                         @Autowired(required = false) ActivityLogService activityLogService,
                         @Autowired(required = false) SalaryPaymentScheduleRepository salaryPaymentScheduleRepository,
                         @Autowired(required = false) ScheduleRepository scheduleRepository,
                         @Autowired(required = false) UserRepository userRepository) {
        this.salaryRepository = salaryRepository;
        this.notificationRepository = notificationRepository;
        this.activityLogService = activityLogService;
        this.salaryPaymentScheduleRepository = salaryPaymentScheduleRepository;
        this.scheduleRepository = scheduleRepository;
        this.userRepository = userRepository;
    }

    public SalaryService(SalaryRecordRepository salaryRepository,
                         NotificationRepository notificationRepository) {
        this(salaryRepository, notificationRepository, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<SalaryRecord> getAllSalaryRecords() {
        return salaryRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<SalaryRecord> getTrainerSalaryRecords(String trainerId) {
        return salaryRepository.findByTrainerId(trainerId);
    }

    @Transactional(readOnly = true)
    public List<Schedule> getPaymentSessions(String paymentId) {
        if (paymentId == null || paymentId.isBlank() || scheduleRepository == null) {
            return java.util.Collections.emptyList();
        }
        return scheduleRepository.findBySalaryPaymentId(paymentId);
    }

    @Transactional
    public SalaryRecord createSalaryRecord(SalaryRecord record) {
        return createSalaryRecord(record, null);
    }

    @Transactional
    public SalaryRecord createSalaryRecord(SalaryRecord record, String adminUsername) {
        if (record == null) {
            throw new IllegalArgumentException("Salary record payload cannot be empty");
        }
        if (record.getTrainerId() == null || record.getTrainerId().isBlank()) {
            throw new IllegalArgumentException("Trainer is required");
        }
        if (record.getFromDate() == null || record.getFromDate().isBlank()) {
            throw new IllegalArgumentException("From date is required");
        }
        if (record.getToDate() == null || record.getToDate().isBlank()) {
            throw new IllegalArgumentException("To date is required");
        }
        if (record.getFromDate().compareTo(record.getToDate()) > 0) {
            throw new IllegalArgumentException("From date cannot be after To date");
        }
        if (record.getPaymentDate() == null || record.getPaymentDate().isBlank()) {
            throw new IllegalArgumentException("Date of payment is required");
        }
        if (record.getPaymentMethod() == null || record.getPaymentMethod().isBlank()) {
            throw new IllegalArgumentException("Payment method is required");
        }

        BigDecimal online = record.getOnlineSessionSalary() != null ? record.getOnlineSessionSalary() : BigDecimal.ZERO;
        BigDecimal recorded = record.getRecordedSessionSalary() != null ? record.getRecordedSessionSalary() : BigDecimal.ZERO;

        if (online.compareTo(BigDecimal.ZERO) < 0 || recorded.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Salary amounts cannot be negative");
        }

        BigDecimal total = online.add(recorded);
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Total salary must be greater than zero");
        }

        // Resolve trainer
        String trainerId = record.getTrainerId().trim();
        String trainerName = record.getTrainerName();
        if (userRepository != null) {
            com.zoroacademy.entity.User user = userRepository.findById(trainerId).orElse(null);
            if (user == null) {
                user = userRepository.findByEmailIgnoreCase(trainerId).orElse(null);
            }
            if (user != null) {
                trainerId = user.getId();
                if (user.getName() != null && !user.getName().isBlank()) {
                    trainerName = user.getName();
                }
            }
        }
        record.setTrainerId(trainerId);
        record.setTrainerName(trainerName != null ? trainerName : trainerId);

        if (record.getId() == null || record.getId().isBlank()) {
            record.setId("sal_" + UUID.randomUUID().toString());
        }
        record.setOnlineSessionSalary(online);
        record.setRecordedSessionSalary(recorded);
        record.setTotalSalary(total);
        record.setAmount(total); // Keep amount in sync for legacy compatibility
        record.setStatus("Paid");
        if (record.getMonth() == null || record.getMonth().isBlank()) {
            record.setMonth(record.getFromDate() + " to " + record.getToDate());
        }
        if (adminUsername != null && !adminUsername.isBlank()) {
            record.setCreatedBy(adminUsername);
        }

        // Query eligible credited sessions in this period
        List<Schedule> eligibleSessions = scheduleRepository != null
                ? scheduleRepository.findUnpaidCreditedSessions(trainerId, record.getTrainerName(), record.getFromDate(), record.getToDate())
                : java.util.Collections.emptyList();

        // Check if any of these sessions was already associated with a payment (Phase 6 prevention)
        int totalMinutes = 0;
        for (Schedule s : eligibleSessions) {
            if (s.getSalaryPaymentId() != null) {
                throw new IllegalStateException("Session " + s.getId() + " on " + s.getDate() + " is already paid in salary payment " + s.getSalaryPaymentId());
            }
            if (salaryPaymentScheduleRepository != null && salaryPaymentScheduleRepository.existsByScheduleId(s.getId())) {
                throw new IllegalStateException("Session " + s.getId() + " on " + s.getDate() + " is already linked to an existing payment");
            }
            totalMinutes += s.getCreditedDurationMinutes() != null ? s.getCreditedDurationMinutes() : 0;
        }

        record.setSessionCount(eligibleSessions.size());
        BigDecimal creditedHours = BigDecimal.valueOf(totalMinutes / 60.0).setScale(2, java.math.RoundingMode.HALF_UP);
        record.setCreditedHours(creditedHours);

        SalaryRecord saved = salaryRepository.save(record);

        // Link eligible sessions to this salary payment atomically
        for (Schedule s : eligibleSessions) {
            s.setSalaryPaymentId(saved.getId());
            if (scheduleRepository != null) {
                scheduleRepository.save(s);
            }
            if (salaryPaymentScheduleRepository != null) {
                com.zoroacademy.entity.SalaryPaymentSchedule sps = new com.zoroacademy.entity.SalaryPaymentSchedule(
                        "sps_" + UUID.randomUUID().toString(),
                        saved.getId(),
                        s.getId(),
                        s.getCreditedDurationMinutes() != null ? s.getCreditedDurationMinutes() : 0
                );
                salaryPaymentScheduleRepository.save(sps);
            }
        }

        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getTrainerId(),
                saved.getTrainerName(),
                "SALARY",
                "CREATE_SALARY_RECORD",
                "Disbursed salary of Rs. " + saved.getTotalSalary() + " for trainer " + saved.getTrainerName() + " (" + saved.getFromDate() + " to " + saved.getToDate() + ") covering " + eligibleSessions.size() + " online sessions",
                null
            );
        }

        // Notify the trainer when payment is recorded
        if (notificationRepository != null && saved.getTrainerId() != null) {
            String period = saved.getFromDate() + " to " + saved.getToDate();
            Notification notif = Notification.builder()
                    .id("notif_" + UUID.randomUUID().toString())
                    .recipientRole("TRAINER")
                    .recipientId(saved.getTrainerId())
                    .title("Salary Credited")
                    .message("Your salary of ₹" + saved.getTotalSalary() + " for period " + period + " has been credited.")
                    .readStatus(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(notif);
        }

        return saved;
    }

    @Transactional
    public SalaryRecord updateSalaryRecord(String id, SalaryRecord updated) {
        SalaryRecord existing = salaryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Salary record not found: " + id));
        if (updated.getAmount() != null) existing.setAmount(updated.getAmount());
        if (updated.getTotalSalary() != null) existing.setTotalSalary(updated.getTotalSalary());
        if (updated.getOnlineSessionSalary() != null) existing.setOnlineSessionSalary(updated.getOnlineSessionSalary());
        if (updated.getRecordedSessionSalary() != null) existing.setRecordedSessionSalary(updated.getRecordedSessionSalary());
        if (updated.getFromDate() != null) existing.setFromDate(updated.getFromDate());
        if (updated.getToDate() != null) existing.setToDate(updated.getToDate());
        if (updated.getMonth() != null) existing.setMonth(updated.getMonth());
        if (updated.getPaymentDate() != null) existing.setPaymentDate(updated.getPaymentDate());
        if (updated.getPaymentMethod() != null) existing.setPaymentMethod(updated.getPaymentMethod());
        if (updated.getTransactionId() != null) existing.setTransactionId(updated.getTransactionId());
        if (updated.getNotes() != null) existing.setNotes(updated.getNotes());
        if (updated.getStatus() != null) existing.setStatus(updated.getStatus());
        SalaryRecord saved = salaryRepository.save(existing);
        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getTrainerId(),
                saved.getTrainerName(),
                "SALARY",
                "UPDATE_SALARY_RECORD",
                "Updated salary record for trainer " + (saved.getTrainerName() != null ? saved.getTrainerName() : saved.getTrainerId()) + " (" + saved.getId() + ")",
                null
            );
        }
        return saved;
    }

    @Transactional
    public void deleteSalaryRecord(String id) {
        salaryRepository.findById(id).ifPresent(sr -> {
            if (scheduleRepository != null) {
                List<Schedule> linked = scheduleRepository.findBySalaryPaymentId(sr.getId());
                for (Schedule s : linked) {
                    s.setSalaryPaymentId(null);
                    scheduleRepository.save(s);
                }
            }
            if (salaryPaymentScheduleRepository != null) {
                salaryPaymentScheduleRepository.deleteBySalaryPaymentId(sr.getId());
            }
            salaryRepository.delete(sr);
            if (activityLogService != null) {
                activityLogService.logAction(
                    sr.getTrainerId(),
                    sr.getTrainerName(),
                    "SALARY",
                    "DELETE_SALARY_RECORD",
                    "Deleted salary record for " + (sr.getTrainerName() != null ? sr.getTrainerName() : sr.getId()),
                    null
                );
            }
        });
    }
}
