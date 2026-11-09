package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.Doubt;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.DoubtService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/doubts")
public class DoubtController {

    private final DoubtService doubtService;
    private final com.zoroacademy.service.CourseService courseService;

    public DoubtController(DoubtService doubtService) {
        this(doubtService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public DoubtController(DoubtService doubtService,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.service.CourseService courseService) {
        this.doubtService = doubtService;
        this.courseService = courseService;
    }

    public ApiResponse<List<Doubt>> getDoubts(UserPrincipal principal) {
        return getDoubts(null, principal);
    }

    @GetMapping
    public ApiResponse<List<Doubt>> getDoubts(@RequestParam(required = false) String courseId,
                                              @AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null && "TRAINER".equalsIgnoreCase(principal.getRole())) {
            if (courseId != null && !courseId.isBlank() && courseService != null) {
                if (!courseService.isTrainerEligibleForStudentCourse(principal.getId(), courseId, null)) {
                    throw new org.springframework.security.access.AccessDeniedException("Access denied: You are not assigned to this course.");
                }
            }
            return ApiResponse.ok(doubtService.getDoubtsByTrainer(principal.getId(), principal.getName(), courseId));
        }
        if (principal != null && "STUDENT".equalsIgnoreCase(principal.getRole())) {
            return ApiResponse.ok(doubtService.getDoubtsByStudent(principal.getId(), principal.getEmail()));
        }
        return ApiResponse.ok(doubtService.getAllDoubts());
    }

    @GetMapping("/trainer/{trainer}")
    public ApiResponse<List<Doubt>> getDoubtsByTrainer(@PathVariable String trainer) {
        return ApiResponse.ok(doubtService.getDoubtsByTrainer(trainer, trainer));
    }

    @PostMapping
    public ApiResponse<Doubt> createDoubt(@RequestBody Doubt doubt, @AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null && "STUDENT".equalsIgnoreCase(principal.getRole())) {
            if (doubt.getStudentId() == null || doubt.getStudentId().isBlank()) {
                doubt.setStudentId(principal.getId());
            }
            if (doubt.getStudentName() == null || doubt.getStudentName().isBlank()) {
                doubt.setStudentName(principal.getName());
            }
        }
        return ApiResponse.ok(doubtService.createDoubt(doubt), "Doubt submitted successfully");
    }

    @PutMapping("/{id}/reply")
    public ApiResponse<Doubt> replyToDoubt(@PathVariable String id, @RequestBody Map<String, String> body, @AuthenticationPrincipal UserPrincipal principal) {
        String reply = body.get("reply");
        String trainerName = body.get("trainerName");
        if ((trainerName == null || trainerName.isBlank()) && principal != null) {
            trainerName = principal.getName();
        }
        return ApiResponse.ok(doubtService.replyToDoubt(id, reply, trainerName), "Reply submitted");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteDoubt(@PathVariable String id) {
        doubtService.deleteDoubt(id);
        return ApiResponse.ok(true, "Doubt deleted successfully");
    }
}
