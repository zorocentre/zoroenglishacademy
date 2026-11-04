package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.service.ScheduleService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

    private final ScheduleService scheduleService;
    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }


    @GetMapping
    public ApiResponse<List<Schedule>> getSchedules(@org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        if (principal != null && "STUDENT".equalsIgnoreCase(principal.getRole())) {
            return ApiResponse.ok(scheduleService.getSchedulesForStudent(principal.getId(), principal.getEmail()));
        }
        return ApiResponse.ok(scheduleService.getAllSchedules());
    }

    @GetMapping("/trainer/{trainer}")
    public ApiResponse<List<Schedule>> getTrainerSchedules(@PathVariable String trainer) {
        return ApiResponse.ok(scheduleService.getTrainerSchedules(trainer));
    }

    @PostMapping
    public ApiResponse<Schedule> createSchedule(@RequestBody Schedule schedule) {
        return ApiResponse.ok(scheduleService.createSchedule(schedule), "Schedule created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<Schedule> updateSchedule(@PathVariable String id, @RequestBody Schedule schedule) {
        return ApiResponse.ok(scheduleService.updateSchedule(id, schedule), "Schedule updated successfully");
    }

    @PostMapping("/{id}/join")
    public ApiResponse<java.util.Map<String, Object>> joinSchedule(
            @PathVariable String id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        String studentId = principal != null ? principal.getId() : null;
        String studentEmail = principal != null ? principal.getEmail() : null;
        String userRole = principal != null ? principal.getRole() : "STUDENT";
        java.util.Map<String, Object> result = scheduleService.joinSchedule(id, studentId, studentEmail, userRole);
        return ApiResponse.ok(result, "Session joined successfully");
    }

    @PostMapping("/{id}/start")
    public ApiResponse<java.util.Map<String, Object>> startSchedule(
            @PathVariable String id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        String trainerId = principal != null ? principal.getId() : null;
        String trainerEmail = principal != null ? principal.getEmail() : null;
        String userRole = principal != null ? principal.getRole() : "TRAINER";
        java.util.Map<String, Object> result = scheduleService.startSchedule(id, trainerId, trainerEmail, userRole);
        return ApiResponse.ok(result, "Session started successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteSchedule(@PathVariable String id) {
        scheduleService.deleteSchedule(id);
        return ApiResponse.ok(true, "Schedule deleted successfully");
    }

    private boolean isAdmin(com.zoroacademy.security.UserPrincipal principal, org.springframework.security.core.Authentication auth) {
        if (principal != null && "ADMIN".equalsIgnoreCase(principal.getRole())) {
            return true;
        }
        if (auth != null && auth.getAuthorities() != null) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()) || "ADMIN".equalsIgnoreCase(a.getAuthority()));
        }
        return false;
    }

    @GetMapping("/admin/trainer-sessions")
    public ApiResponse<List<Schedule>> getAdminTrainerSessions(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal,
            org.springframework.security.core.Authentication auth) {
        if (!isAdmin(principal, auth)) {
            throw new org.springframework.security.access.AccessDeniedException("Admin access required");
        }
        return ApiResponse.ok(scheduleService.getTrainerAudienceSchedules());
    }

    @GetMapping("/trainer-courses")
    public ApiResponse<List<Schedule>> getTrainerCourses(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal,
            org.springframework.security.core.Authentication auth) {
        if (!isAdmin(principal, auth)) {
            throw new org.springframework.security.access.AccessDeniedException("Admin access required");
        }
        return ApiResponse.ok(scheduleService.getTrainerAudienceSchedules());
    }

    @GetMapping("/online-session-history")
    public ApiResponse<List<Schedule>> getOnlineSessionHistory(
            @RequestParam(required = false) String trainerId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal,
            org.springframework.security.core.Authentication auth) {
        if (!isAdmin(principal, auth)) {
            throw new org.springframework.security.access.AccessDeniedException("Admin access required");
        }
        return ApiResponse.ok(scheduleService.getOnlineSessionHistory(trainerId, fromDate, toDate));
    }

    @GetMapping("/unpaid-credited-sessions")
    public ApiResponse<List<Schedule>> getUnpaidCreditedSessions(
            @RequestParam String trainerId,
            @RequestParam String fromDate,
            @RequestParam String toDate,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal,
            org.springframework.security.core.Authentication auth) {
        if (!isAdmin(principal, auth)) {
            throw new org.springframework.security.access.AccessDeniedException("Admin access required");
        }
        return ApiResponse.ok(scheduleService.getUnpaidCreditedSessions(trainerId, fromDate, toDate));
    }
}
