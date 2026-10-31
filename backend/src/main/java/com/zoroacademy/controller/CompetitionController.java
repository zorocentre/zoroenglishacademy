package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.CompetitionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/competitions")
public class CompetitionController {

    private final CompetitionService competitionService;
    private final UserRepository userRepository;

    public CompetitionController(CompetitionService competitionService, UserRepository userRepository) {
        this.competitionService = competitionService;
        this.userRepository = userRepository;
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new org.springframework.security.access.AccessDeniedException("Not authenticated");
        }
        String identifier;
        if (auth.getPrincipal() instanceof UserPrincipal up) {
            identifier = up.getId();
        } else if (auth.getPrincipal() instanceof UserDetails ud) {
            identifier = ud.getUsername();
        } else {
            identifier = auth.getName();
        }

        return userRepository.findById(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .or(() -> userRepository.findByUsernameIgnoreCase(identifier))
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("User not found: " + identifier));
    }

    @GetMapping
    public ApiResponse<List<Competition>> getCompetitions() {
        User user = null;
        try {
            user = getCurrentUser();
        } catch (Exception ignored) {}
        if (user != null && ("ADMIN".equals(user.getRole()) || "SUPER_ADMIN".equals(user.getRole()))) {
            return ApiResponse.ok(competitionService.getAllCompetitions());
        }
        return ApiResponse.ok(competitionService.getPublicActiveCompetitions());
    }

    @GetMapping("/registrations")
    public ApiResponse<List<CompetitionRegistration>> getAllRegistrations() {
        return ApiResponse.ok(competitionService.getAllRegistrations());
    }

    @GetMapping("/{id}")
    public ApiResponse<Competition> getCompetitionById(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getCompetitionById(id));
    }

    @PostMapping
    public ApiResponse<Competition> createCompetition(@RequestBody Competition competition) {
        return ApiResponse.ok(competitionService.createCompetition(competition), "Competition created");
    }

    @GetMapping("/{id}/registrations")
    public ApiResponse<List<CompetitionRegistration>> getRegistrations(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getRegistrations(id));
    }

    @PostMapping("/{id}/precheck")
    public ApiResponse<Map<String, Object>> precheckRegistrationEmail(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> payload
    ) {
        String email = payload != null ? payload.get("email") : null;
        return ApiResponse.ok(competitionService.precheckRegistrationEmail(id, email));
    }

    @PostMapping("/{id}/registrations")
    public ApiResponse<CompetitionRegistration> registerStudent(@PathVariable String id, @RequestBody CompetitionRegistration reg) {
        return ApiResponse.ok(competitionService.registerStudent(id, reg), "Student registered for competition");
    }

    @PutMapping("/{id}")
    public ApiResponse<Competition> updateCompetition(@PathVariable String id, @RequestBody Competition competition) {
        return ApiResponse.ok(competitionService.updateCompetition(id, competition), "Competition updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteCompetition(@PathVariable String id) {
        competitionService.deleteCompetition(id);
        return ApiResponse.ok(true, "Competition deleted");
    }

    @PutMapping("/registrations/{regId}")
    public ApiResponse<CompetitionRegistration> updateRegistration(@PathVariable String regId, @RequestBody CompetitionRegistration reg) {
        return ApiResponse.ok(competitionService.updateRegistration(regId, reg), "Registration updated");
    }

    @DeleteMapping("/registrations/{regId}")
    public ApiResponse<Boolean> deleteRegistration(@PathVariable String regId) {
        competitionService.deleteRegistration(regId);
        return ApiResponse.ok(true, "Registration deleted");
    }

    @GetMapping("/registrations/{regId}/credential")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> getRegistrationCredential(@PathVariable String regId) {
        return ApiResponse.ok(competitionService.getRegistrationCredential(regId));
    }

    @PutMapping("/registrations/{regId}/reset-password")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> resetRegistrationPassword(
            @PathVariable String regId,
            @RequestBody(required = false) Map<String, String> payload) {
        String newPassword = (payload != null) ? payload.get("password") : null;
        return ApiResponse.ok(competitionService.resetRegistrationPassword(regId, newPassword), "Password reset successfully");
    }

    // --- Sets & Trainers Management (Phase 5) ---
    @GetMapping("/{id}/sets")
    public ApiResponse<List<Map<String, Object>>> getSets(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getSetsWithDetails(id));
    }

    @PutMapping("/{id}/sets/{code}/trainer")
    public ApiResponse<CompetitionSet> assignTrainer(
            @PathVariable String id,
            @PathVariable String code,
            @RequestBody Map<String, String> body) {
        String trainerId = body != null ? body.get("trainerId") : null;
        return ApiResponse.ok(competitionService.assignTrainerToSet(id, code, trainerId), "Trainer assigned to set " + code);
    }

    // --- Syllabus (Phase 6) ---
    @GetMapping("/{id}/syllabus")
    public ApiResponse<Map<String, Object>> getSyllabus(@PathVariable String id) {
        User user = getCurrentUser();
        competitionService.validateUserCompetitionAccess(id, user);
        return ApiResponse.ok(competitionService.getSyllabus(id));
    }

    @PostMapping("/{id}/syllabus")
    public ApiResponse<CompetitionSyllabus> saveSyllabus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String title = body != null ? body.get("title") : "Syllabus";
        String storedFileId = body != null ? body.get("storedFileId") : null;
        String fileType = body != null ? body.get("fileType") : null;
        return ApiResponse.ok(competitionService.saveSyllabus(id, title, storedFileId, fileType), "Syllabus updated");
    }

    @DeleteMapping("/{id}/syllabus")
    public ApiResponse<Boolean> deleteSyllabus(@PathVariable String id) {
        competitionService.deleteSyllabus(id);
        return ApiResponse.ok(true, "Syllabus deleted");
    }

    // --- Guidance Videos (Phase 6 & Admin Guidance Videos Redesign) ---
    @GetMapping("/{id}/guidance-videos")
    public ApiResponse<List<CompetitionGuidanceVideo>> getGuidanceVideos(@PathVariable String id) {
        User user = getCurrentUser();
        competitionService.validateUserCompetitionAccess(id, user);
        return ApiResponse.ok(competitionService.getGuidanceVideos(id));
    }

    @PostMapping("/{id}/guidance-videos")
    public ApiResponse<CompetitionGuidanceVideo> saveGuidanceVideo(
            @PathVariable String id,
            @RequestBody CompetitionGuidanceVideo video) {
        return ApiResponse.ok(competitionService.saveGuidanceVideo(id, video), "Guidance video saved");
    }

    @PostMapping(value = "/{id}/guidance-videos/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CompetitionGuidanceVideo> uploadGuidanceVideo(
            @PathVariable String id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam("caption") String caption,
            @RequestParam(value = "sortOrder", required = false) Integer sortOrder) {
        return ApiResponse.ok(competitionService.uploadGuidanceVideo(id, file, caption, sortOrder), "Guidance video uploaded successfully");
    }

    @PutMapping("/guidance-videos/{videoId}")
    public ApiResponse<CompetitionGuidanceVideo> updateGuidanceVideo(
            @PathVariable String videoId,
            @RequestBody Map<String, Object> body) {
        String caption = body.get("caption") != null ? body.get("caption").toString() : (body.get("title") != null ? body.get("title").toString() : null);
        Integer sortOrder = body.get("sortOrder") != null ? Integer.parseInt(body.get("sortOrder").toString()) : null;
        return ApiResponse.ok(competitionService.updateGuidanceVideo(videoId, caption, sortOrder), "Guidance video updated");
    }

    @PutMapping(value = "/guidance-videos/{videoId}/replace", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CompetitionGuidanceVideo> replaceGuidanceVideo(
            @PathVariable String videoId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption) {
        return ApiResponse.ok(competitionService.replaceGuidanceVideoFile(videoId, file, caption), "Guidance video replaced successfully");
    }

    @PutMapping("/{id}/guidance-videos/reorder")
    public ApiResponse<List<CompetitionGuidanceVideo>> reorderGuidanceVideos(
            @PathVariable String id,
            @RequestBody List<String> videoIds) {
        return ApiResponse.ok(competitionService.reorderGuidanceVideos(id, videoIds), "Guidance videos reordered");
    }

    @DeleteMapping("/guidance-videos/{videoId}")
    public ApiResponse<Boolean> deleteGuidanceVideo(@PathVariable String videoId) {
        competitionService.deleteGuidanceVideo(videoId);
        return ApiResponse.ok(true, "Guidance video deleted");
    }

    // --- Study Materials (Phase 6) ---
    @GetMapping("/{id}/study-materials")
    public ApiResponse<List<Map<String, Object>>> getStudyMaterials(@PathVariable String id) {
        User user = getCurrentUser();
        competitionService.validateUserCompetitionAccess(id, user);
        return ApiResponse.ok(competitionService.getStudyMaterials(id));
    }

    @PostMapping("/{id}/study-materials")
    public ApiResponse<CompetitionStudyMaterial> saveStudyMaterial(
            @PathVariable String id,
            @RequestBody CompetitionStudyMaterial material) {
        return ApiResponse.ok(competitionService.saveStudyMaterial(id, material), "Study material saved");
    }

    @DeleteMapping("/study-materials/{materialId}")
    public ApiResponse<Boolean> deleteStudyMaterial(@PathVariable String materialId) {
        competitionService.deleteStudyMaterial(materialId);
        return ApiResponse.ok(true, "Study material deleted");
    }

    // --- Assessments (Phase 7) ---
    @GetMapping("/{id}/assessments")
    public ApiResponse<List<CompetitionAssessment>> getAssessments(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getAssessments(id));
    }

    @PutMapping("/assessments/{asmtId}")
    public ApiResponse<CompetitionAssessment> updateAssessment(
            @PathVariable String asmtId,
            @RequestBody CompetitionAssessment assessment) {
        return ApiResponse.ok(competitionService.updateAssessment(asmtId, assessment), "Assessment updated");
    }

    @PostMapping("/assessments/{asmtId}/publish")
    public ApiResponse<CompetitionAssessment> publishAssessment(@PathVariable String asmtId) {
        return ApiResponse.ok(competitionService.publishAssessment(asmtId), "Assessment published successfully");
    }

    @GetMapping("/assessments/{asmtId}/republish-info")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> getRepublishInfo(@PathVariable String asmtId) {
        return ApiResponse.ok(competitionService.getRepublishInfo(asmtId));
    }

    @PostMapping("/assessments/{asmtId}/republish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<CompetitionAssessment> republishAssessment(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.republishAssessment(asmtId, user), "Assessment republished successfully");
    }

    // --- Questions Builder (Phase 7) ---
    @GetMapping("/assessments/{asmtId}/questions")
    public ApiResponse<List<Map<String, Object>>> getQuestions(@PathVariable String asmtId) {
        return ApiResponse.ok(competitionService.getAssessmentQuestions(asmtId));
    }

    @PostMapping("/assessments/{asmtId}/questions")
    public ApiResponse<Map<String, Object>> saveQuestion(
            @PathVariable String asmtId,
            @RequestBody Map<String, Object> payload) {
        return ApiResponse.ok(competitionService.saveQuestion(asmtId, payload), "Question saved");
    }

    @DeleteMapping("/questions/{questionId}")
    public ApiResponse<Boolean> deleteQuestion(@PathVariable String questionId) {
        competitionService.deleteQuestion(questionId);
        return ApiResponse.ok(true, "Question deleted");
    }

    @PostMapping("/questions/{questionId}/duplicate")
    public ApiResponse<Map<String, Object>> duplicateQuestion(@PathVariable String questionId) {
        return ApiResponse.ok(competitionService.duplicateQuestion(questionId), "Question duplicated");
    }

    @PutMapping("/assessments/{asmtId}/questions/reorder")
    public ApiResponse<List<Map<String, Object>>> reorderQuestions(
            @PathVariable String asmtId,
            @RequestBody List<String> questionIds) {
        return ApiResponse.ok(competitionService.reorderQuestions(asmtId, questionIds), "Questions reordered");
    }

    // --- Overview & Registered Students Management ---
    @GetMapping("/{id}/overview")
    public ApiResponse<Map<String, Object>> getCompetitionOverview(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getCompetitionOverview(id));
    }

    @GetMapping("/{id}/registered-students")
    public ApiResponse<List<Map<String, Object>>> getRegisteredStudents(@PathVariable String id) {
        return ApiResponse.ok(competitionService.getRegisteredStudentsWithDetails(id));
    }

    // --- Student Portal Context ---
    @GetMapping("/{id}/my-portal")
    public ApiResponse<Map<String, Object>> getStudentPortalContext(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getStudentPortalContext(id, user));
    }

    // --- Phase 1: Test Series Execution ---
    @GetMapping("/{id}/test-series")
    public ApiResponse<Map<String, Object>> getTestSeries(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getStudentTestSeries(id, user));
    }

    @PostMapping("/test-series/{asmtId}/start")
    public ApiResponse<Map<String, Object>> startTestSeries(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.startOrResumeTestAttempt(asmtId, user));
    }

    @PostMapping("/test-series/{asmtId}/answers")
    public ApiResponse<Map<String, Object>> saveAnswer(
            @PathVariable String asmtId,
            @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.saveAttemptAnswer(asmtId, payload, user));
    }

    @PostMapping("/test-series/{asmtId}/submit")
    public ApiResponse<Map<String, Object>> submitTestSeries(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.submitTestAttempt(asmtId, user));
    }

    @GetMapping("/test-series/{asmtId}/results")
    public ApiResponse<Map<String, Object>> getTestResults(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getAttemptResults(asmtId, user));
    }

    // --- Phase 2: Mock Tests Execution ---
    @GetMapping("/{id}/mock-tests")
    public ApiResponse<Map<String, Object>> getMockTests(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getStudentMockTests(id, user));
    }

    @PostMapping("/mock-tests/{asmtId}/start")
    public ApiResponse<Map<String, Object>> startMockTest(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.startOrResumeTestAttempt(asmtId, user));
    }

    @PostMapping("/mock-tests/{asmtId}/answers")
    public ApiResponse<Map<String, Object>> saveMockAnswer(
            @PathVariable String asmtId,
            @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.saveAttemptAnswer(asmtId, payload, user));
    }

    @PostMapping("/mock-tests/{asmtId}/submit")
    public ApiResponse<Map<String, Object>> submitMockTest(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.submitTestAttempt(asmtId, user));
    }

    @GetMapping("/mock-tests/{asmtId}/results")
    public ApiResponse<Map<String, Object>> getMockResults(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getAttemptResults(asmtId, user));
    }

    // --- Phase 3: Final Assessment Execution ---
    @GetMapping("/{id}/final-assessment")
    public ApiResponse<Map<String, Object>> getFinalAssessment(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getStudentFinalAssessment(id, user));
    }

    @PostMapping("/final-assessment/{asmtId}/start")
    public ApiResponse<Map<String, Object>> startFinalAssessment(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.startOrResumeTestAttempt(asmtId, user));
    }

    @PostMapping("/final-assessment/{asmtId}/answers")
    public ApiResponse<Map<String, Object>> saveFinalAssessmentAnswer(
            @PathVariable String asmtId,
            @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.saveAttemptAnswer(asmtId, payload, user));
    }

    @PostMapping("/final-assessment/{asmtId}/submit")
    public ApiResponse<Map<String, Object>> submitFinalAssessment(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.submitTestAttempt(asmtId, user));
    }

    @GetMapping("/final-assessment/{asmtId}/results")
    public ApiResponse<Map<String, Object>> getFinalAssessmentResults(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getAttemptResults(asmtId, user));
    }

    @PostMapping("/assessments/{asmtId}/generate-sets")
    public ApiResponse<Map<String, Object>> generateSets(@PathVariable String asmtId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.generateSetPapers(asmtId, user));
    }

    @PostMapping("/assessments/{asmtId}/attempts/{attemptId}/reset")
    public ApiResponse<Boolean> resetAttempt(
            @PathVariable String asmtId,
            @PathVariable String attemptId) {
        User user = getCurrentUser();
        competitionService.resetAssessmentAttempt(asmtId, attemptId, user);
        return ApiResponse.ok(true, "Attempt reset successfully");
    }

    @GetMapping("/{id}/trainer/evaluations")
    public ApiResponse<List<Map<String, Object>>> getTrainerEvaluations(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerPendingSubmissions(id, user));
    }

    @GetMapping("/trainer/attempts/{attemptId}")
    public ApiResponse<Map<String, Object>> getTrainerAttemptDetail(@PathVariable String attemptId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerAttemptDetail(attemptId, user));
    }

    @PostMapping("/trainer/attempts/{attemptId}/answers/{answerId}/evaluate")
    public ApiResponse<Map<String, Object>> evaluateVoiceAnswer(
            @PathVariable String attemptId,
            @PathVariable String answerId,
            @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.evaluateVoiceAnswer(attemptId, answerId, payload, user));
    }

    @GetMapping("/admin/evaluations")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getAdminEvaluations(
            @RequestParam(required = false) String competitionId,
            @RequestParam(required = false) String examType,
            @RequestParam(required = false) String setCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return ApiResponse.ok(competitionService.getAdminCompetitionEvaluations(competitionId, examType, setCode, status, search));
    }

    @GetMapping("/trainer/assigned-competitions")
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getTrainerAssignedCompetitions() {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerAssignedCompetitions(user));
    }

    @GetMapping("/trainer/submissions")
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getTrainerFilteredSubmissions(
            @RequestParam(required = false) String competitionId,
            @RequestParam(required = false) String examType,
            @RequestParam(required = false) String setCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerEvaluationsWithFilters(competitionId, examType, setCode, status, search, user));
    }

    @GetMapping("/trainer/students")
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> getTrainerAssignedStudents(
            @RequestParam(required = false, defaultValue = "ALL") String competitionId,
            @RequestParam(required = false, defaultValue = "ALL") String setCode,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerAssignedStudents(competitionId, setCode, search, page, size, user));
    }

    @GetMapping("/trainer/students/{registrationId}/folders")
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> getTrainerStudentFolders(
            @PathVariable String registrationId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerStudentFolders(registrationId, user));
    }

    @GetMapping("/trainer/students/{registrationId}/submissions")
    @PreAuthorize("hasAnyRole('TRAINER', 'ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getTrainerStudentSubmissions(
            @PathVariable String registrationId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "folderType", required = false) String folderType,
            @RequestParam(value = "folder", required = false) String folder) {
        String effectiveType = (type != null && !type.isBlank()) ? type : ((folderType != null && !folderType.isBlank()) ? folderType : folder);
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getTrainerStudentSubmissions(registrationId, effectiveType, user));
    }

    @PostMapping("/assessments/attempts/{attemptId}/proctor-event")
    public ApiResponse<Map<String, Object>> recordProctorEvent(
            @PathVariable String attemptId,
            @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.recordProctorEvent(attemptId, payload, user));
    }

    @GetMapping("/assessments/attempts/{attemptId}/proctor-events")
    public ApiResponse<Map<String, Object>> getProctorEvents(
            @PathVariable String attemptId) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.getProctorEvents(attemptId, user));
    }

    // =========================================================================
    // PHASE 5: LEADERBOARD ENDPOINTS
    // =========================================================================

    @GetMapping("/{id}/leaderboard")
    public ApiResponse<Map<String, Object>> getLeaderboard(@PathVariable String id) {
        User user = null;
        try {
            user = getCurrentUser();
        } catch (Exception ignored) {}
        return ApiResponse.ok(competitionService.getLeaderboard(id, user));
    }

    @PostMapping("/{id}/leaderboard/recalculate")
    public ApiResponse<Map<String, Object>> recalculateLeaderboard(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.recalculateLeaderboard(id, user));
    }

    @PostMapping("/{id}/leaderboard/publish")
    public ApiResponse<Map<String, Object>> publishLeaderboard(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.publishLeaderboard(id, user));
    }

    @PostMapping("/{id}/leaderboard/unpublish")
    public ApiResponse<Map<String, Object>> unpublishLeaderboard(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.unpublishLeaderboard(id, user));
    }

    @PostMapping("/{id}/answer-review/toggle")
    public ApiResponse<Map<String, Object>> toggleAnswerReview(@PathVariable String id) {
        User user = getCurrentUser();
        return ApiResponse.ok(competitionService.toggleAnswerReview(id, user));
    }
}

