package com.zoroacademy.service;

import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.Notification;
import com.zoroacademy.entity.TrainerCourseRequest;
import com.zoroacademy.entity.User;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.TrainerCourseRequestRepository;
import com.zoroacademy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TrainerCourseRequestService {

    private final TrainerCourseRequestRepository requestRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.BatchRepository batchRepository;

    public TrainerCourseRequestService(TrainerCourseRequestRepository requestRepository,
                                       CourseRepository courseRepository,
                                       UserRepository userRepository,
                                       NotificationService notificationService,
                                       ActivityLogService activityLogService) {
        this.requestRepository = requestRepository;
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<TrainerCourseRequest> getAllRequests() {
        return requestRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<TrainerCourseRequest> getRequestsByTrainer(String trainerIdOrEmail) {
        List<TrainerCourseRequest> list = requestRepository.findByTrainerId(trainerIdOrEmail);
        if (list.isEmpty()) {
            list = requestRepository.findByTrainerEmailIgnoreCase(trainerIdOrEmail);
        }
        return list;
    }

    @Transactional
    public TrainerCourseRequest createRequest(TrainerCourseRequest req) {
        String effectiveTrainerId = req.getTrainerId();
        String effectiveEmail = req.getTrainerEmail();
        String trainerName = req.getTrainerName();

        if (effectiveTrainerId != null && effectiveTrainerId.contains("@")) {
            effectiveEmail = effectiveTrainerId;
            Optional<User> uOpt = userRepository.findByEmailIgnoreCase(effectiveEmail);
            if (uOpt.isPresent()) {
                effectiveTrainerId = uOpt.get().getId();
                trainerName = uOpt.get().getName();
            }
        } else if (effectiveEmail != null && (effectiveTrainerId == null || effectiveTrainerId.isBlank())) {
            Optional<User> uOpt = userRepository.findByEmailIgnoreCase(effectiveEmail);
            if (uOpt.isPresent()) {
                effectiveTrainerId = uOpt.get().getId();
                trainerName = uOpt.get().getName();
            }
        } else if (effectiveTrainerId != null) {
            Optional<User> uOpt = userRepository.findById(effectiveTrainerId);
            if (uOpt.isPresent()) {
                effectiveEmail = uOpt.get().getEmail();
                if (trainerName == null || trainerName.isBlank()) {
                    trainerName = uOpt.get().getName();
                }
            }
        }

        if (effectiveTrainerId == null || effectiveTrainerId.isBlank()) {
            throw new IllegalArgumentException("Trainer ID or email is required");
        }

        Course course = courseRepository.findById(req.getCourseId())
                .or(() -> courseRepository.findByTitleIgnoreCase(req.getCourseTitle()))
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + req.getCourseId()));

        // Check if approved request exists
        Optional<TrainerCourseRequest> approved = requestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(
                effectiveTrainerId, course.getId(), "Approved");
        if (approved.isPresent()) {
            throw new ConflictException("You already have approved access to this course");
        }

        // Check if pending request exists
        Optional<TrainerCourseRequest> pending = requestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(
                effectiveTrainerId, course.getId(), "Pending");
        if (pending.isPresent()) {
            throw new ConflictException("Your request for this course is already pending approval");
        }

        // Check if rejected request exists -> allow requesting again
        Optional<TrainerCourseRequest> rejected = requestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(
                effectiveTrainerId, course.getId(), "Rejected");
        if (rejected.isPresent()) {
            TrainerCourseRequest reqToUpdate = rejected.get();
            reqToUpdate.setStatus("Pending");
            reqToUpdate.setRequestDate(LocalDate.now().toString());
            reqToUpdate = requestRepository.save(reqToUpdate);
            activityLogService.logAction(effectiveTrainerId, trainerName, "TRAINER_COURSE_REQUEST",
                    "Trainer requested access again to course: " + course.getTitle(), "System");
            return reqToUpdate;
        }

        TrainerCourseRequest newReq = TrainerCourseRequest.builder()
                .id("tcr_" + UUID.randomUUID())
                .trainerId(effectiveTrainerId)
                .trainerName(trainerName != null ? trainerName : "Trainer")
                .trainerEmail(effectiveEmail != null ? effectiveEmail : "")
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .status("Pending")
                .requestDate(LocalDate.now().toString())
                .build();

        newReq = requestRepository.save(newReq);

        activityLogService.logAction(effectiveTrainerId, trainerName, "TRAINER_COURSE_REQUEST",
                "Trainer requested access to course: " + course.getTitle(), "System");

        return newReq;
    }

    @Transactional
    public TrainerCourseRequest updateStatus(String requestId, String status) {
        TrainerCourseRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Trainer course request not found: " + requestId));

        req.setStatus(status);

        if ("Approved".equalsIgnoreCase(status)) {
            courseRepository.findById(req.getCourseId()).ifPresent(course -> {
                course.setTrainerId(req.getTrainerId());
                course.setAssignedTrainer(req.getTrainerName());
                courseRepository.save(course);
            });

            notificationService.createNotification(Notification.builder()
                    .id("notif_" + UUID.randomUUID())
                    .recipientId(req.getTrainerId())
                    .recipientRole("TRAINER")
                    .title("Course Access Approved")
                    .message("Your request to lead course '" + req.getCourseTitle() + "' has been approved by the Admin.")
                    .readStatus(false)
                    .build());

            activityLogService.logAction("ADMIN", "Admin", "TRAINER_COURSE_APPROVED",
                    "Approved trainer " + req.getTrainerName() + " for course " + req.getCourseTitle(), "System");
        } else if ("Rejected".equalsIgnoreCase(status)) {
            // Revoke access, clear any trainer fields that this approval had set
            courseRepository.findById(req.getCourseId()).ifPresent(course -> {
                if (req.getTrainerId() != null && req.getTrainerId().equals(course.getTrainerId())) {
                    course.setTrainerId(null);
                    course.setAssignedTrainer(null);
                    course.setAssignedTrainerId(null);
                    courseRepository.save(course);
                }
            });

            notificationService.createNotification(Notification.builder()
                    .id("notif_" + UUID.randomUUID())
                    .recipientId(req.getTrainerId())
                    .recipientRole("TRAINER")
                    .title("Course Access Rejected")
                    .message("Your request to lead course '" + req.getCourseTitle() + "' was not approved.")
                    .readStatus(false)
                    .build());

            activityLogService.logAction("ADMIN", "Admin", "TRAINER_COURSE_REJECTED",
                    "Rejected trainer " + req.getTrainerName() + " for course " + req.getCourseTitle(), "System");
        }

        return requestRepository.save(req);
    }

    @Transactional
    public void deleteRequest(String requestId) {
        requestRepository.deleteById(requestId);
    }

    @Transactional(readOnly = true)
    public java.util.List<java.util.Map<String, Object>> getTrainerCourseAccessList() {
        java.util.List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        java.util.List<TrainerCourseRequest> approvedReqs = requestRepository.findByStatusIgnoreCase("Approved");

        java.util.Set<String> seenKeys = new java.util.HashSet<>();

        for (TrainerCourseRequest req : approvedReqs) {
            String key = req.getTrainerId() + "_" + req.getCourseId();
            seenKeys.add(key);

            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", req.getId());
            item.put("trainerId", req.getTrainerId());
            item.put("trainerName", req.getTrainerName());
            item.put("trainerEmail", req.getTrainerEmail());

            userRepository.findById(req.getTrainerId()).ifPresent(u -> {
                item.put("trainerPhone", u.getPhone());
                item.put("trainerSpecialty", u.getSpecialty());
            });

            item.put("courseId", req.getCourseId());
            item.put("courseTitle", req.getCourseTitle());

            courseRepository.findById(req.getCourseId()).ifPresent(c -> {
                item.put("courseMode", c.getMode());
                item.put("courseCategory", c.getCategory());
                item.put("courseAudience", c.getAudience());
            });

            item.put("status", "Approved");
            item.put("requestDate", req.getRequestDate());
            result.add(item);
        }

        // Also check if any courses have assigned trainer directly without a TCR
        java.util.List<Course> allCourses = courseRepository.findAll();
        for (Course c : allCourses) {
            String tid = c.getTrainerId() != null ? c.getTrainerId() : c.getAssignedTrainerId();
            if (tid != null && !tid.isBlank()) {
                String key = tid + "_" + c.getId();
                if (!seenKeys.contains(key)) {
                    seenKeys.add(key);
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", "direct_" + key);
                    item.put("trainerId", tid);
                    item.put("trainerName", c.getAssignedTrainer());
                    userRepository.findById(tid).ifPresent(u -> {
                        item.put("trainerName", u.getName());
                        item.put("trainerEmail", u.getEmail());
                        item.put("trainerPhone", u.getPhone());
                        item.put("trainerSpecialty", u.getSpecialty());
                    });
                    item.put("courseId", c.getId());
                    item.put("courseTitle", c.getTitle());
                    item.put("courseMode", c.getMode());
                    item.put("courseCategory", c.getCategory());
                    item.put("courseAudience", c.getAudience());
                    item.put("status", "Approved");
                    item.put("requestDate", c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate().toString() : LocalDate.now().toString());
                    result.add(item);
                }
            }
        }

        return result;
    }

    @Transactional
    public void revokeAccess(String trainerId, String courseId) {
        if (trainerId == null || courseId == null) {
            throw new IllegalArgumentException("trainerId and courseId are required");
        }

        String trainerName = "Trainer";
        Optional<User> uOpt = userRepository.findById(trainerId);
        if (uOpt.isPresent()) {
            trainerName = uOpt.get().getName();
        }

        Course course = courseRepository.findById(courseId).orElse(null);
        String courseTitle = course != null ? course.getTitle() : courseId;

        // Revoke any requests
        java.util.List<TrainerCourseRequest> requests = requestRepository.findByTrainerId(trainerId).stream()
                .filter(r -> courseId.equalsIgnoreCase(r.getCourseId()))
                .toList();

        for (TrainerCourseRequest req : requests) {
            req.setStatus("Revoked");
            requestRepository.save(req);
        }

        // Clear direct assignments on course
        if (course != null) {
            boolean changed = false;
            if (trainerId.equalsIgnoreCase(course.getTrainerId())) {
                course.setTrainerId(null);
                changed = true;
            }
            if (trainerId.equalsIgnoreCase(course.getAssignedTrainerId())) {
                course.setAssignedTrainerId(null);
                changed = true;
            }
            if (trainerName.equalsIgnoreCase(course.getAssignedTrainer())) {
                course.setAssignedTrainer(null);
                changed = true;
            }
            if (changed) {
                courseRepository.save(course);
            }
        }

        // Clear batches
        if (batchRepository != null) {
            java.util.List<com.zoroacademy.entity.Batch> batches = batchRepository.findByCourseId(courseId);
            for (com.zoroacademy.entity.Batch b : batches) {
                boolean bChanged = false;
                if (b.getTrainerIds() != null && b.getTrainerIds().remove(trainerId)) {
                    bChanged = true;
                }
                if (trainerId.equalsIgnoreCase(b.getTrainerId())) {
                    b.setTrainerId(null);
                    b.setTrainerName(null);
                    bChanged = true;
                }
                if (bChanged) {
                    batchRepository.save(b);
                }
            }
        }

        // Audit log
        activityLogService.logAction("ADMIN", "Admin", "TRAINER_COURSE_ACCESS_REVOKED",
                "Revoked access for trainer " + trainerName + " from course: " + courseTitle, "System");

        // Notification
        notificationService.createNotification(Notification.builder()
                .id("notif_" + UUID.randomUUID())
                .recipientId(trainerId)
                .recipientRole("TRAINER")
                .title("Course Access Revoked")
                .message("Your access to course '" + courseTitle + "' has been revoked by the administrator.")
                .readStatus(false)
                .build());
    }

    @Transactional(readOnly = true)
    public boolean isTrainerAuthorizedForCourse(String trainerId, String trainerEmail, String courseId) {
        if (courseId == null) return false;

        if (trainerId != null && !trainerId.isBlank()) {
            boolean approved = requestRepository.findByTrainerIdAndCourseIdAndStatusIgnoreCase(trainerId, courseId, "Approved").isPresent();
            if (approved) return true;
        }

        if (trainerEmail != null && !trainerEmail.isBlank()) {
            boolean approved = requestRepository.findByTrainerEmailIgnoreCase(trainerEmail).stream()
                    .anyMatch(r -> courseId.equalsIgnoreCase(r.getCourseId()) && "Approved".equalsIgnoreCase(r.getStatus()));
            if (approved) return true;
        }

        Course course = courseRepository.findById(courseId).orElse(null);
        if (course != null) {
            if (trainerId != null && (trainerId.equalsIgnoreCase(course.getTrainerId()) || trainerId.equalsIgnoreCase(course.getAssignedTrainerId()))) {
                return true;
            }
        }

        if (batchRepository != null && trainerId != null) {
            java.util.List<com.zoroacademy.entity.Batch> batches = batchRepository.findByCourseId(courseId);
            for (com.zoroacademy.entity.Batch b : batches) {
                if (trainerId.equalsIgnoreCase(b.getTrainerId()) || (b.getTrainerIds() != null && b.getTrainerIds().contains(trainerId))) {
                    return true;
                }
            }
        }

        return false;
    }
}
