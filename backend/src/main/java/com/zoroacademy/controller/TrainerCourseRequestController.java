package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.TrainerCourseRequest;
import com.zoroacademy.service.TrainerCourseRequestService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trainer-course-requests")
public class TrainerCourseRequestController {

    private final TrainerCourseRequestService requestService;

    public TrainerCourseRequestController(TrainerCourseRequestService requestService) {
        this.requestService = requestService;
    }

    @GetMapping
    public ApiResponse<List<TrainerCourseRequest>> getRequests(@RequestParam(required = false) String trainerId) {
        if (trainerId != null && !trainerId.isBlank()) {
            return ApiResponse.ok(requestService.getRequestsByTrainer(trainerId));
        }
        return ApiResponse.ok(requestService.getAllRequests());
    }

    @GetMapping("/trainer-course-access")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getTrainerCourseAccessList() {
        return ApiResponse.ok(requestService.getTrainerCourseAccessList());
    }

    @PostMapping("/revoke-access")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Boolean> revokeAccess(@RequestBody Map<String, String> body) {
        String trainerId = body != null ? body.get("trainerId") : null;
        String courseId = body != null ? body.get("courseId") : null;
        requestService.revokeAccess(trainerId, courseId);
        return ApiResponse.ok(true, "Trainer course access revoked successfully");
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN')")
    public ApiResponse<TrainerCourseRequest> createRequest(@RequestBody TrainerCourseRequest request) {
        return ApiResponse.ok(requestService.createRequest(request), "Course access requested successfully");
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TrainerCourseRequest> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        String status = body != null ? body.get("status") : null;
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Status is required");
        }
        return ApiResponse.ok(requestService.updateStatus(id, status), "Request status updated successfully");
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Boolean> deleteRequest(@PathVariable String id) {
        requestService.deleteRequest(id);
        return ApiResponse.ok(true, "Trainer course request deleted successfully");
    }
}
