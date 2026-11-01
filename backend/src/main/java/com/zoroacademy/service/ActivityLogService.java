package com.zoroacademy.service;

import com.zoroacademy.entity.ActivityLog;
import com.zoroacademy.repository.ActivityLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.List;
import java.util.UUID;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository) {
        this.activityLogRepository = activityLogRepository;
    }

    @Transactional(readOnly = true)
    public List<ActivityLog> getRecentLogs() {
        return activityLogRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<ActivityLog> getLogs(String fromDateStr, String toDateStr, String module, String action, String actor) {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        LocalDateTime fromTime = null;
        LocalDateTime toTime = null;

        if (fromDateStr != null && !fromDateStr.isBlank()) {
            try {
                LocalDate fromDate = LocalDate.parse(fromDateStr.trim());
                fromTime = ZonedDateTime.of(fromDate, LocalTime.MIN, zone)
                        .withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
            } catch (Exception ignored) {}
        }

        if (toDateStr != null && !toDateStr.isBlank()) {
            try {
                LocalDate toDate = LocalDate.parse(toDateStr.trim());
                toTime = ZonedDateTime.of(toDate, LocalTime.of(23, 59, 59, 999_000_000), zone)
                        .withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
            } catch (Exception ignored) {}
        }

        String effModule = (module != null && !module.isBlank() && !"ALL".equalsIgnoreCase(module)) ? module : null;
        String effAction = (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action)) ? action : null;
        String effActor = (actor != null && !actor.isBlank() && !"ALL".equalsIgnoreCase(actor)) ? actor : null;

        return activityLogRepository.filterLogs(effModule, effAction, effActor, fromTime, toTime);
    }

    @Transactional
    public ActivityLog logAction(String userId, String userName, String module, String action, String details, String ipAddress) {
        ActivityLog log = ActivityLog.builder()
                .id("log_" + UUID.randomUUID())
                .userId(userId)
                .userName(userName)
                .module(module != null ? module : inferModuleFromAction(action))
                .action(action)
                .details(details)
                .ipAddress(ipAddress)
                .createdAt(LocalDateTime.now(ZoneId.of("UTC")))
                .build();
        return activityLogRepository.save(log);
    }

    @Transactional
    public ActivityLog logAction(String userId, String userName, String action, String details, String ipAddress) {
        String inferredModule = inferModuleFromAction(action);
        return logAction(userId, userName, inferredModule, action, details, ipAddress);
    }

    public String inferModuleFromAction(String action) {
        if (action == null) return "GENERAL";
        String upper = action.toUpperCase();
        if (upper.contains("COURSE")) return "COURSES";
        if (upper.contains("MODULE") || upper.contains("FILE")) return "MODULES";
        if (upper.contains("BATCH")) return "BATCHES";
        if (upper.contains("STUDENT")) return "STUDENTS";
        if (upper.contains("TRAINER")) return "TRAINERS";
        if (upper.contains("ATTENDANCE")) return "ATTENDANCE";
        if (upper.contains("SCHEDULE") || upper.contains("SESSION")) return "SCHEDULES";
        if (upper.contains("ASSIGNMENT") || upper.contains("SUBMISSION")) return "ASSIGNMENTS";
        if (upper.contains("DOUBT")) return "DOUBTS";
        if (upper.contains("ENQUIRY")) return "ENQUIRIES";
        if (upper.contains("FEE")) return "FEES";
        if (upper.contains("EXPENSE")) return "EXPENSES";
        if (upper.contains("SALARY")) return "SALARY";
        if (upper.contains("NOTIFICATION")) return "NOTIFICATIONS";
        if (upper.contains("SETTING")) return "SETTINGS";
        if (upper.contains("COMPETITION") || upper.contains("ASSESSMENT") || upper.contains("EVALUATION")) return "COMPETITIONS";
        return "GENERAL";
    }
}
