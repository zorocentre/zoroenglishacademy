package com.zoroacademy.service;

import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class FileAccessService {

    private final StoredFileRepository storedFileRepository;
    private final CourseModuleRepository courseModuleRepository;
    private final CourseRepository courseRepository;
    private final ScheduleRepository scheduleRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final CourseResourceRepository courseResourceRepository;
    private final CompetitionRepository competitionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final BatchRepository batchRepository;
    private final TrainerCourseRequestRepository trainerCourseRequestRepository;
    private final UserRepository userRepository;
    private final CourseService courseService;
    private final ScheduleService scheduleService;
    private final CompetitionStudyMaterialRepository competitionStudyMaterialRepository;
    private final AssessmentQuestionRepository assessmentQuestionRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final CompetitionAssessmentRepository competitionAssessmentRepository;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final CompetitionSetRepository competitionSetRepository;
    private final CompetitionSyllabusRepository competitionSyllabusRepository;
    @Autowired(required = false)
    private CompetitionSetMemberRepository competitionSetMemberRepository;

    @Autowired
    public FileAccessService(
            StoredFileRepository storedFileRepository,
            CourseModuleRepository courseModuleRepository,
            CourseRepository courseRepository,
            ScheduleRepository scheduleRepository,
            AssignmentRepository assignmentRepository,
            AssignmentSubmissionRepository assignmentSubmissionRepository,
            CourseResourceRepository courseResourceRepository,
            CompetitionRepository competitionRepository,
            EnrollmentRepository enrollmentRepository,
            StudentCourseBatchRepository studentCourseBatchRepository,
            BatchRepository batchRepository,
            TrainerCourseRequestRepository trainerCourseRequestRepository,
            UserRepository userRepository,
            CourseService courseService,
            ScheduleService scheduleService,
            CompetitionStudyMaterialRepository competitionStudyMaterialRepository,
            AssessmentQuestionRepository assessmentQuestionRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            CompetitionRegistrationRepository competitionRegistrationRepository,
            CompetitionAssessmentRepository competitionAssessmentRepository,
            AssessmentAttemptRepository assessmentAttemptRepository,
            CompetitionSetRepository competitionSetRepository,
            CompetitionSyllabusRepository competitionSyllabusRepository
    ) {
        this.storedFileRepository = storedFileRepository;
        this.courseModuleRepository = courseModuleRepository;
        this.courseRepository = courseRepository;
        this.scheduleRepository = scheduleRepository;
        this.assignmentRepository = assignmentRepository;
        this.assignmentSubmissionRepository = assignmentSubmissionRepository;
        this.courseResourceRepository = courseResourceRepository;
        this.competitionRepository = competitionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.batchRepository = batchRepository;
        this.trainerCourseRequestRepository = trainerCourseRequestRepository;
        this.userRepository = userRepository;
        this.courseService = courseService;
        this.scheduleService = scheduleService;
        this.competitionStudyMaterialRepository = competitionStudyMaterialRepository;
        this.assessmentQuestionRepository = assessmentQuestionRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.competitionRegistrationRepository = competitionRegistrationRepository;
        this.competitionAssessmentRepository = competitionAssessmentRepository;
        this.assessmentAttemptRepository = assessmentAttemptRepository;
        this.competitionSetRepository = competitionSetRepository;
        this.competitionSyllabusRepository = competitionSyllabusRepository;
    }

    @Transactional(readOnly = true)
    public FileAccessResult checkAccess(StoredFile file, UserPrincipal currentUser) {
        if (file == null) {
            return FileAccessResult.notFound("File not found");
        }

        String fileId = file.getId();
        List<CompetitionStudyMaterial> studyMaterials = competitionStudyMaterialRepository.findByStoredFileId(fileId);
        List<CompetitionSyllabus> syllabusList = (competitionSyllabusRepository != null) ? competitionSyllabusRepository.findByStoredFileId(fileId) : List.of();
        List<AssessmentQuestion> questions = assessmentQuestionRepository.findByMediaRefContaining(fileId);
        List<AttemptAnswer> attemptAnswers = attemptAnswerRepository.findByVoiceFileIdOrAudioFileId(fileId, fileId);

        boolean isRestrictedExamResource = !questions.isEmpty() || !attemptAnswers.isEmpty();

        // Generic public files are accessible to everyone, but competition questions and attempt answers are strictly restricted.
        if (Boolean.TRUE.equals(file.getIsPublic()) && !isRestrictedExamResource) {
            return FileAccessResult.allowed();
        }

        // Private / restricted file requires authentication
        if (currentUser == null) {
            return FileAccessResult.authRequired("Authentication required to access private file");
        }

        String userId = currentUser.getId();
        String userEmail = currentUser.getEmail() != null ? currentUser.getEmail().trim().toLowerCase() : "";
        String roleUpper = currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "";

        // Admin always has full access
        if ("ADMIN".equals(roleUpper) || "SUPER_ADMIN".equals(roleUpper)) {
            return FileAccessResult.allowed();
        }

        // The file owner always has full access
        if (userId != null && userId.equals(file.getOwnerId())) {
            return FileAccessResult.allowed();
        }

        // Find all records that reference this file
        List<CourseModule> modules = courseModuleRepository.findByAnyFileUrlContaining(fileId);
        List<Schedule> schedules = scheduleRepository.findByAnyFileUrlContaining(fileId);
        List<Assignment> assignments = assignmentRepository.findByAnyFileUrlContaining(fileId);
        List<AssignmentSubmission> submissions = assignmentSubmissionRepository.findByAnyFileUrlContaining(fileId);
        List<CourseResource> courseResources = courseResourceRepository.findByFileUrlContaining(fileId);
        List<Competition> competitions = competitionRepository.findByRulesPdfUrlContaining(fileId);

        boolean hasReferences = !modules.isEmpty() || !schedules.isEmpty() || !assignments.isEmpty()
                || !submissions.isEmpty() || !courseResources.isEmpty() || !competitions.isEmpty()
                || !studyMaterials.isEmpty() || !syllabusList.isEmpty() || !questions.isEmpty() || !attemptAnswers.isEmpty();

        // A private file referenced nowhere is denied with a clear reason
        if (!hasReferences) {
            return FileAccessResult.forbidden("Access denied: Private file is not referenced by any course, schedule, or assignment");
        }

        // Competition Syllabus & Study Materials authorization:
        // All authenticated users can view; downloads are restricted to administrators.
        if (!syllabusList.isEmpty() || !studyMaterials.isEmpty()) {
            return FileAccessResult.allowed();
        }

        // Competitions: if referenced in a competition rules PDF, access is allowed
        if (!competitions.isEmpty()) {
            return FileAccessResult.allowed();
        }

        // Assessment Questions (audio prompts, image/video prompts) authorization
        if (!questions.isEmpty()) {
            for (AssessmentQuestion q : questions) {
                CompetitionAssessment asmt = competitionAssessmentRepository.findById(q.getAssessmentId()).orElse(null);
                if (asmt != null) {
                    if (isUserRegisteredForCompetition(currentUser, asmt.getCompetitionId())) {
                        return FileAccessResult.allowed();
                    }
                    if ("TRAINER".equals(roleUpper) && isTrainerAssignedToCompetition(userId, asmt.getCompetitionId())) {
                        return FileAccessResult.allowed();
                    }
                }
            }
            return FileAccessResult.forbidden("Access denied: You are not authorized to access question media for this competition");
        }

        // Attempt Answers (candidate voice answers) authorization
        if (!attemptAnswers.isEmpty()) {
            for (AttemptAnswer ans : attemptAnswers) {
                AssessmentAttempt att = assessmentAttemptRepository.findById(ans.getAttemptId()).orElse(null);
                if (att != null) {
                    CompetitionRegistration reg = competitionRegistrationRepository.findById(att.getRegistrationId()).orElse(null);
                    if (reg != null && ((userId != null && userId.equals(reg.getStudentId()))
                            || (userEmail != null && !userEmail.isBlank() && userEmail.equalsIgnoreCase(reg.getStudentEmail())))) {
                        return FileAccessResult.allowed();
                    }
                    if ("TRAINER".equals(roleUpper)) {
                        String setId = att.getSetId();
                        if (setId == null && competitionSetMemberRepository != null) {
                            var mem = competitionSetMemberRepository.findByRegistrationId(att.getRegistrationId());
                            if (mem.isPresent()) {
                                setId = mem.get().getSetId();
                            }
                        }
                        if (setId != null) {
                            CompetitionSet cs = competitionSetRepository.findById(setId).orElse(null);
                            if (cs != null && userId != null && userId.equals(cs.getTrainerId())) {
                                return FileAccessResult.allowed();
                            }
                        }
                    }
                }
            }
            return FileAccessResult.forbidden("Access denied: You are not authorized to access this voice answer");
        }

        // STUDENT access authorization
        if ("STUDENT".equals(roleUpper)) {
            // 1. Submissions: submitter always has access
            if (!submissions.isEmpty()) {
                boolean isSubmitter = submissions.stream().anyMatch(sub ->
                        (userId != null && userId.equalsIgnoreCase(sub.getStudentId()))
                                || (userEmail != null && userEmail.equalsIgnoreCase(sub.getStudentEmail()))
                );
                if (isSubmitter) {
                    return FileAccessResult.allowed();
                }
            }

            FileAccessResult bestDenialResult = null;
            boolean anyCourseMatched = false;

            // 2. Course Modules: if student is enrolled in ANY referencing module's course, check unlock
            if (!modules.isEmpty()) {
                for (CourseModule mod : modules) {
                    Course course = mod.getCourse();
                    if (course != null) {
                        String courseId = course.getId();
                        if (isStudentEnrolledInCourse(userId, userEmail, courseId, course.getTitle())) {
                            anyCourseMatched = true;
                            if (courseService != null && courseService.isModuleLockedForStudent(courseId, mod.getId(), userId, userEmail)) {
                                int modNum = (mod.getModuleOrder() != null && mod.getModuleOrder() > 1) ? (mod.getModuleOrder() - 1) : 1;
                                bestDenialResult = FileAccessResult.lockedModule("Complete Module " + modNum + " to unlock this resource");
                            } else {
                                return FileAccessResult.allowed();
                            }
                        }
                    }
                }
            }

            // 3. Schedules: if student is in ANY referencing schedule's batch/course, check unlock
            if (!schedules.isEmpty()) {
                for (Schedule sched : schedules) {
                    if (isStudentEnrolledInCourse(userId, userEmail, sched.getCourseId(), sched.getCourse())) {
                        anyCourseMatched = true;
                        if (sched.getBatchId() != null && !sched.getBatchId().isBlank()
                                && !isStudentInBatch(userId, userEmail, sched.getBatchId(), sched.getBatch(), sched.getCourseId(), sched.getCourse())) {
                            bestDenialResult = FileAccessResult.forbidden("This schedule resource is for another batch");
                            continue;
                        }
                        if (scheduleService != null && scheduleService.isScheduleLockedForStudent(sched, userId, userEmail)) {
                            String unlockLabel = com.zoroacademy.util.ScheduleTimeUtil.formatUnlockTime(
                                    sched.getDate(), sched.getTime(), scheduleService.getResourcesUnlockMinutes()
                            );
                            bestDenialResult = FileAccessResult.lockedSchedule("Schedule resources are locked. " + unlockLabel, unlockLabel);
                        } else {
                            return FileAccessResult.allowed();
                        }
                    }
                }
            }

            // 4. Assignments: if student is enrolled in ANY referencing assignment's course/batch
            if (!assignments.isEmpty()) {
                for (Assignment a : assignments) {
                    if (isStudentEnrolledInCourse(userId, userEmail, a.getCourseId(), a.getCourse())) {
                        anyCourseMatched = true;
                        if (a.getBatchId() == null || a.getBatchId().isBlank() || isStudentInBatch(userId, userEmail, a.getBatchId(), a.getBatch(), a.getCourseId(), a.getCourse())) {
                            return FileAccessResult.allowed();
                        } else {
                            bestDenialResult = FileAccessResult.forbidden("This assignment is for another batch");
                        }
                    }
                }
            }

            // 5. Course Resources: if student is enrolled in ANY referencing resource's course
            if (!courseResources.isEmpty()) {
                for (CourseResource cr : courseResources) {
                    Course c = cr.getCourse();
                    if (c != null && isStudentEnrolledInCourse(userId, userEmail, c.getId(), c.getTitle())) {
                        return FileAccessResult.allowed();
                    }
                }
            }

            // If a specific lock/restriction was encountered on an enrolled entity, return it
            if (bestDenialResult != null) {
                return bestDenialResult;
            }

            // If student was not enrolled in any referencing course/batch
            if (!anyCourseMatched) {
                return FileAccessResult.notEnrolled("You are not enrolled in this course");
            }

            return FileAccessResult.forbidden("Access denied: You do not have permission to access this resource");
        }

        // TRAINER access authorization: trainers can view all educational resources and course materials
        if ("TRAINER".equals(roleUpper)) {
            return FileAccessResult.allowed();
        }

        return FileAccessResult.forbidden("Access denied: role not permitted");
    }

    private boolean isStudentEnrolledInCourse(String studentId, String studentEmail, String courseId, String courseTitle) {
        if (courseId == null && courseTitle == null) return false;

        // 1. Direct match by studentId
        if (studentId != null) {
            if (courseId != null && enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) return true;
            if (courseId != null && studentCourseBatchRepository.findByStudentIdAndCourseId(studentId, courseId).isPresent()) return true;

            List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
            if (matchesAnyCourse(enrollments, courseId, courseTitle)) return true;

            List<StudentCourseBatch> scbs = studentCourseBatchRepository.findByStudentId(studentId);
            if (scbs.stream().anyMatch(scb -> courseValueMatches(scb.getCourseId(), courseId, courseTitle))) return true;
        }

        // 2. Direct match by studentEmail
        if (studentEmail != null && !studentEmail.isBlank()) {
            if (courseId != null && enrollmentRepository.existsByStudentEmailIgnoreCaseAndCourseId(studentEmail, courseId)) return true;
            List<Enrollment> enrollments = enrollmentRepository.findByStudentEmailIgnoreCase(studentEmail);
            if (matchesAnyCourse(enrollments, courseId, courseTitle)) return true;
        }

        // 3. Check user profile for enrolled course title/id
        Optional<User> uOpt = Optional.empty();
        if (studentId != null) {
            uOpt = userRepository.findById(studentId);
        }
        if (uOpt.isEmpty() && studentEmail != null && !studentEmail.isBlank()) {
            uOpt = userRepository.findByEmailIgnoreCase(studentEmail);
        }

        if (uOpt.isPresent()) {
            User u = uOpt.get();
            if (courseValueMatches(u.getCourse(), courseId, courseTitle)) {
                return true;
            }
        }

        return false;
    }

    private boolean matchesAnyCourse(List<Enrollment> list, String courseId, String courseTitle) {
        if (list == null) return false;
        return list.stream().anyMatch(e ->
                courseValueMatches(e.getCourseId(), courseId, courseTitle) ||
                courseValueMatches(e.getCourseTitle(), courseId, courseTitle)
        );
    }

    private boolean courseValueMatches(String val, String courseId, String courseTitle) {
        if (val == null || val.isBlank()) return false;
        if (courseId != null && (val.equalsIgnoreCase(courseId) || val.toLowerCase().contains(courseId.toLowerCase()))) return true;
        if (courseTitle != null && (val.equalsIgnoreCase(courseTitle) || val.toLowerCase().contains(courseTitle.toLowerCase()))) return true;
        return false;
    }

    private boolean isStudentInBatch(String studentId, String studentEmail, String batchId, String batchName, String courseId, String courseTitle) {
        if ((batchId == null || batchId.isBlank()) && (batchName == null || batchName.isBlank())) {
            return isStudentEnrolledInCourse(studentId, studentEmail, courseId, courseTitle);
        }

        if (studentId != null) {
            List<StudentCourseBatch> scbs = studentCourseBatchRepository.findByStudentId(studentId);
            if (scbs.stream().anyMatch(scb -> batchId != null && batchId.equalsIgnoreCase(scb.getBatchId()))) {
                return true;
            }
            List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
            if (enrollments.stream().anyMatch(e ->
                    (batchId != null && batchId.equalsIgnoreCase(e.getBatchId()))
                            || (batchName != null && batchName.equalsIgnoreCase(e.getBatchName()))
            )) {
                return true;
            }
        }

        if (studentEmail != null) {
            List<Enrollment> enrollments = enrollmentRepository.findByStudentEmailIgnoreCase(studentEmail);
            if (enrollments.stream().anyMatch(e ->
                    (batchId != null && batchId.equalsIgnoreCase(e.getBatchId()))
                            || (batchName != null && batchName.equalsIgnoreCase(e.getBatchName()))
            )) {
                return true;
            }
        }

        return false;
    }

    private boolean isTrainerAuthorizedForCourse(String trainerId, String trainerEmail, String trainerUsername, Course course) {
        if (course == null) return false;

        // Check assigned trainer on course
        if (trainerId != null) {
            if (trainerId.equalsIgnoreCase(course.getTrainerId()) || trainerId.equalsIgnoreCase(course.getAssignedTrainerId())) {
                return true;
            }
        }
        if (trainerUsername != null && trainerUsername.equalsIgnoreCase(course.getAssignedTrainer())) {
            return true;
        }

        // Check if trainer teaches any batch of this course
        List<Batch> batches = batchRepository.findByCourseId(course.getId());
        for (Batch b : batches) {
            if (trainerId != null) {
                if (trainerId.equalsIgnoreCase(b.getTrainerId())) return true;
                if (b.getTrainerIds() != null && b.getTrainerIds().contains(trainerId)) return true;
            }
            if (trainerUsername != null && trainerUsername.equalsIgnoreCase(b.getTrainerName())) {
                return true;
            }
        }

        // Check if trainer has an approved TrainerCourseRequest for this course
        if (trainerId != null) {
            if (trainerCourseRequestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(trainerId, course.getId(), "Approved").isPresent()) {
                return true;
            }
        }
        if (trainerEmail != null) {
            List<TrainerCourseRequest> reqs = trainerCourseRequestRepository.findByTrainerEmailIgnoreCase(trainerEmail);
            if (reqs.stream().anyMatch(r -> course.getId().equalsIgnoreCase(r.getCourseId()) && "Approved".equalsIgnoreCase(r.getStatus()))) {
                return true;
            }
        }

        return false;
    }

    private boolean isTrainerAuthorizedForSchedule(String trainerId, String trainerUsername, Schedule schedule) {
        if (schedule == null) return false;
        if (trainerId != null && trainerId.equalsIgnoreCase(schedule.getTrainerId())) return true;
        if (trainerUsername != null && trainerUsername.equalsIgnoreCase(schedule.getTrainer())) return true;

        if (schedule.getBatchId() != null) {
            Batch b = batchRepository.findById(schedule.getBatchId()).orElse(null);
            if (b != null) {
                if (trainerId != null) {
                    if (trainerId.equalsIgnoreCase(b.getTrainerId())) return true;
                    if (b.getTrainerIds() != null && b.getTrainerIds().contains(trainerId)) return true;
                }
                if (trainerUsername != null && trainerUsername.equalsIgnoreCase(b.getTrainerName())) return true;
            }
        }

        return false;
    }

    private boolean isTrainerAuthorizedForAssignment(String trainerId, String trainerUsername, Assignment assignment) {
        if (assignment == null) return false;
        if (trainerId != null && trainerId.equalsIgnoreCase(assignment.getTrainerId())) return true;
        if (trainerUsername != null && trainerUsername.equalsIgnoreCase(assignment.getTrainer())) return true;

        if (assignment.getCourseId() != null) {
            Course c = courseRepository.findById(assignment.getCourseId()).orElse(null);
            if (c != null && isTrainerAuthorizedForCourse(trainerId, null, trainerUsername, c)) {
                return true;
            }
        }

        return false;
    }

    private boolean isTrainerAuthorizedForSubmission(String trainerId, String trainerEmail, String trainerUsername, AssignmentSubmission sub) {
        if (sub == null) return false;

        // Submitter is this trainer
        if (trainerId != null && (trainerId.equalsIgnoreCase(sub.getStudentId()) || trainerId.equalsIgnoreCase(sub.getTrainerId()))) {
            return true;
        }
        if (trainerEmail != null && trainerEmail.equalsIgnoreCase(sub.getStudentEmail())) {
            return true;
        }

        // Assigned reviewer / trainer
        if (trainerId != null && trainerId.equalsIgnoreCase(sub.getTrainerId())) {
            return true;
        }
        if (trainerUsername != null && trainerUsername.equalsIgnoreCase(sub.getAssignedTrainer())) {
            return true;
        }

        // Teaches the course or batch
        if (sub.getCourseId() != null) {
            Course c = courseRepository.findById(sub.getCourseId()).orElse(null);
            if (c != null && isTrainerAuthorizedForCourse(trainerId, trainerEmail, trainerUsername, c)) {
                return true;
            }
        }

        if (sub.getBatchId() != null) {
            Batch b = batchRepository.findById(sub.getBatchId()).orElse(null);
            if (b != null) {
                if (trainerId != null) {
                    if (trainerId.equalsIgnoreCase(b.getTrainerId())) return true;
                    if (b.getTrainerIds() != null && b.getTrainerIds().contains(trainerId)) return true;
                }
                if (trainerUsername != null && trainerUsername.equalsIgnoreCase(b.getTrainerName())) return true;
            }
        }

        return false;
    }

    private boolean isUserRegisteredForCompetition(UserPrincipal user, String competitionId) {
        if (user == null || competitionId == null) return false;
        String userId = user.getId();
        String email = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
        List<CompetitionRegistration> regs = competitionRegistrationRepository.findByCompetitionId(competitionId);
        return regs.stream().anyMatch(r -> {
            boolean statusOk = "Confirmed".equalsIgnoreCase(r.getPaymentStatus()) || "Paid".equalsIgnoreCase(r.getPaymentStatus())
                    || "CONFIRMED".equalsIgnoreCase(r.getPaymentStatus()) || "PAID".equalsIgnoreCase(r.getPaymentStatus())
                    || "FREE_CONFIRMED".equalsIgnoreCase(r.getPaymentStatus()) || "Free".equalsIgnoreCase(r.getPaymentStatus())
                    || "SUCCESS".equalsIgnoreCase(r.getPaymentStatus()) || "COMPLETED".equalsIgnoreCase(r.getPaymentStatus());
            if (!statusOk) return false;
            boolean userMatch = (userId != null && userId.equals(r.getStudentId()))
                    || (email != null && !email.isBlank() && r.getStudentEmail() != null && email.equalsIgnoreCase(r.getStudentEmail().trim()));
            return userMatch;
        });
    }

    private boolean isTrainerAssignedToCompetition(String trainerId, String competitionId) {
        if (trainerId == null || competitionId == null) return false;
        List<CompetitionSet> sets = competitionSetRepository.findByCompetitionIdOrderByCodeAsc(competitionId);
        return sets.stream().anyMatch(s -> trainerId.equals(s.getTrainerId()));
    }
}
