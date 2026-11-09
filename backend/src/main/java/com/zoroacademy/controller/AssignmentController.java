package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.Assignment;
import com.zoroacademy.entity.AssignmentSubmission;
import com.zoroacademy.service.AssignmentService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class AssignmentController {

    private final AssignmentService assignmentService;
    private final com.zoroacademy.service.CourseService courseService;

    public AssignmentController(AssignmentService assignmentService) {
        this(assignmentService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AssignmentController(AssignmentService assignmentService,
                                @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.service.CourseService courseService) {
        this.assignmentService = assignmentService;
        this.courseService = courseService;
    }


    // --- ASSIGNMENTS ---

    @GetMapping("/api/assignments")
    public ApiResponse<List<Assignment>> getAssignments(@RequestParam(required = false) String studentId) {
        if (studentId != null && !studentId.isBlank()) {
            return ApiResponse.ok(assignmentService.getAssignmentsForStudent(studentId));
        }
        return ApiResponse.ok(assignmentService.getAllAssignments());
    }

    @PostMapping("/api/assignments")
    public ApiResponse<Assignment> createAssignment(@RequestBody Assignment assignment) {
        return ApiResponse.ok(assignmentService.createAssignment(assignment), "Assignment created");
    }

    @PutMapping("/api/assignments/{id}")
    public ApiResponse<Assignment> updateAssignment(@PathVariable String id, @RequestBody Assignment assignment) {
        return ApiResponse.ok(assignmentService.updateAssignment(id, assignment), "Assignment updated successfully");
    }

    // --- SUBMISSIONS ---

    @GetMapping("/api/submissions")
    public ApiResponse<List<AssignmentSubmission>> getSubmissions(@RequestParam(required = false) String studentId,
                                                                 @RequestParam(required = false) String studentEmail,
                                                                 @RequestParam(required = false) String trainerId,
                                                                 @RequestParam(required = false) String trainer,
                                                                 @RequestParam(required = false) String submitterRole,
                                                                 @RequestParam(required = false) String courseId,
                                                                 @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        String effectiveStudent = (studentId != null && !studentId.isBlank()) ? studentId : studentEmail;
        String effectiveTrainer = (trainerId != null && !trainerId.isBlank()) ? trainerId : trainer;
        if (effectiveTrainer == null && principal != null && "TRAINER".equalsIgnoreCase(principal.getRole())) {
            effectiveTrainer = principal.getId();
        }

        if (principal != null && "TRAINER".equalsIgnoreCase(principal.getRole()) && courseId != null && !courseId.isBlank()) {
            if (courseService != null && !courseService.isTrainerEligibleForStudentCourse(principal.getId(), courseId, null)) {
                throw new org.springframework.security.access.AccessDeniedException("Access denied: You are not assigned to this course.");
            }
        }

        if ("TRAINER".equalsIgnoreCase(submitterRole)) {
            String targetTrainerId = (effectiveTrainer != null && !effectiveTrainer.isBlank()) ? effectiveTrainer : effectiveStudent;
            if (targetTrainerId != null && !targetTrainerId.isBlank()) {
                return ApiResponse.ok(assignmentService.getTrainerOwnSubmissions(targetTrainerId));
            }
            return ApiResponse.ok(assignmentService.getTrainerSubmissions());
        }

        if (effectiveStudent != null && !effectiveStudent.isBlank()) {
            return ApiResponse.ok(assignmentService.getSubmissionsByStudent(effectiveStudent));
        }
        if (effectiveTrainer != null && !effectiveTrainer.isBlank()) {
            return ApiResponse.ok(assignmentService.getSubmissionsByTrainer(effectiveTrainer, courseId));
        }
        return ApiResponse.ok(assignmentService.getAllSubmissions());
    }

    // --- ADMIN TRAINER ASSIGNMENTS ENDPOINTS ---

    @GetMapping("/api/admin/trainer-submissions")
    public ApiResponse<List<AssignmentSubmission>> getAdminTrainerSubmissions() {
        return ApiResponse.ok(assignmentService.getTrainerSubmissions());
    }

    @PutMapping("/api/admin/trainer-submissions/{id}/review")
    public ApiResponse<AssignmentSubmission> reviewAdminTrainerSubmission(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String score = body.get("score") != null ? String.valueOf(body.get("score")) : null;
        String remarks = body.get("feedback") != null ? String.valueOf(body.get("feedback")) : (body.get("remarks") != null ? String.valueOf(body.get("remarks")) : "");
        String correctedBy = body.get("correctedBy") != null ? String.valueOf(body.get("correctedBy")) : "Admin";
        String correctionAttachment = body.get("correctionAttachment") != null ? body.get("correctionAttachment").toString() : null;
        String correctedFileUrl = body.get("correctedFileUrl") != null ? String.valueOf(body.get("correctedFileUrl")) : null;

        AssignmentSubmission reviewed = assignmentService.reviewSubmission(id, score, remarks, correctedBy, correctionAttachment, correctedFileUrl);
        return ApiResponse.ok(reviewed, "Trainer assignment reviewed successfully");
    }

    @PostMapping("/api/submissions")
    public ApiResponse<AssignmentSubmission> createSubmission(@RequestBody AssignmentSubmission submission) {
        return ApiResponse.ok(assignmentService.createSubmission(submission), "Submission uploaded successfully");
    }

    @PutMapping("/api/submissions/{id}/review")
    public ApiResponse<AssignmentSubmission> reviewSubmission(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String score = body.get("score") != null ? String.valueOf(body.get("score")) : null;
        String remarks = body.get("remarks") != null ? String.valueOf(body.get("remarks")) : (body.get("feedback") != null ? String.valueOf(body.get("feedback")) : "");
        String correctedBy = body.get("correctedBy") != null ? String.valueOf(body.get("correctedBy")) : "Trainer";
        String correctionAttachment = body.get("correctionAttachment") != null ? body.get("correctionAttachment").toString() : null;
        String correctedFileUrl = body.get("correctedFileUrl") != null ? String.valueOf(body.get("correctedFileUrl")) : null;

        AssignmentSubmission reviewed = assignmentService.reviewSubmission(id, score, remarks, correctedBy, correctionAttachment, correctedFileUrl);
        return ApiResponse.ok(reviewed, "Submission reviewed successfully");
    }

    @DeleteMapping("/api/assignments/{id}")
    public ApiResponse<Boolean> deleteAssignment(@PathVariable String id) {
        assignmentService.deleteAssignment(id);
        return ApiResponse.ok(true, "Assignment deleted successfully");
    }

    @DeleteMapping("/api/submissions/{id}")
    public ApiResponse<Boolean> deleteSubmission(@PathVariable String id) {
        assignmentService.deleteSubmission(id);
        return ApiResponse.ok(true, "Submission deleted successfully");
    }
}
