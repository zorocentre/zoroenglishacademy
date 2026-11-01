package com.zoroacademy.service;

import com.zoroacademy.entity.Assignment;
import com.zoroacademy.entity.AssignmentSubmission;
import com.zoroacademy.entity.Batch;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.AssignmentRepository;
import com.zoroacademy.repository.AssignmentSubmissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final com.zoroacademy.repository.CourseRepository courseRepository;
    private final com.zoroacademy.repository.BatchRepository batchRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;
    private final com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;
    private final com.zoroacademy.repository.StudentModuleProgressRepository studentModuleProgressRepository;
    private final FileStorageService fileStorageService;
    private final ProgressService progressService;

    private final com.zoroacademy.repository.CourseModuleRepository courseModuleRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.EnrollmentRepository enrollmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.TrainerCourseRequestRepository trainerCourseRequestRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public AssignmentService(AssignmentRepository assignmentRepository,
                             AssignmentSubmissionRepository submissionRepository,
                             com.zoroacademy.repository.CourseRepository courseRepository,
                             com.zoroacademy.repository.BatchRepository batchRepository,
                             com.zoroacademy.repository.UserRepository userRepository,
                             com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                             NotificationService notificationService,
                             ActivityLogService activityLogService,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentModuleProgressRepository studentModuleProgressRepository,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) FileStorageService fileStorageService,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) ProgressService progressService,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.CourseModuleRepository courseModuleRepository) {
        this.assignmentRepository = assignmentRepository;
        this.submissionRepository = submissionRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.userRepository = userRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
        this.studentModuleProgressRepository = studentModuleProgressRepository;
        this.fileStorageService = fileStorageService;
        this.progressService = progressService;
        this.courseModuleRepository = courseModuleRepository;
    }

    public AssignmentService(AssignmentRepository assignmentRepository,
                             AssignmentSubmissionRepository submissionRepository,
                             com.zoroacademy.repository.CourseRepository courseRepository,
                             com.zoroacademy.repository.BatchRepository batchRepository,
                             com.zoroacademy.repository.UserRepository userRepository,
                             com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                             NotificationService notificationService,
                             ActivityLogService activityLogService) {
        this(assignmentRepository, submissionRepository, courseRepository, batchRepository, userRepository,
             studentCourseBatchRepository, notificationService, activityLogService, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<Assignment> getAllAssignments() {
        return assignmentRepository.findAll();
    }

    private User resolveAuthenticatedUser() {
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;
            String identifier;
            if (auth.getPrincipal() instanceof com.zoroacademy.security.UserPrincipal up) {
                identifier = up.getId();
            } else if (auth.getPrincipal() instanceof org.springframework.security.core.userdetails.UserDetails ud) {
                identifier = ud.getUsername();
            } else {
                identifier = auth.getName();
            }
            if (userRepository == null) return null;
            return userRepository.findById(identifier)
                    .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                    .or(() -> userRepository.findByUsernameIgnoreCase(identifier))
                    .orElse(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    @Transactional
    public Assignment createAssignment(Assignment assignment) {
        if (assignment.getId() == null || assignment.getId().isBlank()) {
            assignment.setId("asg_" + java.util.UUID.randomUUID());
        }

        // 1. Resolve and validate Course
        Course course = null;
        if (assignment.getCourseId() != null && !assignment.getCourseId().isBlank()) {
            course = courseRepository.findById(assignment.getCourseId()).orElse(null);
        }
        if (course == null && assignment.getCourse() != null && !assignment.getCourse().isBlank()) {
            course = courseRepository.findByTitleIgnoreCase(assignment.getCourse()).orElse(null);
        }
        if (course == null) {
            throw new com.zoroacademy.exception.BadRequestException("A valid course is required");
        }
        final Course finalCourse = course;
        assignment.setCourseId(finalCourse.getId());
        assignment.setCourse(finalCourse.getTitle());

        // 2. Mode enforcement: Strictly exclude Recorded courses
        if ("Recorded".equalsIgnoreCase(finalCourse.getMode())) {
            throw new com.zoroacademy.exception.ForbiddenException(
                    "Extra assignments are only permitted for Online and Hybrid courses. Recorded courses are excluded."
            );
        }

        // 3. User & Role validation (Trainer course/batch/student scoping)
        User currentUser = resolveAuthenticatedUser();
        String currentRole = (currentUser != null && currentUser.getRole() != null)
                ? currentUser.getRole().toUpperCase() : null;

        if ("TRAINER".equals(currentRole)) {
            String tId = currentUser.getId();
            String tName = currentUser.getName() != null ? currentUser.getName().trim() : "";
            String tEmail = currentUser.getEmail() != null ? currentUser.getEmail().trim() : "";

            // Check if trainer is allocated to course
            boolean isDirect = (finalCourse.getTrainerId() != null && finalCourse.getTrainerId().equals(tId))
                    || (finalCourse.getAssignedTrainer() != null && !tName.isEmpty() && finalCourse.getAssignedTrainer().equalsIgnoreCase(tName));

            boolean isRequested = false;
            if (trainerCourseRequestRepository != null) {
                List<com.zoroacademy.entity.TrainerCourseRequest> reqs = new ArrayList<>(trainerCourseRequestRepository.findByTrainerId(tId));
                if (!tEmail.isEmpty()) {
                    reqs.addAll(trainerCourseRequestRepository.findByTrainerEmailIgnoreCase(tEmail));
                }
                isRequested = reqs.stream().anyMatch(r ->
                        ("Approved".equalsIgnoreCase(r.getStatus()) || "Accepted".equalsIgnoreCase(r.getStatus()))
                                && (finalCourse.getId().equals(r.getCourseId()) || (r.getCourseTitle() != null && r.getCourseTitle().equalsIgnoreCase(finalCourse.getTitle())))
                );
            }

            boolean isBatchInstructor = false;
            if (batchRepository != null) {
                List<Batch> trainerBatches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(tId, tName);
                isBatchInstructor = trainerBatches.stream().anyMatch(b ->
                        finalCourse.getId().equals(b.getCourseId()) || (b.getCourseName() != null && b.getCourseName().equalsIgnoreCase(finalCourse.getTitle()))
                );
            }

            if (!isDirect && !isRequested && !isBatchInstructor) {
                throw new com.zoroacademy.exception.ForbiddenException("You are not allocated to teach course: " + finalCourse.getTitle());
            }

            assignment.setTrainerId(currentUser.getId());
            assignment.setTrainer(currentUser.getName());
            assignment.setCreatedBy(currentUser.getId());
            assignment.setCreatorRole("TRAINER");
        } else {
            // Relational trainer resolution for admin/system
            if (assignment.getTrainerId() != null && !assignment.getTrainerId().isBlank()) {
                userRepository.findById(assignment.getTrainerId()).ifPresent(u -> assignment.setTrainer(u.getName()));
            } else if (assignment.getTrainer() != null && !assignment.getTrainer().isBlank()) {
                userRepository.findByNameIgnoreCase(assignment.getTrainer()).stream()
                        .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                        .findFirst()
                        .ifPresent(u -> assignment.setTrainerId(u.getId()));
            }
        }

        // 4. Target audience normalization and validation
        if (assignment.getTargetType() == null || "course".equalsIgnoreCase(assignment.getTargetType())) {
            assignment.setTargetType("batch");
        }

        if ("batch".equalsIgnoreCase(assignment.getTargetType())) {
            Batch batch = null;
            if (assignment.getBatchId() != null && !assignment.getBatchId().isBlank()) {
                batch = batchRepository.findById(assignment.getBatchId()).orElse(null);
            }
            if (batch == null && assignment.getBatch() != null && !assignment.getBatch().isBlank()) {
                batch = batchRepository.findByNameIgnoreCaseAndCourseId(assignment.getBatch(), finalCourse.getId())
                        .or(() -> batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(assignment.getBatch(), finalCourse.getTitle()))
                        .orElse(null);
            }
            if (batch == null) {
                throw new com.zoroacademy.exception.BadRequestException("A valid batch is required when assigning to batch");
            }
            if (!finalCourse.getId().equals(batch.getCourseId()) && (batch.getCourseName() == null || !batch.getCourseName().equalsIgnoreCase(finalCourse.getTitle()))) {
                throw new com.zoroacademy.exception.BadRequestException("Batch " + batch.getName() + " does not belong to course " + finalCourse.getTitle());
            }
            if ("TRAINER".equals(currentRole)) {
                String tId = currentUser.getId();
                String tName = currentUser.getName() != null ? currentUser.getName().trim() : "";
                boolean batchOwner = (batch.getTrainerId() != null && batch.getTrainerId().equals(tId))
                        || (batch.getTrainerName() != null && !tName.isEmpty() && batch.getTrainerName().equalsIgnoreCase(tName));
                if (!batchOwner) {
                    throw new com.zoroacademy.exception.ForbiddenException("You are not allocated as trainer for batch: " + batch.getName());
                }
            }
            assignment.setBatchId(batch.getId());
            assignment.setBatch(batch.getName());
        } else if ("student".equalsIgnoreCase(assignment.getTargetType())) {
            String rawIds = assignment.getRawTargetStudentIds();
            String rawEmails = assignment.getRawTargetStudentEmails();
            if ((rawIds == null || rawIds.isBlank()) && (rawEmails == null || rawEmails.isBlank())) {
                throw new com.zoroacademy.exception.BadRequestException("At least one student must be selected when targeting specific students");
            }
            if (assignment.getBatchId() != null && !assignment.getBatchId().isBlank()) {
                batchRepository.findById(assignment.getBatchId()).ifPresent(b -> assignment.setBatch(b.getName()));
            }
        }

        Assignment saved = assignmentRepository.save(assignment);

        activityLogService.logAction(
                saved.getTrainerId() != null ? saved.getTrainerId() : (saved.getCreatedBy() != null ? saved.getCreatedBy() : "TRAINER"),
                saved.getTrainer() != null ? saved.getTrainer() : (saved.getCreatedBy() != null ? saved.getCreatedBy() : "Trainer"),
                "ASSIGNMENT_CREATED",
                "Created assignment: " + saved.getTitle() + " for " + saved.getCourse(),
                "System"
        );

        java.util.Set<String> recipientStudentIds = new java.util.HashSet<>();

        if ("student".equalsIgnoreCase(saved.getTargetType())) {
            // Targeted only to specific student(s)
            String rawIds = saved.getRawTargetStudentIds();
            if (rawIds != null && !rawIds.isBlank()) {
                for (String id : rawIds.split(",")) {
                    String clean = id.trim().replace("[", "").replace("]", "").replace("\"", "");
                    if (!clean.isEmpty()) {
                        recipientStudentIds.add(clean);
                    }
                }
            }
            String rawEmails = saved.getRawTargetStudentEmails();
            if (rawEmails != null && !rawEmails.isBlank() && userRepository != null) {
                for (String email : rawEmails.split(",")) {
                    String clean = email.trim().replace("[", "").replace("]", "").replace("\"", "");
                    if (!clean.isEmpty()) {
                        userRepository.findByEmailIgnoreCase(clean).ifPresent(u -> recipientStudentIds.add(u.getId()));
                    }
                }
            }
        } else {
            // Target audience is Entire Batch
            if (saved.getBatchId() != null && studentCourseBatchRepository != null) {
                studentCourseBatchRepository.findByBatchId(saved.getBatchId()).forEach(scb -> {
                    if (scb.getStudentId() != null && !scb.getStudentId().isBlank()) {
                        recipientStudentIds.add(scb.getStudentId());
                    }
                });
            }
            if (enrollmentRepository != null && saved.getCourseId() != null) {
                enrollmentRepository.findByCourseId(saved.getCourseId()).stream()
                    .filter(e -> ("Active".equalsIgnoreCase(e.getStatus()) || e.getStatus() == null))
                    .filter(e -> {
                        if (saved.getBatchId() != null && !saved.getBatchId().isBlank() && !"All".equalsIgnoreCase(saved.getBatchId())) {
                            return saved.getBatchId().equalsIgnoreCase(e.getBatchId()) ||
                                   (saved.getBatch() != null && saved.getBatch().equalsIgnoreCase(e.getBatchName()));
                        }
                        if (saved.getBatch() != null && !saved.getBatch().isBlank() && !"All".equalsIgnoreCase(saved.getBatch())) {
                            return saved.getBatch().equalsIgnoreCase(e.getBatchName());
                        }
                        return true;
                    })
                    .forEach(e -> {
                        if (e.getStudentId() != null && !e.getStudentId().isBlank()) {
                            recipientStudentIds.add(e.getStudentId());
                        }
                    });
            }
        }

        for (String sId : recipientStudentIds) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + java.util.UUID.randomUUID())
                    .recipientId(sId)
                    .recipientRole("STUDENT")
                    .title("New Assignment: " + saved.getTitle())
                    .message("New assignment '" + saved.getTitle() + "' posted for " + saved.getCourse() + ".")
                    .readStatus(false)
                    .build());
        }

        if (activityLogService != null) {
            activityLogService.logAction(null, null, "ASSIGNMENTS", "CREATE_ASSIGNMENT",
                "Created assignment: " + saved.getTitle() + " for course " + saved.getCourse(), null);
        }

        return saved;
    }

    @Transactional
    public Assignment updateAssignment(String id, Assignment updated) {
        Assignment existing = assignmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found: " + id));

        if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getDueDate() != null) existing.setDueDate(updated.getDueDate());
        if (updated.getAttachment() != null) existing.setAttachment(updated.getAttachment());
        if (updated.getCourseId() != null) existing.setCourseId(updated.getCourseId());
        if (updated.getCourse() != null) existing.setCourse(updated.getCourse());
        if (updated.getBatchId() != null) existing.setBatchId(updated.getBatchId());
        if (updated.getBatch() != null) existing.setBatch(updated.getBatch());
        if (updated.getTrainerId() != null) existing.setTrainerId(updated.getTrainerId());
        if (updated.getTrainer() != null) existing.setTrainer(updated.getTrainer());
        if (updated.getTargetType() != null) existing.setTargetType(updated.getTargetType());
        if (updated.getTargetName() != null) existing.setTargetName(updated.getTargetName());
        if (updated.getRawTargetStudentIds() != null) existing.setTargetStudentIds(updated.getRawTargetStudentIds());
        if (updated.getRawTargetStudentEmails() != null) existing.setTargetStudentEmails(updated.getRawTargetStudentEmails());
        if (updated.getRawTargetStudentNames() != null) existing.setTargetStudentNames(updated.getRawTargetStudentNames());
        if (updated.getCreatedBy() != null) existing.setCreatedBy(updated.getCreatedBy());
        if (updated.getCreatorRole() != null) existing.setCreatorRole(updated.getCreatorRole());

        // Re-resolve course if needed
        if (existing.getCourseId() != null && !existing.getCourseId().isBlank()) {
            courseRepository.findById(existing.getCourseId()).ifPresent(c -> existing.setCourse(c.getTitle()));
        }
        // Re-resolve batch if needed
        if (existing.getBatchId() != null && !existing.getBatchId().isBlank() && !"All".equalsIgnoreCase(existing.getBatchId())) {
            batchRepository.findById(existing.getBatchId()).ifPresent(b -> existing.setBatch(b.getName()));
        } else if ("All".equalsIgnoreCase(existing.getBatchId()) || existing.getBatchId() == null) {
            existing.setBatch("All");
        }
        // Re-resolve trainer if needed
        if (existing.getTrainerId() != null && !existing.getTrainerId().isBlank()) {
            userRepository.findById(existing.getTrainerId()).ifPresent(u -> existing.setTrainer(u.getName()));
        }

        Assignment saved = assignmentRepository.save(existing);
        if (activityLogService != null) {
            activityLogService.logAction(null, null, "ASSIGNMENTS", "UPDATE_ASSIGNMENT",
                "Updated assignment: " + saved.getTitle() + " (" + saved.getId() + ")", null);
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Assignment> getAssignmentsForStudent(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            return java.util.Collections.emptyList();
        }

        com.zoroacademy.entity.User student = userRepository.findById(studentId)
                .or(() -> userRepository.findByEmailIgnoreCase(studentId))
                .orElse(null);
        String actualId = student != null ? student.getId() : studentId;
        String actualEmail = (student != null && student.getEmail() != null) ? student.getEmail().toLowerCase() : studentId.toLowerCase();

        java.util.Set<String> courseIds = new java.util.HashSet<>();
        java.util.Set<String> courseTitles = new java.util.HashSet<>();
        java.util.Set<String> batchIds = new java.util.HashSet<>();
        java.util.Set<String> batchNames = new java.util.HashSet<>();

        if (studentCourseBatchRepository != null) {
            List<com.zoroacademy.entity.StudentCourseBatch> scbs = new java.util.ArrayList<>(studentCourseBatchRepository.findByStudentId(actualId));
            if (!actualId.equalsIgnoreCase(actualEmail)) {
                scbs.addAll(studentCourseBatchRepository.findByStudentId(actualEmail));
            }
            for (com.zoroacademy.entity.StudentCourseBatch scb : scbs) {
                if (scb.getCourseId() != null) courseIds.add(scb.getCourseId());
                if (scb.getBatchId() != null) batchIds.add(scb.getBatchId());
            }
        }

        if (enrollmentRepository != null) {
            List<com.zoroacademy.entity.Enrollment> enrs = enrollmentRepository.findByStudentId(actualId).stream()
                    .filter(e -> "Active".equalsIgnoreCase(e.getStatus()) || e.getStatus() == null)
                    .collect(java.util.stream.Collectors.toList());
            if (!actualId.equalsIgnoreCase(actualEmail)) {
                enrs.addAll(enrollmentRepository.findByStudentId(actualEmail).stream()
                        .filter(e -> "Active".equalsIgnoreCase(e.getStatus()) || e.getStatus() == null)
                        .collect(java.util.stream.Collectors.toList()));
            }
            for (com.zoroacademy.entity.Enrollment e : enrs) {
                if (e.getCourseId() != null) courseIds.add(e.getCourseId());
                if (e.getCourseTitle() != null) courseTitles.add(e.getCourseTitle().toLowerCase());
                if (e.getBatchId() != null) batchIds.add(e.getBatchId());
                if (e.getBatchName() != null) batchNames.add(e.getBatchName().toLowerCase());
            }
        }

        return assignmentRepository.findAll().stream()
                .filter(a -> {
                    // Check target type
                    String targetType = a.getTargetType();
                    if ("student".equalsIgnoreCase(targetType)) {
                        // Strict targeting: ONLY specified students
                        String rawIds = a.getRawTargetStudentIds();
                        if (rawIds != null) {
                            for (String part : rawIds.split(",")) {
                                String clean = part.trim().replace("[", "").replace("]", "").replace("\"", "");
                                if (!clean.isEmpty() && (clean.equalsIgnoreCase(actualId) || clean.equalsIgnoreCase(actualEmail))) {
                                    return true;
                                }
                            }
                        }
                        String rawEmails = a.getRawTargetStudentEmails();
                        if (rawEmails != null) {
                            for (String part : rawEmails.split(",")) {
                                String clean = part.trim().replace("[", "").replace("]", "").replace("\"", "");
                                if (!clean.isEmpty() && clean.equalsIgnoreCase(actualEmail)) {
                                    return true;
                                }
                            }
                        }
                        String singular = a.getTargetStudentEmail();
                        if (singular != null && singular.equalsIgnoreCase(actualEmail)) {
                            return true;
                        }
                        return false; // Student not in targeted student list
                    }

                    // Otherwise, target audience is Entire Batch
                    boolean matchCourse = (a.getCourseId() != null && courseIds.contains(a.getCourseId()))
                            || (a.getCourse() != null && courseTitles.contains(a.getCourse().toLowerCase()));
                    if (!matchCourse) {
                        return false;
                    }

                    boolean isBatchAll = a.getBatchId() == null || "All".equalsIgnoreCase(a.getBatchId())
                            || a.getBatch() == null || "All".equalsIgnoreCase(a.getBatch());
                    if (isBatchAll) {
                        return true;
                    }

                    boolean matchBatchId = a.getBatchId() != null && batchIds.contains(a.getBatchId());
                    boolean matchBatchName = a.getBatch() != null && batchNames.contains(a.getBatch().toLowerCase());

                    return matchBatchId || matchBatchName;
                })
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AssignmentSubmission> getAllSubmissions() {
        // Requirement: The existing admin Assignments page shows student assignments only.
        return submissionRepository.findAll().stream()
                .filter(s -> s.getSubmitterRole() == null || "STUDENT".equalsIgnoreCase(s.getSubmitterRole()))
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AssignmentSubmission> getTrainerSubmissions() {
        // Requirement: Admin "Trainer Assignments" page shows trainer submissions only.
        return submissionRepository.findBySubmitterRoleIgnoreCaseOrderByCreatedAtDesc("TRAINER");
    }

    @Transactional(readOnly = true)
    public List<AssignmentSubmission> getSubmissionsByStudent(String studentIdOrEmail) {
        return submissionRepository.findByStudentIdOrStudentEmailIgnoreCase(studentIdOrEmail, studentIdOrEmail).stream()
                .filter(s -> s.getSubmitterRole() == null || "STUDENT".equalsIgnoreCase(s.getSubmitterRole()))
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AssignmentSubmission> getSubmissionsByTrainer(String trainerIdOrName) {
        // Submissions to be reviewed by this trainer (only student submissions)
        return submissionRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(trainerIdOrName, trainerIdOrName).stream()
                .filter(s -> s.getSubmitterRole() == null || "STUDENT".equalsIgnoreCase(s.getSubmitterRole()))
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AssignmentSubmission> getTrainerOwnSubmissions(String trainerIdOrEmail) {
        // Trainer LMS view: submissions made by this trainer as a learner (cannot see other trainers)
        List<AssignmentSubmission> list = new java.util.ArrayList<>(submissionRepository.findByStudentIdAndSubmitterRoleIgnoreCase(trainerIdOrEmail, "TRAINER"));
        if (list.isEmpty()) {
            list.addAll(submissionRepository.findByStudentEmailIgnoreCaseAndSubmitterRoleIgnoreCase(trainerIdOrEmail, "TRAINER"));
        }
        return list;
    }

    @Transactional
    public AssignmentSubmission createSubmission(AssignmentSubmission submission) {
        if (submission.getAttachment() == null || submission.getAttachment().isBlank() || "null".equalsIgnoreCase(submission.getAttachment().trim())) {
            throw new IllegalArgumentException("Submission solution file is required");
        }
        if (submission.getAnswerText() == null || submission.getAnswerText().trim().isEmpty()) {
            if (submission.getRemarks() != null && !submission.getRemarks().trim().isEmpty()) {
                submission.setAnswerText(submission.getRemarks().trim());
            } else {
                throw new IllegalArgumentException("Submission answer notes/remarks are required");
            }
        }
        if (submission.getRemarks() == null || submission.getRemarks().isBlank()) {
            submission.setRemarks(submission.getAnswerText());
        }

        if (submission.getId() == null || submission.getId().isBlank()) {
            submission.setId("sub_" + java.util.UUID.randomUUID());
        }
        if (submission.getSubmittedAt() == null || submission.getSubmittedAt().isBlank()) {
            submission.setSubmittedAt(java.time.Instant.now().toString());
        }
        if (submission.getStatus() == null || submission.getStatus().isBlank()) {
            submission.setStatus("Pending Correction");
        }

        // Relational student resolution
        if (submission.getStudentId() != null && !submission.getStudentId().isBlank()) {
            userRepository.findById(submission.getStudentId()).ifPresent(u -> {
                submission.setStudentName(u.getName());
                submission.setStudentEmail(u.getEmail());
                if (submission.getSubmitterRole() == null || submission.getSubmitterRole().isBlank() || "STUDENT".equalsIgnoreCase(submission.getSubmitterRole())) {
                    submission.setSubmitterRole("TRAINER".equalsIgnoreCase(u.getRole()) ? "TRAINER" : "STUDENT");
                }
            });
        } else if (submission.getStudentEmail() != null && !submission.getStudentEmail().isBlank()) {
            userRepository.findByEmailIgnoreCase(submission.getStudentEmail()).ifPresent(u -> {
                submission.setStudentId(u.getId());
                submission.setStudentName(u.getName());
                if (submission.getSubmitterRole() == null || submission.getSubmitterRole().isBlank() || "STUDENT".equalsIgnoreCase(submission.getSubmitterRole())) {
                    submission.setSubmitterRole("TRAINER".equalsIgnoreCase(u.getRole()) ? "TRAINER" : "STUDENT");
                }
            });
        }
        if (submission.getSubmitterRole() == null || submission.getSubmitterRole().isBlank()) {
            submission.setSubmitterRole("STUDENT");
        }

        if ("TRAINER".equalsIgnoreCase(submission.getSubmitterRole())) {
            submission.setReviewer("ADMIN");
            if (submission.getAssignedTrainer() == null || submission.getAssignedTrainer().isBlank()) {
                submission.setAssignedTrainer("Admin");
            }
        }

        // Relational assignment resolution
        if (submission.getAssignmentId() != null && !submission.getAssignmentId().isBlank()) {
            assignmentRepository.findById(submission.getAssignmentId()).ifPresent(a -> {
                submission.setAssignmentTitle(a.getTitle());
                if (submission.getCourseId() == null) submission.setCourseId(a.getCourseId());
                if (submission.getCourseTitle() == null) submission.setCourseTitle(a.getCourse());
                if (submission.getBatchId() == null) submission.setBatchId(a.getBatchId());
                if (submission.getBatchName() == null) submission.setBatchName(a.getBatch());
                if (submission.getTrainerId() == null) submission.setTrainerId(a.getTrainerId());
                if (submission.getAssignedTrainer() == null) submission.setAssignedTrainer(a.getTrainer());

                // Enforce batch targeting: when assignment has batch_id (not null and not "All"), only students in that batch can submit
                if (a.getBatchId() != null && !a.getBatchId().isBlank() && !"All".equalsIgnoreCase(a.getBatchId())) {
                    if (submission.getStudentId() != null && !submission.getStudentId().isBlank()) {
                        boolean inBatch = studentCourseBatchRepository.findByStudentId(submission.getStudentId()).stream()
                                .anyMatch(scb -> a.getBatchId().equals(scb.getBatchId()));
                        if (!inBatch) {
                            throw new IllegalArgumentException("Student is not assigned to batch " + (a.getBatch() != null ? a.getBatch() : a.getBatchId()) + " for this assignment");
                        }
                    }
                }
            });
        }

        // For recorded module submissions, inherit assigned trainer from course if not already present
        if ("module".equalsIgnoreCase(submission.getSourceType()) && submission.getCourseId() != null) {
            courseRepository.findById(submission.getCourseId()).ifPresent(c -> {
                if (submission.getTrainerId() == null || submission.getTrainerId().isBlank()) {
                    submission.setTrainerId(c.getAssignedTrainerId() != null ? c.getAssignedTrainerId() : c.getTrainerId());
                }
                if (submission.getAssignedTrainer() == null || submission.getAssignedTrainer().isBlank()) {
                    submission.setAssignedTrainer(c.getAssignedTrainer());
                }
            });
        }

        // Module Assignment Submission Gating (Requirement Phase 1.3)
        if ("module".equalsIgnoreCase(submission.getSourceType())) {
            String mId = submission.getSourceId() != null && !submission.getSourceId().isBlank() ? submission.getSourceId() : submission.getAssignmentId();
            String sId = submission.getStudentId();
            if (mId != null && courseModuleRepository != null) {
                com.zoroacademy.entity.CourseModule mod = courseModuleRepository.findById(mId).orElse(null);
                if (mod != null) {
                    boolean hasVideo = mod.getVideoStorageRef() != null && !mod.getVideoStorageRef().isBlank()
                            && !mod.getVideoStorageRef().equals("null") && !mod.getVideoStorageRef().equals("{}");
                    if (hasVideo) {
                        boolean videoDone = false;
                        if (studentModuleProgressRepository != null && sId != null) {
                            videoDone = studentModuleProgressRepository.findByStudentIdAndModuleId(sId, mId)
                                    .map(smp -> Boolean.TRUE.equals(smp.getVideoCompleted())).orElse(false);
                        }
                        if (!videoDone) {
                            throw new com.zoroacademy.exception.ConflictException("Watch the full video to enable submission. You must complete at least 95% of video playback.");
                        }
                    }
                }
            }

            if (submission.getAttachment() == null || submission.getAttachment().isBlank() || "{}".equals(submission.getAttachment().trim())) {
                throw new com.zoroacademy.exception.ConflictException("Choose a file to submit assignment solution.");
            }
            if (submission.getAnswerText() == null || submission.getAnswerText().trim().isEmpty()) {
                throw new com.zoroacademy.exception.ConflictException("Answer notes are required to submit assignment solution.");
            }
        }

        AssignmentSubmission saved = submissionRepository.save(submission);

        if ("TRAINER".equalsIgnoreCase(saved.getSubmitterRole())) {
            activityLogService.logAction(
                    saved.getStudentId() != null ? saved.getStudentId() : "TRAINER",
                    saved.getStudentName() != null ? saved.getStudentName() : "Trainer",
                    "TRAINER_SUBMISSION_UPLOADED",
                    "Trainer " + saved.getStudentName() + " submitted assignment for " + saved.getCourseTitle(),
                    "System"
            );
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + java.util.UUID.randomUUID())
                    .recipientRole("ADMIN")
                    .title("Trainer Assignment Submitted")
                    .message("Trainer " + saved.getStudentName() + " submitted assignment for '" + saved.getAssignmentTitle() + "' in " + saved.getCourseTitle() + ".")
                    .readStatus(false)
                    .build());
        } else {
            activityLogService.logAction(
                    saved.getStudentId() != null ? saved.getStudentId() : "STUDENT",
                    saved.getStudentName() != null ? saved.getStudentName() : "Student",
                    "ASSIGNMENTS",
                    "STUDENT_SUBMISSION_UPLOADED",
                    "Student " + saved.getStudentName() + " submitted assignment for '" + saved.getAssignmentTitle() + "' in " + saved.getCourseTitle(),
                    null
            );
        }

        if ("module".equalsIgnoreCase(saved.getSourceType())) {
            String sId = saved.getStudentId();
            String cId = saved.getCourseId();
            String mId = saved.getSourceId() != null && !saved.getSourceId().isBlank() ? saved.getSourceId() : saved.getAssignmentId();
            if (sId != null && mId != null) {
                if (studentModuleProgressRepository != null) {
                    com.zoroacademy.entity.StudentModuleProgress smp = studentModuleProgressRepository
                            .findByStudentIdAndModuleId(sId, mId)
                            .orElse(com.zoroacademy.entity.StudentModuleProgress.builder()
                                     .id("smp_" + java.util.UUID.randomUUID())
                                    .studentId(sId)
                                    .moduleId(mId)
                                    .courseId(cId)
                                    .watchedSeconds(0)
                                    .lastPosition(0)
                                    .build());
                    smp.setCompleted(true);
                    smp.setUpdatedAt(LocalDateTime.now());
                    studentModuleProgressRepository.save(smp);
                }
                if (progressService != null) {
                    progressService.updateModuleProgress(sId, cId, mId, null, 100, "Completed");
                }
            }
        }

        return saved;
    }

    @Transactional
    public AssignmentSubmission reviewSubmission(String id, String score, String remarks, String correctedBy, String correctionAttachment, String correctedFileUrl) {
        AssignmentSubmission sub = submissionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found: " + id));

        sub.setScore(score);
        sub.setRemarks(remarks);
        sub.setFeedback(remarks);
        sub.setCorrectedBy(correctedBy != null ? correctedBy : "ADMIN");
        sub.setCorrectedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy hh:mm a")));
        sub.setStatus("Corrected");
        if (correctionAttachment != null) {
            sub.setCorrectionAttachment(correctionAttachment);
        }
        if (correctedFileUrl != null && !correctedFileUrl.isBlank()) {
            sub.setCorrectedFileUrl(correctedFileUrl);
        }

        AssignmentSubmission saved = submissionRepository.save(sub);

        boolean isTrainerSubmitter = "TRAINER".equalsIgnoreCase(saved.getSubmitterRole());
        String recipientRole = isTrainerSubmitter ? "TRAINER" : "STUDENT";
        String notifTitle = isTrainerSubmitter ? "Trainer Assignment Reviewed" : "Assignment Graded";
        String notifMsg = isTrainerSubmitter
                ? "Your assignment submission for '" + saved.getAssignmentTitle() + "' in " + saved.getCourseTitle() + " has been reviewed by Admin. Score: " + score + (remarks != null && !remarks.isBlank() ? " | Feedback: " + remarks : "")
                : "Your submission for '" + saved.getAssignmentTitle() + "' has been graded: " + score + ".";

        activityLogService.logAction(
                correctedBy != null ? correctedBy : "ADMIN",
                correctedBy != null ? correctedBy : "Admin",
                isTrainerSubmitter ? "TRAINER_SUBMISSION_GRADED" : "SUBMISSION_GRADED",
                "Graded submission for " + saved.getStudentName() + " on " + saved.getAssignmentTitle() + " with score: " + score,
                "System"
        );

        if (saved.getStudentId() != null && !saved.getStudentId().isBlank()) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + java.util.UUID.randomUUID())
                    .recipientId(saved.getStudentId())
                    .recipientRole(recipientRole)
                    .title(notifTitle)
                    .message(notifMsg)
                    .readStatus(false)
                    .build());
        }

        return saved;
    }

    @Transactional
    public AssignmentSubmission reviewSubmission(String id, String score, String remarks, String correctedBy, String correctionAttachment) {
        return reviewSubmission(id, score, remarks, correctedBy, correctionAttachment, null);
    }

    private void cleanupStoredFilesFromText(String text) {
        if (text == null || text.isBlank() || fileStorageService == null) return;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})").matcher(text);
        while (matcher.find()) {
            try {
                fileStorageService.deleteFile(matcher.group(1));
            } catch (Exception ignored) {}
        }
    }

    @Transactional
    public void deleteAssignment(String id) {
        Assignment a = assignmentRepository.findById(id).orElse(null);
        if (a != null) {
            cleanupStoredFilesFromText(a.getAttachment());
            assignmentRepository.delete(a);
            if (activityLogService != null) {
                activityLogService.logAction(null, null, "ASSIGNMENTS", "DELETE_ASSIGNMENT",
                    "Deleted assignment: " + a.getTitle() + " (" + a.getId() + ")", null);
            }
        }
    }

    @Transactional
    public void deleteSubmission(String id) {
        AssignmentSubmission submission = submissionRepository.findById(id).orElse(null);
        if (submission != null) {
            cleanupStoredFilesFromText(submission.getAttachment());
            cleanupStoredFilesFromText(submission.getCorrectionAttachment());
            submissionRepository.delete(submission);
            if (activityLogService != null) {
                activityLogService.logAction(null, null, "ASSIGNMENTS", "DELETE_SUBMISSION",
                    "Deleted submission for " + submission.getStudentName() + " on assignment " + submission.getAssignmentTitle(), null);
            }
        }
    }
}
