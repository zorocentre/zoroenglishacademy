package com.zoroacademy.service;

import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentRequestRepository requestRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final StudentFeeRepository studentFeeRepository;
    private final BatchRepository batchRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                             EnrollmentRequestRepository requestRepository,
                             CourseRepository courseRepository,
                             UserRepository userRepository,
                             StudentCourseBatchRepository studentCourseBatchRepository,
                             StudentFeeRepository studentFeeRepository,
                             BatchRepository batchRepository,
                             NotificationService notificationService,
                             ActivityLogService activityLogService) {
        this.enrollmentRepository = enrollmentRepository;
        this.requestRepository = requestRepository;
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.studentFeeRepository = studentFeeRepository;
        this.batchRepository = batchRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<Enrollment> getAllEnrollments() {
        List<Enrollment> list = enrollmentRepository.findAll();
        list.forEach(this::enrichEnrollment);
        return list;
    }

    @Transactional(readOnly = true)
    public List<Enrollment> getStudentEnrollments(String studentIdOrEmail) {
        List<Enrollment> byId = enrollmentRepository.findByStudentId(studentIdOrEmail);
        if (byId.isEmpty()) {
            byId = enrollmentRepository.findByStudentEmailIgnoreCase(studentIdOrEmail);
        }
        byId.forEach(this::enrichEnrollment);
        return byId;
    }

    private void enrichEnrollment(Enrollment e) {
        if (e == null) return;
        if (courseRepository != null && e.getCourseId() != null) {
            courseRepository.findById(e.getCourseId()).ifPresent(c -> {
                e.setCourseMode(c.getMode());
                String mode = c.getMode() != null ? c.getMode() : "Online";
                if ("Recorded".equalsIgnoreCase(mode)) {
                    String tId = c.getTrainerId() != null ? c.getTrainerId() : c.getAssignedTrainerId();
                    e.setTrainerId(tId);
                    e.setTrainerName(c.getAssignedTrainer());
                }
            });
        }
        String mode = e.getCourseMode() != null ? e.getCourseMode() : "Online";
        if (!"Recorded".equalsIgnoreCase(mode)) {
            String bId = e.getBatchId();
            if ((bId == null || bId.isBlank()) && studentCourseBatchRepository != null && e.getStudentId() != null && e.getCourseId() != null) {
                studentCourseBatchRepository.findByStudentIdAndCourseId(e.getStudentId(), e.getCourseId()).ifPresent(scb -> {
                    e.setBatchId(scb.getBatchId());
                    e.setBatchName(scb.getBatchName());
                });
                bId = e.getBatchId();
            }
            if (bId != null && !bId.isBlank() && batchRepository != null) {
                batchRepository.findById(bId).ifPresent(b -> {
                    if (e.getBatchName() == null || e.getBatchName().isBlank()) {
                        e.setBatchName(b.getName());
                    }
                    java.util.List<java.util.Map<String, String>> trainerList = new java.util.ArrayList<>();
                    if (b.getTrainerIds() != null && !b.getTrainerIds().isEmpty()) {
                        for (String tId : b.getTrainerIds()) {
                            if (userRepository != null) {
                                userRepository.findById(tId).ifPresent(u -> {
                                    java.util.Map<String, String> m = new java.util.HashMap<>();
                                    m.put("id", u.getId());
                                    m.put("name", u.getName());
                                    trainerList.add(m);
                                });
                            }
                        }
                    } else if (b.getTrainerId() != null && !b.getTrainerId().isBlank()) {
                        java.util.Map<String, String> m = new java.util.HashMap<>();
                        m.put("id", b.getTrainerId());
                        m.put("name", b.getTrainerName() != null ? b.getTrainerName() : "Trainer");
                        trainerList.add(m);
                    }
                    e.setTrainers(trainerList);
                });
            }
        }
    }

    @Transactional
    public Enrollment enroll(String studentId, String studentEmail, String courseId, String batchIdOrName) {
        String effectiveStudentId = studentId;
        String effectiveEmail = studentEmail;
        String studentName = "Student";

        if (effectiveStudentId != null && effectiveStudentId.contains("@")) {
            effectiveEmail = effectiveStudentId;
            Optional<User> uOpt = userRepository.findByEmailIgnoreCase(effectiveEmail);
            if (uOpt.isPresent()) {
                effectiveStudentId = uOpt.get().getId();
                studentName = uOpt.get().getName();
            }
        } else if (effectiveEmail != null && (effectiveStudentId == null || effectiveStudentId.isBlank())) {
            Optional<User> uOpt = userRepository.findByEmailIgnoreCase(effectiveEmail);
            if (uOpt.isPresent()) {
                effectiveStudentId = uOpt.get().getId();
                studentName = uOpt.get().getName();
            }
        } else if (effectiveStudentId != null) {
            Optional<User> uOpt = userRepository.findById(effectiveStudentId);
            if (uOpt.isPresent()) {
                effectiveEmail = uOpt.get().getEmail();
                studentName = uOpt.get().getName();
            }
        }

        if (effectiveStudentId == null || effectiveStudentId.isBlank()) {
            throw new IllegalArgumentException("Valid student ID or email is required for enrollment.");
        }

        final String finalEffectiveStudentId = effectiveStudentId;
        final String finalEffectiveEmail = effectiveEmail;
        final String finalStudentName = studentName;

        // Resolve course
        Optional<Course> courseOpt = courseRepository.findById(courseId)
                .or(() -> courseRepository.findByTitleIgnoreCase(courseId));
        if (courseOpt.isEmpty()) {
            throw new IllegalArgumentException("Course not found: " + courseId);
        }
        Course course = courseOpt.get();
        String finalCourseId = course.getId();
        String finalCourseTitle = course.getTitle();

        boolean isRecorded = "Recorded".equalsIgnoreCase(course.getMode());

        // Resolve batch
        String finalBatchId = null;
        String finalBatchName = null;
        if (!isRecorded && batchIdOrName != null && !batchIdOrName.isBlank()) {
            Optional<Batch> batchOpt = batchRepository.findById(batchIdOrName)
                    .or(() -> batchRepository.findByNameIgnoreCaseAndCourseId(batchIdOrName, finalCourseId))
                    .or(() -> batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(batchIdOrName, finalCourseTitle));
            if (batchOpt.isPresent()) {
                finalBatchId = batchOpt.get().getId();
                finalBatchName = batchOpt.get().getName();
            } else {
                finalBatchName = batchIdOrName;
            }
        }
        final String resolvedBatchId = finalBatchId;
        final String resolvedBatchName = finalBatchName;

        // 1. Create or Reactivate Enrollment
        Optional<Enrollment> existingEnr = enrollmentRepository.findByStudentIdAndCourseId(finalEffectiveStudentId, finalCourseId);
        boolean isNew = existingEnr.isEmpty();
        Enrollment enrollment = existingEnr.orElseGet(() -> Enrollment.builder()
                .id("enr_" + UUID.randomUUID())
                .studentId(finalEffectiveStudentId)
                .studentEmail(finalEffectiveEmail != null ? finalEffectiveEmail : "")
                .courseId(finalCourseId)
                .enrolledDate(LocalDate.now().toString())
                .build());

        enrollment.setStudentEmail(finalEffectiveEmail != null ? finalEffectiveEmail : "");
        enrollment.setCourseTitle(finalCourseTitle);
        enrollment.setBatchId(resolvedBatchId);
        enrollment.setBatchName(resolvedBatchName);
        enrollment.setStatus("Active");
        if (enrollment.getCourseTotalFee() == null) {
            enrollment.setCourseTotalFee(course.getPrice() != null ? course.getPrice() : java.math.BigDecimal.ZERO);
        }
        enrollment = enrollmentRepository.save(enrollment);

        // 2. Create or Update StudentCourseBatch
        StudentCourseBatch scb = studentCourseBatchRepository.findByStudentIdAndCourseId(finalEffectiveStudentId, finalCourseId)
                .orElseGet(() -> {
                    StudentCourseBatch n = new StudentCourseBatch();
                    n.setStudentId(finalEffectiveStudentId);
                    n.setCourseId(finalCourseId);
                    return n;
                });
        scb.setCourseName(finalCourseTitle);
        scb.setBatchId(resolvedBatchId);
        scb.setBatchName(resolvedBatchName);
        studentCourseBatchRepository.save(scb);

        // 3. Create StudentFee with amount = course.fee, paid = 0, status = 'Pending' (if not present)
        studentFeeRepository.findByStudentIdAndCourseId(finalEffectiveStudentId, finalCourseId).ifPresentOrElse(
                existingFee -> {
                    if (isRecorded) {
                        existingFee.setBatchId(null);
                        existingFee.setBatch(null);
                    } else {
                        if (resolvedBatchId != null) existingFee.setBatchId(resolvedBatchId);
                        if (resolvedBatchName != null && !resolvedBatchName.isBlank()) existingFee.setBatch(resolvedBatchName);
                    }
                    studentFeeRepository.save(existingFee);
                },
                () -> {
                    java.math.BigDecimal feeAmount = course.getPrice() != null ? course.getPrice() : java.math.BigDecimal.ZERO;
                    StudentFee fee = StudentFee.builder()
                            .id("fee_" + UUID.randomUUID())
                            .studentId(finalEffectiveStudentId)
                            .studentName(finalStudentName)
                            .courseId(finalCourseId)
                            .course(finalCourseTitle)
                            .batchId(isRecorded ? null : resolvedBatchId)
                            .batch(isRecorded ? null : (resolvedBatchName != null && !resolvedBatchName.isBlank() ? resolvedBatchName : "Unassigned"))
                            .totalFee(feeAmount)
                            .paidAmount(java.math.BigDecimal.ZERO)
                            .dueAmount(feeAmount)
                            .status(feeAmount.compareTo(java.math.BigDecimal.ZERO) == 0 ? "Paid" : "Pending")
                            .date(LocalDate.now().toString())
                            .build();
                    studentFeeRepository.save(fee);
                }
        );

        // 4. Increment course enrolled count if new
        if (isNew) {
            course.setEnrolled((course.getEnrolled() != null ? course.getEnrolled() : 0) + 1);
            courseRepository.save(course);
        }

        // 5. Notification & Activity Log
        Notification notif = Notification.builder()
                .id("notif_" + UUID.randomUUID())
                .recipientId(effectiveStudentId)
                .recipientRole("STUDENT")
                .title("Enrolled in " + finalCourseTitle)
                .message("You have been enrolled in " + finalCourseTitle + (resolvedBatchName != null && !resolvedBatchName.isBlank() ? " (" + resolvedBatchName + ")" : "") + ".")
                .readStatus(false)
                .build();
        notificationService.createNotification(notif);

        activityLogService.logAction(effectiveStudentId, studentName, "COURSE_ENROLLED",
                "Enrolled in course: " + finalCourseTitle + (resolvedBatchName != null && !resolvedBatchName.isBlank() ? " [" + resolvedBatchName + "]" : ""), "System");

        return enrollment;
    }

    @Transactional
    public Enrollment enrollStudent(String studentId, String studentEmail, String courseId, String batchName) {
        return enroll(studentId, studentEmail, courseId, batchName);
    }

    @Transactional
    public void deactivateEnrollment(String studentId, String courseId) {
        enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId).ifPresent(enrollment -> {
            enrollment.setStatus("Inactive");
            enrollmentRepository.save(enrollment);
        });
        studentCourseBatchRepository.findByStudentIdAndCourseId(studentId, courseId).ifPresent(studentCourseBatchRepository::delete);
        // StudentFee is intentionally kept for accounting history per requirements
    }

    @Transactional(readOnly = true)
    public List<EnrollmentRequest> getAllEnrollmentRequests() {
        return requestRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<EnrollmentRequest> getStudentEnrollmentRequests(String studentIdOrEmail) {
        List<EnrollmentRequest> byId = requestRepository.findByStudentId(studentIdOrEmail);
        if (byId.isEmpty()) {
            return requestRepository.findByStudentEmailIgnoreCase(studentIdOrEmail);
        }
        return byId;
    }

    @Transactional
    public EnrollmentRequest createEnrollmentRequest(EnrollmentRequest req) {
        String effectiveEmail = req.getStudentEmail() != null ? req.getStudentEmail() : req.getStudentId();
        
        // Prevent duplicate pending requests
        Optional<EnrollmentRequest> existing = requestRepository.findByStudentIdAndCourseIdAndStatus(req.getStudentId(), req.getCourseId(), "Pending")
                .or(() -> requestRepository.findByStudentEmailIgnoreCaseAndCourseIdAndStatus(effectiveEmail, req.getCourseId(), "Pending"));

        if (existing.isPresent()) {
            return existing.get();
        }

        if (req.getId() == null || req.getId().isBlank()) {
            req.setId("enr_req_" + UUID.randomUUID());
        }
        if (req.getStatus() == null || req.getStatus().isBlank()) {
            req.setStatus("Pending");
        }
        if (req.getRequestDate() == null || req.getRequestDate().isBlank()) {
            req.setRequestDate(LocalDate.now().toString());
        }

        return requestRepository.save(req);
    }

    @Transactional
    public EnrollmentRequest updateEnrollmentRequestStatus(String id, String status, String remarks) {
        EnrollmentRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Enrollment request not found: " + id));

        req.setStatus(status);
        if (remarks != null) req.setRemarks(remarks);

        // If approved, automatically enroll student (or assign trainer if mode is Trainer)
        if ("Approved".equalsIgnoreCase(status)) {
            if ("Trainer".equalsIgnoreCase(req.getMode())) {
                courseRepository.findById(req.getCourseId()).ifPresent(course -> {
                    course.setTrainerId(req.getStudentId());
                    course.setAssignedTrainer(req.getStudentName());
                    courseRepository.save(course);
                });
            } else {
                try {
                    enroll(req.getStudentId(), req.getStudentEmail(), req.getCourseId(), req.getBatchName());
                } catch (Exception ignored) {
                    // Ignore if already enrolled
                }
            }
        } else if ("Rejected".equalsIgnoreCase(status)) {
            if (notificationService != null) {
                String targetId = req.getStudentId() != null && !req.getStudentId().isBlank() ? req.getStudentId() : req.getStudentEmail();
                if (targetId != null && !targetId.isBlank()) {
                    notificationService.createNotification(Notification.builder()
                            .id("notif_" + UUID.randomUUID())
                            .recipientId(targetId)
                            .recipientRole("STUDENT")
                            .title("Course Registration Not Approved")
                            .message("Your registration request for '" + (req.getCourseTitle() != null ? req.getCourseTitle() : "course") + "' was not approved." + (remarks != null && !remarks.isBlank() ? " Reason: " + remarks : ""))
                            .readStatus(false)
                            .build());
                }
            }
        }

        return requestRepository.save(req);
    }
}
