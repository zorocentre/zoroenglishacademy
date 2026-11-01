package com.zoroacademy.service;

import com.zoroacademy.entity.Doubt;
import com.zoroacademy.repository.DoubtRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class DoubtService {

    private final DoubtRepository doubtRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;
    private final com.zoroacademy.repository.CourseRepository courseRepository;
    private final com.zoroacademy.repository.BatchRepository batchRepository;
    private final com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired
    public DoubtService(DoubtRepository doubtRepository,
                        com.zoroacademy.repository.UserRepository userRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.CourseRepository courseRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.BatchRepository batchRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) NotificationService notificationService,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) ActivityLogService activityLogService) {
        this.doubtRepository = doubtRepository;
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    public DoubtService(DoubtRepository doubtRepository,
                        com.zoroacademy.repository.UserRepository userRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.CourseRepository courseRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.BatchRepository batchRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                        @org.springframework.beans.factory.annotation.Autowired(required = false) NotificationService notificationService) {
        this(doubtRepository, userRepository, courseRepository, batchRepository, studentCourseBatchRepository, notificationService, null);
    }

    public DoubtService(DoubtRepository doubtRepository, com.zoroacademy.repository.UserRepository userRepository) {
        this(doubtRepository, userRepository, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<Doubt> getAllDoubts() {
        return doubtRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Doubt> getDoubtsByTrainer(String trainerIdOrName) {
        return getDoubtsByTrainer(trainerIdOrName, trainerIdOrName);
    }

    @Transactional(readOnly = true)
    public List<Doubt> getDoubtsByTrainer(String trainerId, String trainerName) {
        if (trainerName != null && !trainerName.isBlank()) {
            return doubtRepository.findByTrainerIdOrTrainerNameIgnoreCase(trainerId, trainerName);
        }
        return doubtRepository.findByTrainerIdOrTrainerNameIgnoreCase(trainerId, trainerId);
    }

    @Transactional(readOnly = true)
    public List<Doubt> getDoubtsByStudent(String studentId, String studentEmail) {
        List<Doubt> list = doubtRepository.findByStudentId(studentId);
        if (list.isEmpty() && studentEmail != null && !studentEmail.isBlank()) {
            list = doubtRepository.findByStudentId(studentEmail);
        }
        return list;
    }

    @Transactional
    public Doubt createDoubt(Doubt doubt) {
        if (doubt.getId() == null || doubt.getId().isBlank()) {
            doubt.setId("dbt_" + java.util.UUID.randomUUID());
        }
        if (doubt.getStatus() == null || doubt.getStatus().isBlank()) {
            doubt.setStatus("Pending");
        }

        // Relational student resolution
        String resolvedStudentId = doubt.getStudentId();
        if (doubt.getStudentId() != null && doubt.getStudentId().contains("@")) {
            com.zoroacademy.entity.User u = userRepository.findByEmailIgnoreCase(doubt.getStudentId()).orElse(null);
            if (u != null) {
                resolvedStudentId = u.getId();
                doubt.setStudentId(u.getId());
                if (doubt.getStudentName() == null) doubt.setStudentName(u.getName());
            }
        } else if (doubt.getStudentId() != null && !doubt.getStudentId().isBlank()) {
            userRepository.findById(doubt.getStudentId()).ifPresent(u -> {
                if (doubt.getStudentName() == null) doubt.setStudentName(u.getName());
            });
        }

        // Relational course resolution
        com.zoroacademy.entity.Course course = null;
        if (doubt.getCourseId() != null && !doubt.getCourseId().isBlank()) {
            if (courseRepository != null) course = courseRepository.findById(doubt.getCourseId()).orElse(null);
        } else if (doubt.getCourseTitle() != null && !doubt.getCourseTitle().isBlank()) {
            if (courseRepository != null) {
                course = courseRepository.findByTitleIgnoreCase(doubt.getCourseTitle()).orElse(null);
            }
        }
        if (course == null) {
            throw new IllegalArgumentException("Course not found for doubt submission");
        }
        doubt.setCourseId(course.getId());
        doubt.setCourseTitle(course.getTitle());
        String mode = course.getMode() != null ? course.getMode() : "Online";
        doubt.setCourseMode(mode);

        if ("Recorded".equalsIgnoreCase(mode)) {
            // Recorded course rules:
            // Auto-fill course trainer; if course has no trainer, routes to Admin only
            String courseTrainerId = course.getTrainerId() != null ? course.getTrainerId() : course.getAssignedTrainerId();
            if (courseTrainerId != null && !courseTrainerId.isBlank()) {
                if (doubt.getTrainerId() != null && !doubt.getTrainerId().isBlank() && !doubt.getTrainerId().equals(courseTrainerId)) {
                    throw new IllegalArgumentException("Selected trainer does not match the recorded course's assigned trainer");
                }
                doubt.setTrainerId(courseTrainerId);
                doubt.setTrainerName(course.getAssignedTrainer());
            } else {
                doubt.setTrainerId(null);
                doubt.setTrainerName("Admin");
            }
        } else {
            // Online or Hybrid course rules:
            // Student must belong to a batch, and must choose one of the batch's trainers
            String bId = doubt.getBatchId();
            if ((bId == null || bId.isBlank()) && resolvedStudentId != null && studentCourseBatchRepository != null) {
                bId = studentCourseBatchRepository.findByStudentIdAndCourseId(resolvedStudentId, course.getId())
                        .map(com.zoroacademy.entity.StudentCourseBatch::getBatchId)
                        .orElse(null);
                doubt.setBatchId(bId);
            }
            if (bId == null || bId.isBlank()) {
                throw new IllegalArgumentException("Student is not assigned to any batch for course: " + course.getTitle());
            }

            com.zoroacademy.entity.Batch batch = batchRepository != null ? batchRepository.findById(bId).orElse(null) : null;
            if (batch == null) {
                throw new IllegalArgumentException("Batch not found: " + bId);
            }

            if (doubt.getTrainerId() == null || doubt.getTrainerId().isBlank()) {
                if (doubt.getTrainerName() != null && !doubt.getTrainerName().isBlank() && userRepository != null) {
                    userRepository.findByNameIgnoreCase(doubt.getTrainerName()).stream()
                            .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                            .findFirst()
                            .ifPresent(u -> doubt.setTrainerId(u.getId()));
                }
            }

            if (doubt.getTrainerId() == null || doubt.getTrainerId().isBlank()) {
                throw new IllegalArgumentException("A batch trainer must be selected for online/hybrid course doubts");
            }

            boolean isBatchTrainer = false;
            if (batch.getTrainerIds() != null && batch.getTrainerIds().contains(doubt.getTrainerId())) {
                isBatchTrainer = true;
            } else if (doubt.getTrainerId().equals(batch.getTrainerId())) {
                isBatchTrainer = true;
            }
            if (!isBatchTrainer) {
                throw new IllegalArgumentException("Selected trainer is not assigned to student's batch");
            }

            if (userRepository != null) {
                userRepository.findById(doubt.getTrainerId()).ifPresent(u -> doubt.setTrainerName(u.getName()));
            }
        }

        Doubt saved = doubtRepository.save(doubt);

        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getStudentId(),
                saved.getStudentName(),
                "DOUBTS",
                "CREATE_DOUBT",
                "Student submitted doubt: " + (saved.getQuestion() != null ? (saved.getQuestion().length() > 60 ? saved.getQuestion().substring(0, 60) + "..." : saved.getQuestion()) : "Doubt") + " for course " + saved.getCourseTitle(),
                null
            );
        }

        // Notifications on creation
        if (notificationService != null) {
            // 1. Notify Admin
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + java.util.UUID.randomUUID())
                    .recipientRole("ADMIN")
                    .title("New Doubt Submitted")
                    .message("Student " + (saved.getStudentName() != null ? saved.getStudentName() : "A student") +
                            " submitted a doubt for '" + (saved.getCourseTitle() != null ? saved.getCourseTitle() : "a course") + "'.")
                    .readStatus(false)
                    .build());

            // 2. Notify Trainer if assigned
            if (saved.getTrainerId() != null && !saved.getTrainerId().isBlank()) {
                notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                        .id("notif_" + java.util.UUID.randomUUID())
                        .recipientId(saved.getTrainerId())
                        .recipientRole("TRAINER")
                        .title("New Doubt Assigned")
                        .message("Student " + (saved.getStudentName() != null ? saved.getStudentName() : "A student") +
                                " asked a doubt in '" + (saved.getCourseTitle() != null ? saved.getCourseTitle() : "your course") + "'.")
                        .readStatus(false)
                        .build());
            }
        }

        return saved;
    }

    @Transactional
    public Doubt replyToDoubt(String id, String reply, String trainerName) {
        Doubt doubt = doubtRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Doubt not found: " + id));

        doubt.setReply(reply);
        if (trainerName != null) doubt.setTrainerName(trainerName);
        doubt.setReplyDate(LocalDate.now().toString());
        doubt.setStatus("Resolved");
        Doubt saved = doubtRepository.save(doubt);

        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getTrainerId() != null ? saved.getTrainerId() : "TRAINER",
                saved.getTrainerName() != null ? saved.getTrainerName() : "Trainer",
                "DOUBTS",
                "REPLY_DOUBT",
                "Replied to doubt: " + (saved.getQuestion() != null ? (saved.getQuestion().length() > 60 ? saved.getQuestion().substring(0, 60) + "..." : saved.getQuestion()) : saved.getId()) + " by " + (saved.getTrainerName() != null ? saved.getTrainerName() : "Trainer"),
                null
            );
        }

        if (saved.getStudentId() != null && !saved.getStudentId().isBlank() && notificationService != null) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + java.util.UUID.randomUUID())
                    .recipientId(saved.getStudentId())
                    .recipientRole("STUDENT")
                    .title("Doubt Answered")
                    .message("Your doubt regarding '" + (saved.getCourseTitle() != null ? saved.getCourseTitle() : "your course") + "' has been answered.")
                    .readStatus(false)
                    .build());
        }

        return saved;
    }

    @Transactional
    public void deleteDoubt(String id) {
        doubtRepository.findById(id).ifPresent(d -> {
            doubtRepository.delete(d);
            if (activityLogService != null) {
                activityLogService.logAction(
                    null,
                    null,
                    "DOUBTS",
                    "DELETE_DOUBT",
                    "Deleted doubt: " + (d.getQuestion() != null ? (d.getQuestion().length() > 60 ? d.getQuestion().substring(0, 60) + "..." : d.getQuestion()) : d.getId()),
                    null
                );
            }
        });
    }
}
