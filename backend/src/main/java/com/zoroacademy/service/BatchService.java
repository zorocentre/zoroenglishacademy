package com.zoroacademy.service;

import com.zoroacademy.entity.*;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class BatchService {

    private final BatchRepository batchRepository;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final StudentFeeRepository studentFeeRepository;
    private final ScheduleRepository scheduleRepository;
    private final AssignmentRepository assignmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ActivityLogService activityLogService;

    private void logActivity(String module, String action, String details) {
        if (activityLogService != null) {
            try {
                activityLogService.logAction("ADMIN", "Admin", module, action, details, "System");
            } catch (Exception ignored) {}
        }
    }

    public BatchService(BatchRepository batchRepository,
                        CourseRepository courseRepository,
                        UserRepository userRepository,
                        EnrollmentRepository enrollmentRepository,
                        StudentCourseBatchRepository studentCourseBatchRepository,
                        StudentFeeRepository studentFeeRepository,
                        ScheduleRepository scheduleRepository,
                        AssignmentRepository assignmentRepository) {
        this.batchRepository = batchRepository;
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.studentFeeRepository = studentFeeRepository;
        this.scheduleRepository = scheduleRepository;
        this.assignmentRepository = assignmentRepository;
    }

    @Transactional(readOnly = true)
    public List<Batch> getAllBatches() {
        List<Batch> batches = batchRepository.findAll();
        batches.forEach(this::enrichBatch);
        return batches;
    }

    @Transactional(readOnly = true)
    public List<Batch> getBatchesByCourse(String courseIdOrName) {
        if (courseIdOrName == null || courseIdOrName.isBlank()) {
            return getAllBatches();
        }
        List<Batch> byId = batchRepository.findByCourseId(courseIdOrName);
        if (!byId.isEmpty()) {
            byId.forEach(this::enrichBatch);
            return byId;
        }
        List<Batch> byName = batchRepository.findByCourseNameIgnoreCase(courseIdOrName);
        byName.forEach(this::enrichBatch);
        return byName;
    }

    @Transactional(readOnly = true)
    public List<Batch> getBatchesByTrainer(String trainerIdOrName) {
        if (trainerIdOrName == null || trainerIdOrName.isBlank()) {
            return getAllBatches();
        }
        List<Batch> list = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(trainerIdOrName, trainerIdOrName);
        list.forEach(this::enrichBatch);
        return list;
    }

    @Transactional(readOnly = true)
    public Batch getBatchById(String id) {
        Batch b = batchRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + id));
        enrichBatch(b);
        return b;
    }

    private void enrichBatch(Batch batch) {
        if (batch == null) return;
        List<java.util.Map<String, String>> trainerList = new java.util.ArrayList<>();
        if (batch.getTrainerIds() != null && !batch.getTrainerIds().isEmpty()) {
            for (String tId : batch.getTrainerIds()) {
                userRepository.findById(tId).ifPresent(u -> {
                    java.util.Map<String, String> map = new java.util.HashMap<>();
                    map.put("id", u.getId());
                    map.put("name", u.getName());
                    trainerList.add(map);
                });
            }
        } else if (batch.getTrainerId() != null && !batch.getTrainerId().isBlank()) {
            java.util.Map<String, String> map = new java.util.HashMap<>();
            map.put("id", batch.getTrainerId());
            map.put("name", batch.getTrainerName() != null ? batch.getTrainerName() : "Trainer");
            trainerList.add(map);
        }
        batch.setTrainers(trainerList);
    }

    @Transactional(readOnly = true)
    public List<com.zoroacademy.dto.UserDto> getStudentsInBatch(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return List.of();
        }
        List<User> students = userRepository.findStudentsByBatchId(batchId);
        return students.stream()
                .map(this::convertUserToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getStudentCountInBatch(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return 0L;
        }
        return userRepository.countStudentsByBatchId(batchId);
    }

    private com.zoroacademy.dto.UserDto convertUserToDto(User user) {
        if (user == null) return null;
        com.zoroacademy.dto.UserDto dto = com.zoroacademy.dto.UserDto.fromEntity(user);
        List<StudentCourseBatch> scbs = studentCourseBatchRepository.findByStudentId(user.getId());
        if (scbs != null && !scbs.isEmpty()) {
            List<java.util.Map<String, Object>> list = scbs.stream().map(scb -> {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("course", scb.getCourseName());
                map.put("courseId", scb.getCourseId());
                map.put("batch", scb.getBatchName());
                map.put("batchId", scb.getBatchId());
                return map;
            }).collect(java.util.stream.Collectors.toList());
            dto.setCourseBatches(list);

            String readable = list.stream()
                    .map(m -> m.get("course") + " (" + m.get("batch") + ")")
                    .collect(java.util.stream.Collectors.joining(", "));
            dto.setCourse(readable);
        }
        return dto;
    }

    private void validateCourseForBatch(Course course, String identifier) {
        if (course == null) {
            throw new BadRequestException("Course not found: " + (identifier != null ? identifier : "unspecified"));
        }
        String status = course.getStatus() != null ? course.getStatus().trim() : "";
        if (!"Active".equalsIgnoreCase(status) && !"Published".equalsIgnoreCase(status)) {
            throw new BadRequestException("Batches can only be created for Published courses. Current course status: " + course.getStatus());
        }
        String audience = course.getAudience() != null ? course.getAudience().trim().toLowerCase() : "";
        if (!audience.isEmpty() && !"student".equals(audience)) {
            throw new BadRequestException("Batches can only be created for Student courses. Trainer courses cannot have batches.");
        }
        String mode = course.getMode() != null ? course.getMode().trim() : "";
        if (!"Online".equalsIgnoreCase(mode) && !"Hybrid".equalsIgnoreCase(mode)) {
            throw new BadRequestException("Batches cannot be created for Recorded courses. Batches are only supported for Online and Hybrid courses.");
        }
    }

    @Transactional
    public Batch createBatch(Batch batch) {
        if (batch.getId() == null || batch.getId().isBlank()) {
            batch.setId("btc_" + UUID.randomUUID());
        }

        // Resolve Course
        Course course = null;
        if (batch.getCourseId() != null && !batch.getCourseId().isBlank()) {
            course = courseRepository.findById(batch.getCourseId()).orElse(null);
            if (course != null) batch.setCourseName(course.getTitle());
        } else if (batch.getCourseName() != null && !batch.getCourseName().isBlank()) {
            course = courseRepository.findByTitleIgnoreCase(batch.getCourseName()).orElse(null);
            if (course != null) batch.setCourseId(course.getId());
        }

        validateCourseForBatch(course, batch.getCourseId() != null ? batch.getCourseId() : batch.getCourseName());

        // Resolve Trainers (Multi-Trainer Support)
        if (batch.getTrainerIds() != null && !batch.getTrainerIds().isEmpty()) {
            java.util.Set<String> validIds = new java.util.LinkedHashSet<>();
            java.util.List<String> names = new java.util.ArrayList<>();
            for (String tid : batch.getTrainerIds()) {
                userRepository.findById(tid).ifPresent(u -> {
                    validIds.add(u.getId());
                    names.add(u.getName());
                });
            }
            batch.setTrainerIds(validIds);
            if (!validIds.isEmpty()) {
                batch.setTrainerId(validIds.iterator().next());
                batch.setTrainerName(String.join(", ", names));
            } else {
                batch.setTrainerId(null);
                batch.setTrainerName(null);
            }
        } else if (batch.getTrainerId() != null && !batch.getTrainerId().isBlank()) {
            userRepository.findById(batch.getTrainerId()).ifPresent(u -> {
                batch.setTrainerName(u.getName());
                batch.getTrainerIds().add(u.getId());
            });
        } else if (batch.getTrainerName() != null && !batch.getTrainerName().isBlank()) {
            userRepository.findByNameIgnoreCase(batch.getTrainerName()).stream()
                    .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                    .findFirst()
                    .ifPresent(u -> {
                        batch.setTrainerId(u.getId());
                        batch.getTrainerIds().add(u.getId());
                    });
        }

        Batch saved = batchRepository.save(batch);
        enrichBatch(saved);
        logActivity("BATCHES", "BATCH_CREATED", "Created batch: " + saved.getName() + " for course " + saved.getCourseName());
        return saved;
    }

    @Transactional
    public Batch updateBatch(String id, Batch updated) {
        final Batch targetBatch = getBatchById(id);
        String oldName = targetBatch.getName();

        if (updated.getName() != null) targetBatch.setName(updated.getName());
        if (updated.getStatus() != null) targetBatch.setStatus(updated.getStatus());

        // Update Course
        Course course = null;
        if (updated.getCourseId() != null && !updated.getCourseId().isBlank()) {
            targetBatch.setCourseId(updated.getCourseId());
            course = courseRepository.findById(updated.getCourseId()).orElse(null);
            if (course != null) targetBatch.setCourseName(course.getTitle());
        } else if (updated.getCourseName() != null && !updated.getCourseName().isBlank()) {
            targetBatch.setCourseName(updated.getCourseName());
            course = courseRepository.findByTitleIgnoreCase(updated.getCourseName()).orElse(null);
            if (course != null) targetBatch.setCourseId(course.getId());
        } else if (targetBatch.getCourseId() != null && !targetBatch.getCourseId().isBlank()) {
            course = courseRepository.findById(targetBatch.getCourseId()).orElse(null);
        }

        if (course != null) {
            validateCourseForBatch(course, targetBatch.getCourseId() != null ? targetBatch.getCourseId() : targetBatch.getCourseName());
        }

        // Update Trainers (Multi-Trainer Support)
        if (updated.getTrainerIds() != null) {
            java.util.Set<String> validIds = new java.util.LinkedHashSet<>();
            java.util.List<String> names = new java.util.ArrayList<>();
            for (String tid : updated.getTrainerIds()) {
                userRepository.findById(tid).ifPresent(u -> {
                    validIds.add(u.getId());
                    names.add(u.getName());
                });
            }
            targetBatch.setTrainerIds(validIds);
            if (!validIds.isEmpty()) {
                targetBatch.setTrainerId(validIds.iterator().next());
                targetBatch.setTrainerName(String.join(", ", names));
            } else {
                targetBatch.setTrainerId(null);
                targetBatch.setTrainerName(null);
            }
        } else if (updated.getTrainerId() != null && !updated.getTrainerId().isBlank()) {
            targetBatch.setTrainerId(updated.getTrainerId());
            userRepository.findById(updated.getTrainerId()).ifPresent(u -> {
                targetBatch.setTrainerName(u.getName());
                java.util.Set<String> set = new java.util.LinkedHashSet<>();
                set.add(u.getId());
                targetBatch.setTrainerIds(set);
            });
        } else if (updated.getTrainerName() != null) {
            targetBatch.setTrainerName(updated.getTrainerName());
            userRepository.findByNameIgnoreCase(updated.getTrainerName()).stream()
                    .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                    .findFirst()
                    .ifPresent(u -> {
                        targetBatch.setTrainerId(u.getId());
                        java.util.Set<String> set = new java.util.LinkedHashSet<>();
                        set.add(u.getId());
                        targetBatch.setTrainerIds(set);
                    });
        }

        Batch savedBatch = batchRepository.save(targetBatch);
        enrichBatch(savedBatch);

        // Propagate renamed batch name to related records
        if (updated.getName() != null && !updated.getName().equalsIgnoreCase(oldName)) {
            String newName = updated.getName();
            String bId = savedBatch.getId();

            for (Enrollment e : enrollmentRepository.findByBatchId(bId)) {
                e.setBatchName(newName);
                enrollmentRepository.save(e);
            }
            for (StudentCourseBatch scb : studentCourseBatchRepository.findByBatchId(bId)) {
                scb.setBatchName(newName);
                studentCourseBatchRepository.save(scb);
            }
            for (StudentFee f : studentFeeRepository.findByBatchId(bId)) {
                f.setBatch(newName);
                studentFeeRepository.save(f);
            }
            for (Schedule s : scheduleRepository.findByBatchId(bId)) {
                s.setBatch(newName);
                scheduleRepository.save(s);
            }
            for (Assignment a : assignmentRepository.findByBatchId(bId)) {
                a.setBatch(newName);
                assignmentRepository.save(a);
            }
        }

        logActivity("BATCHES", "BATCH_UPDATED", "Updated batch: " + savedBatch.getName());
        return savedBatch;
    }

    @Transactional
    public void deleteBatch(String id) {
        List<StudentCourseBatch> assignedStudents = studentCourseBatchRepository.findByBatchId(id);
        if (!assignedStudents.isEmpty()) {
            throw new ConflictException("Cannot delete batch with " + assignedStudents.size() + " active student assignments");
        }
        List<Enrollment> enrollments = enrollmentRepository.findByBatchId(id).stream()
                .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                .toList();
        if (!enrollments.isEmpty()) {
            throw new ConflictException("Cannot delete batch with " + enrollments.size() + " active enrollments");
        }
        batchRepository.deleteById(id);
        logActivity("BATCHES", "BATCH_DELETED", "Deleted batch ID " + id);
    }
}
