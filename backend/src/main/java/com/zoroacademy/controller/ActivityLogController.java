package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.ActivityLog;
import com.zoroacademy.service.ActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {

    private final ActivityLogService logService;
    public ActivityLogController(ActivityLogService logService) {
        this.logService = logService;
    }


    @GetMapping
    public ApiResponse<List<ActivityLog>> getLogs(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actor
    ) {
        if (fromDate != null || toDate != null || module != null || action != null || actor != null) {
            return ApiResponse.ok(logService.getLogs(fromDate, toDate, module, action, actor));
        }
        return ApiResponse.ok(logService.getRecentLogs());
    }

    @PostMapping
    public ApiResponse<ActivityLog> logAction(@RequestBody ActivityLog log, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        return ApiResponse.ok(logService.logAction(log.getUserId(), log.getUserName(), log.getAction(), log.getDetails(), ip));
    }
}
