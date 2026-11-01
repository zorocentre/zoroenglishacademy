package com.zoroacademy.service;

import com.zoroacademy.entity.AttendanceRecord;
import com.zoroacademy.entity.TrainerAttendanceRecord;
import com.zoroacademy.repository.AttendanceRecordRepository;
import com.zoroacademy.repository.TrainerAttendanceRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;
    private final TrainerAttendanceRecordRepository trainerAttendanceRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;
    private final com.zoroacademy.repository.ScheduleRepository scheduleRepository;
    private final com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository;
    private final com.zoroacademy.repository.CourseRepository courseRepository;
    private final com.zoroacademy.repository.BatchRepository batchRepository;
    private final com.zoroacademy.repository.AttendanceChangeRepository attendanceChangeRepository;

    @org.springframework.beans.factory.annotation.Value("${attendance.correction-window-minutes:60}")
    private int correctionWindowMinutes = 60;

    private java.time.Clock clock = java.time.Clock.system(com.zoroacademy.util.ScheduleTimeUtil.KOLKATA_ZONE);

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ActivityLogService activityLogService;

    private void logActivity(String action, String details, String actor) {
        if (activityLogService != null) {
            try {
                activityLogService.logAction(actor != null ? actor : "TRAINER", actor != null ? actor : "Trainer", "ATTENDANCE", action, details, "System");
            } catch (Exception ignored) {}
        }
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AttendanceService(AttendanceRecordRepository attendanceRepository,
                             TrainerAttendanceRecordRepository trainerAttendanceRepository,
                             com.zoroacademy.repository.UserRepository userRepository,
                             com.zoroacademy.repository.ScheduleRepository scheduleRepository,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.CourseRepository courseRepository,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.BatchRepository batchRepository,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.AttendanceChangeRepository attendanceChangeRepository) {
        this.attendanceRepository = attendanceRepository;
        this.trainerAttendanceRepository = trainerAttendanceRepository;
        this.userRepository = userRepository;
        this.scheduleRepository = scheduleRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.attendanceChangeRepository = attendanceChangeRepository;
    }

    public AttendanceService(AttendanceRecordRepository attendanceRepository,
                             com.zoroacademy.repository.UserRepository userRepository,
                             com.zoroacademy.repository.ScheduleRepository scheduleRepository) {
        this(attendanceRepository, null, userRepository, scheduleRepository, null, null, null, null);
    }

    public void setClock(java.time.Clock clock) {
        this.clock = clock;
    }

    public java.time.Clock getClock() {
        return this.clock;
    }

    public void setCorrectionWindowMinutes(int minutes) {
        this.correctionWindowMinutes = minutes;
    }

    public int getCorrectionWindowMinutes() {
        return this.correctionWindowMinutes;
    }

    public void enrichAttendanceRecord(AttendanceRecord r) {
        if (r == null) return;

        com.zoroacademy.entity.Schedule sch = null;
        if (r.getScheduleId() != null && !r.getScheduleId().isBlank() && scheduleRepository != null) {
            sch = scheduleRepository.findById(r.getScheduleId()).orElse(null);
        }

        // 1. Resolve Course Title (never show raw crs_...)
        String courseTitle = null;
        if (sch != null && sch.getCourse() != null && !sch.getCourse().isBlank()) {
            courseTitle = sch.getCourse();
        } else if (r.getCourseId() != null && !r.getCourseId().isBlank() && courseRepository != null) {
            courseTitle = courseRepository.findById(r.getCourseId())
                    .map(com.zoroacademy.entity.Course::getTitle)
                    .orElse(null);
        }
        if (courseTitle == null || courseTitle.isBlank()) {
            courseTitle = r.getCourse();
        }
        if (courseTitle == null || courseTitle.isBlank()) {
            courseTitle = r.getCourseId();
        }
        r.setCourse(courseTitle != null && !courseTitle.isBlank() ? courseTitle : "General Course");

        // 2. Resolve Topic (must be schedule title)
        if (sch != null && sch.getTitle() != null && !sch.getTitle().isBlank()) {
            r.setTopic(sch.getTitle());
        } else if (r.getTopic() == null || r.getTopic().isBlank() || r.getTopic().contains("Classroom Session") || r.getTopic().contains("Portal Live Class Join")) {
            if (r.getRemarks() != null && !r.getRemarks().isBlank()
                    && !r.getRemarks().contains("STUDENT_JOIN") && !r.getRemarks().contains("SYSTEM_AUTO")
                    && !r.getRemarks().contains("Classroom Session") && !r.getRemarks().contains("Portal Live Class Join")) {
                r.setTopic(r.getRemarks());
            } else {
                r.setTopic(r.getCourse() != null ? r.getCourse() + " Session" : "Live Session");
            }
        }

        // 3. Resolve Trainer (never display internal markers STUDENT_JOIN or SYSTEM_AUTO)
        String trainerName = null;
        if (sch != null && sch.getTrainer() != null && !sch.getTrainer().isBlank()) {
            trainerName = sch.getTrainer();
        } else if (sch != null && sch.getTrainerId() != null && !sch.getTrainerId().isBlank() && userRepository != null) {
            trainerName = userRepository.findById(sch.getTrainerId()).map(com.zoroacademy.entity.User::getName).orElse(null);
        }
        if (trainerName == null && r.getRecordedBy() != null && !r.getRecordedBy().isBlank()
                && !r.getRecordedBy().equalsIgnoreCase("STUDENT_JOIN")
                && !r.getRecordedBy().equalsIgnoreCase("SYSTEM_AUTO")) {
            if (userRepository != null) {
                trainerName = userRepository.findById(r.getRecordedBy()).map(com.zoroacademy.entity.User::getName).orElse(r.getRecordedBy());
            } else {
                trainerName = r.getRecordedBy();
            }
        }
        r.setTrainer(trainerName != null && !trainerName.isBlank() ? trainerName : "Assigned Trainer");

        // 4. Resolve Time (must show start-end time, not "Completed Session")
        if (sch != null && sch.getTime() != null && !sch.getTime().isBlank()) {
            r.setTime(sch.getTime());
        } else if (r.getTime() == null || r.getTime().isBlank() || r.getTime().equals("Completed Session")) {
            if (r.getJoinedAt() != null) {
                r.setTime(r.getJoinedAt().format(java.time.format.DateTimeFormatter.ofPattern("hh:mm a")));
            } else {
                r.setTime("10:00 AM - 11:00 AM");
            }
        }
    }

    public void enrichTrainerAttendanceRecord(TrainerAttendanceRecord r) {
        if (r == null) return;
        com.zoroacademy.entity.Schedule sch = null;
        if (r.getScheduleId() != null && !r.getScheduleId().isBlank() && scheduleRepository != null) {
            sch = scheduleRepository.findById(r.getScheduleId()).orElse(null);
        }

        String courseTitle = null;
        if (sch != null && sch.getCourse() != null && !sch.getCourse().isBlank()) {
            courseTitle = sch.getCourse();
        } else if (r.getCourseId() != null && !r.getCourseId().isBlank() && courseRepository != null) {
            courseTitle = courseRepository.findById(r.getCourseId())
                    .map(com.zoroacademy.entity.Course::getTitle)
                    .orElse(null);
        }
        r.setCourse(courseTitle != null && !courseTitle.isBlank() ? courseTitle : "General Course");

        if (sch != null && sch.getTitle() != null && !sch.getTitle().isBlank()) {
            r.setTopic(sch.getTitle());
        } else {
            r.setTopic("Live Session");
        }

        if (sch != null && sch.getBatch() != null && !sch.getBatch().isBlank()) {
            r.setBatch(sch.getBatch());
        } else {
            r.setBatch("All");
        }

        if (sch != null && sch.getTime() != null && !sch.getTime().isBlank()) {
            r.setTime(sch.getTime());
        } else if (r.getTime() == null || r.getTime().isBlank()) {
            r.setTime("10:00 AM - 11:00 AM");
        }

        if (sch != null && sch.getMeetLink() != null) {
            r.setMeetLink(sch.getMeetLink());
        }
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 60000)
    @Transactional
    public void scheduledSyncAbsent() {
        syncAbsentForFinishedSchedules();
    }

    @Transactional
    public void syncAbsentForFinishedSchedules() {
        syncAbsentForFinishedSchedules(com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata());
    }

    @Transactional
    public void syncAbsentForFinishedSchedules(java.time.ZonedDateTime now) {
        if (scheduleRepository == null) return;
        List<com.zoroacademy.entity.Schedule> schedules = scheduleRepository.findAll();

        for (com.zoroacademy.entity.Schedule s : schedules) {
            // Check if course is Online or Hybrid (never Recorded)
            if (s.getCourseId() != null && courseRepository != null) {
                com.zoroacademy.entity.Course c = courseRepository.findById(s.getCourseId()).orElse(null);
                if (c != null && c.getMode() != null && "Recorded".equalsIgnoreCase(c.getMode().trim())) {
                    continue;
                }
            }

            boolean isFinished = com.zoroacademy.util.ScheduleTimeUtil.isSessionFinished(s.getDate(), s.getTime(), now);
            if (!isFinished) continue;

            // 1. Sync Student Absent records
            if (studentCourseBatchRepository != null && attendanceRepository != null) {
                java.util.List<com.zoroacademy.entity.StudentCourseBatch> scbs = new java.util.ArrayList<>();
                if (s.getBatchId() != null && !s.getBatchId().isBlank() && !"All".equalsIgnoreCase(s.getBatchId())) {
                    scbs.addAll(studentCourseBatchRepository.findByBatchId(s.getBatchId()));
                } else if (s.getCourseId() != null && !s.getCourseId().isBlank()) {
                    scbs.addAll(studentCourseBatchRepository.findByCourseId(s.getCourseId()));
                }

                for (com.zoroacademy.entity.StudentCourseBatch scb : scbs) {
                    String stId = scb.getStudentId();
                    if (stId == null || stId.isBlank()) continue;
                    java.util.Optional<AttendanceRecord> existing = attendanceRepository.findByStudentIdAndScheduleId(stId, s.getId());
                    if (existing.isEmpty()) {
                        String stName = userRepository != null ? userRepository.findById(stId).map(com.zoroacademy.entity.User::getName).orElse("Student") : "Student";
                        AttendanceRecord abs = AttendanceRecord.builder()
                                .id("att_" + java.util.UUID.randomUUID())
                                .studentId(stId)
                                .studentName(stName)
                                .scheduleId(s.getId())
                                .courseId(s.getCourseId())
                                .batchId(s.getBatchId())
                                .date(s.getDate())
                                .status("Absent")
                                .recordedBy("SYSTEM_AUTO")
                                .createdAt(java.time.LocalDateTime.now())
                                .build();
                        attendanceRepository.save(abs);
                    }
                }
            }

            // 2. Sync Trainer Absent records
            if (trainerAttendanceRepository != null) {
                String trId = s.getTrainerId();
                if (trId != null && !trId.isBlank()) {
                    java.util.Optional<TrainerAttendanceRecord> existingTr = trainerAttendanceRepository.findByScheduleIdAndTrainerId(s.getId(), trId);
                    if (existingTr.isEmpty()) {
                        String trName = s.getTrainer();
                        if ((trName == null || trName.isBlank()) && userRepository != null) {
                            trName = userRepository.findById(trId).map(com.zoroacademy.entity.User::getName).orElse("Trainer");
                        }
                        TrainerAttendanceRecord absTr = TrainerAttendanceRecord.builder()
                                .id("tratt_" + java.util.UUID.randomUUID())
                                .scheduleId(s.getId())
                                .trainerId(trId)
                                .trainerName(trName != null ? trName : "Trainer")
                                .courseId(s.getCourseId())
                                .batchId(s.getBatchId())
                                .date(s.getDate())
                                .status("Absent")
                                .createdAt(java.time.LocalDateTime.now())
                                .updatedAt(java.time.LocalDateTime.now())
                                .build();
                        trainerAttendanceRepository.save(absTr);
                    }
                }
            }
        }
    }

    @Transactional
    public List<AttendanceRecord> getAllAttendance() {
        syncAbsentForFinishedSchedules();
        List<AttendanceRecord> list = new java.util.ArrayList<>(attendanceRepository.findAll());
        list.forEach(this::enrichAttendanceRecord);
        return list;
    }

    @Transactional
    public List<TrainerAttendanceRecord> getAllTrainerAttendance() {
        syncAbsentForFinishedSchedules();
        if (trainerAttendanceRepository == null) return List.of();
        List<TrainerAttendanceRecord> list = new java.util.ArrayList<>(trainerAttendanceRepository.findAll());
        list.forEach(this::enrichTrainerAttendanceRecord);
        return list;
    }

    @Transactional
    public List<AttendanceRecord> getBySchedule(String scheduleId) {
        syncAbsentForFinishedSchedules();
        List<AttendanceRecord> list = new java.util.ArrayList<>(attendanceRepository.findByScheduleId(scheduleId));
        list.forEach(this::enrichAttendanceRecord);
        return list;
    }

    @Transactional
    public List<TrainerAttendanceRecord> getTrainerAttendanceBySchedule(String scheduleId) {
        syncAbsentForFinishedSchedules();
        if (trainerAttendanceRepository == null) return List.of();
        List<TrainerAttendanceRecord> list = new java.util.ArrayList<>(trainerAttendanceRepository.findByScheduleId(scheduleId));
        list.forEach(this::enrichTrainerAttendanceRecord);
        return list;
    }

    @Transactional
    public List<AttendanceRecord> getByStudent(String studentIdOrEmail) {
        syncAbsentForFinishedSchedules();
        String effectiveId = studentIdOrEmail;
        if (studentIdOrEmail != null && studentIdOrEmail.contains("@")) {
            effectiveId = userRepository.findByEmailIgnoreCase(studentIdOrEmail)
                    .map(com.zoroacademy.entity.User::getId)
                    .orElse(studentIdOrEmail);
        }
        List<AttendanceRecord> list = new java.util.ArrayList<>(attendanceRepository.findByStudentId(effectiveId));
        list.forEach(this::enrichAttendanceRecord);
        return list;
    }

    @Transactional
    public List<TrainerAttendanceRecord> getTrainerAttendanceByTrainer(String trainerIdOrName) {
        syncAbsentForFinishedSchedules();
        if (trainerAttendanceRepository == null) return List.of();
        String effectiveId = trainerIdOrName;
        if (userRepository != null) {
            effectiveId = userRepository.findByNameIgnoreCase(trainerIdOrName).stream()
                    .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                    .findFirst()
                    .map(com.zoroacademy.entity.User::getId)
                    .orElse(trainerIdOrName);
        }
        List<TrainerAttendanceRecord> list = new java.util.ArrayList<>(trainerAttendanceRepository.findByTrainerId(effectiveId));
        list.forEach(this::enrichTrainerAttendanceRecord);
        return list;
    }

    @Transactional
    public AttendanceRecord updateStudentRemark(String scheduleId, String studentId, String remark, String remarkBy) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("Student ID is required");
        }
        AttendanceRecord att = null;
        if (scheduleId != null && !scheduleId.isBlank()) {
            att = attendanceRepository.findByStudentIdAndScheduleId(studentId, scheduleId).orElse(null);
        }
        if (att == null) {
            com.zoroacademy.entity.Schedule sch = scheduleId != null && scheduleRepository != null ? scheduleRepository.findById(scheduleId).orElse(null) : null;
            String stName = userRepository != null ? userRepository.findById(studentId).map(com.zoroacademy.entity.User::getName).orElse("Student") : "Student";
            java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
            boolean isFinished = sch != null && com.zoroacademy.util.ScheduleTimeUtil.isSessionFinished(sch.getDate(), sch.getTime(), now);

            att = AttendanceRecord.builder()
                    .id("att_" + java.util.UUID.randomUUID())
                    .scheduleId(scheduleId)
                    .studentId(studentId)
                    .studentName(stName)
                    .courseId(sch != null ? sch.getCourseId() : null)
                    .batchId(sch != null ? sch.getBatchId() : null)
                    .date(sch != null ? sch.getDate() : LocalDate.now().toString())
                    .status(isFinished ? "Absent" : "Upcoming")
                    .recordedBy("SYSTEM_AUTO")
                    .createdAt(java.time.LocalDateTime.now())
                    .build();
        }
        att.setRemarks(remark);
        att.setRemarkBy(remarkBy != null ? remarkBy : "Admin");
        att.setRemarkAt(java.time.LocalDateTime.now());
        AttendanceRecord saved = attendanceRepository.save(att);
        enrichAttendanceRecord(saved);
        logActivity("ATTENDANCE_REMARK_UPDATED", "Updated remark for student " + studentId + " on schedule " + scheduleId + ": " + remark, remarkBy);
        return saved;
    }

    @Transactional
    public TrainerAttendanceRecord updateTrainerRemark(String scheduleId, String trainerId, String remark, String remarkBy) {
        if (trainerId == null || trainerId.isBlank()) {
            throw new IllegalArgumentException("Trainer ID is required");
        }
        if (trainerAttendanceRepository == null) {
            throw new IllegalStateException("Trainer attendance repository is not configured");
        }
        TrainerAttendanceRecord tratt = null;
        if (scheduleId != null && !scheduleId.isBlank()) {
            tratt = trainerAttendanceRepository.findByScheduleIdAndTrainerId(scheduleId, trainerId).orElse(null);
        }
        if (tratt == null) {
            com.zoroacademy.entity.Schedule sch = scheduleId != null && scheduleRepository != null ? scheduleRepository.findById(scheduleId).orElse(null) : null;
            String trName = sch != null ? sch.getTrainer() : null;
            if (trName == null && userRepository != null) {
                trName = userRepository.findById(trainerId).map(com.zoroacademy.entity.User::getName).orElse("Trainer");
            }
            java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
            boolean isFinished = sch != null && com.zoroacademy.util.ScheduleTimeUtil.isSessionFinished(sch.getDate(), sch.getTime(), now);

            tratt = TrainerAttendanceRecord.builder()
                    .id("tratt_" + java.util.UUID.randomUUID())
                    .scheduleId(scheduleId)
                    .trainerId(trainerId)
                    .trainerName(trName != null ? trName : "Trainer")
                    .courseId(sch != null ? sch.getCourseId() : null)
                    .batchId(sch != null ? sch.getBatchId() : null)
                    .date(sch != null ? sch.getDate() : LocalDate.now().toString())
                    .status(isFinished ? "Absent" : "Upcoming")
                    .createdAt(java.time.LocalDateTime.now())
                    .updatedAt(java.time.LocalDateTime.now())
                    .build();
        }
        tratt.setRemarks(remark);
        tratt.setRemarkBy(remarkBy != null ? remarkBy : "Admin");
        tratt.setRemarkAt(java.time.LocalDateTime.now());
        tratt.setUpdatedAt(java.time.LocalDateTime.now());
        TrainerAttendanceRecord saved = trainerAttendanceRepository.save(tratt);
        enrichTrainerAttendanceRecord(saved);
        logActivity("ATTENDANCE_REMARK_UPDATED", "Updated trainer remark for trainer " + trainerId + " on schedule " + scheduleId + ": " + remark, remarkBy);
        return saved;
    }

    @Transactional
    public TrainerAttendanceRecord recordTrainerJoinOrStart(String scheduleId, String trainerId, String trainerName) {
        if (scheduleId == null || scheduleId.isBlank()) {
            throw new IllegalArgumentException("Schedule ID is required");
        }
        if (scheduleRepository == null || trainerAttendanceRepository == null) {
            throw new IllegalStateException("Repositories not configured");
        }
        com.zoroacademy.entity.Schedule s = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + scheduleId));

        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
        java.time.ZonedDateTime start = com.zoroacademy.util.ScheduleTimeUtil.getSessionStart(s.getDate(), s.getTime());
        java.time.ZonedDateTime end = com.zoroacademy.util.ScheduleTimeUtil.getSessionEnd(s.getDate(), s.getTime());

        if (start != null && now.isBefore(start)) {
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("hh:mm a");
            throw new com.zoroacademy.exception.BadRequestException("Session has not started yet. Window opens at " + start.format(fmt));
        }
        if (end != null && now.isAfter(end)) {
            throw new com.zoroacademy.exception.BadRequestException("Session has already ended");
        }

        String effectiveTrainerName = trainerName;
        if ((effectiveTrainerName == null || effectiveTrainerName.isBlank()) && userRepository != null) {
            effectiveTrainerName = userRepository.findById(trainerId).map(com.zoroacademy.entity.User::getName).orElse(s.getTrainer());
        }

        TrainerAttendanceRecord record = trainerAttendanceRepository.findByScheduleIdAndTrainerId(scheduleId, trainerId)
                .orElse(TrainerAttendanceRecord.builder()
                        .id("tratt_" + java.util.UUID.randomUUID())
                        .scheduleId(scheduleId)
                        .trainerId(trainerId)
                        .trainerName(effectiveTrainerName != null ? effectiveTrainerName : "Trainer")
                        .courseId(s.getCourseId())
                        .batchId(s.getBatchId())
                        .date(s.getDate())
                        .createdAt(java.time.LocalDateTime.now())
                        .build());

        record.setStatus("Present");
        record.setJoinedAt(java.time.LocalDateTime.now());
        record.setUpdatedAt(java.time.LocalDateTime.now());
        TrainerAttendanceRecord saved = trainerAttendanceRepository.save(record);
        enrichTrainerAttendanceRecord(saved);
        logActivity("TRAINER_JOINED_SESSION", "Trainer " + trainerName + " started/joined session " + scheduleId, trainerName);
        return saved;
    }

    @Transactional
    public AttendanceRecord correctStudentAttendance(String scheduleId, String studentId, String newStatus, String remark, String changedBy) {
        if (scheduleId == null || scheduleId.isBlank()) {
            throw new com.zoroacademy.exception.BadRequestException("Schedule ID is required");
        }
        if (studentId == null || studentId.isBlank()) {
            throw new com.zoroacademy.exception.BadRequestException("Student ID is required");
        }
        if (newStatus == null || (!newStatus.equalsIgnoreCase("Present") && !newStatus.equalsIgnoreCase("Absent"))) {
            throw new com.zoroacademy.exception.BadRequestException("Status must be either 'Present' or 'Absent'");
        }
        if (remark == null || remark.trim().isBlank()) {
            throw new com.zoroacademy.exception.BadRequestException("Remark is mandatory when correcting attendance status");
        }
        if (scheduleRepository == null) {
            throw new IllegalStateException("Schedule repository is not configured");
        }

        com.zoroacademy.entity.Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new com.zoroacademy.exception.BadRequestException("Schedule not found: " + scheduleId));

        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(this.clock.withZone(com.zoroacademy.util.ScheduleTimeUtil.KOLKATA_ZONE));
        java.time.ZonedDateTime end = com.zoroacademy.util.ScheduleTimeUtil.getSessionEnd(schedule.getDate(), schedule.getTime());

        if (end == null) {
            throw new com.zoroacademy.exception.BadRequestException("Unable to determine session end time for schedule: " + scheduleId);
        }

        if (now.isBefore(end)) {
            throw new com.zoroacademy.exception.BadRequestException("Correction window opens only after the session has ended");
        }

        java.time.ZonedDateTime windowEnd = end.plusMinutes(this.correctionWindowMinutes);
        if (now.isAfter(windowEnd)) {
            throw new com.zoroacademy.exception.BadRequestException("Correction window of " + this.correctionWindowMinutes + " minutes has expired");
        }

        String normalizedStatus = newStatus.substring(0, 1).toUpperCase() + newStatus.substring(1).toLowerCase();
        java.time.LocalDateTime nowLocal = java.time.LocalDateTime.now(this.clock.withZone(com.zoroacademy.util.ScheduleTimeUtil.KOLKATA_ZONE));

        AttendanceRecord record = attendanceRepository.findByStudentIdAndScheduleId(studentId, scheduleId).orElse(null);
        String originalStatus;

        if (record != null) {
            originalStatus = record.getOriginalStatus() != null ? record.getOriginalStatus() : record.getStatus();
            if (record.getOriginalStatus() == null) {
                record.setOriginalStatus(record.getStatus());
            }
            record.setStatus(normalizedStatus);
            record.setRemarks(remark.trim());
            record.setRemarkBy(changedBy != null ? changedBy : "Trainer");
            record.setRemarkAt(nowLocal);
            record.setStatusChangedBy(changedBy != null ? changedBy : "Trainer");
            record.setStatusChangedAt(nowLocal);
        } else {
            originalStatus = "Absent";
            String stName = userRepository != null
                    ? userRepository.findById(studentId).map(com.zoroacademy.entity.User::getName).orElse("Student")
                    : "Student";

            record = AttendanceRecord.builder()
                    .id("att_" + java.util.UUID.randomUUID())
                    .scheduleId(schedule.getId())
                    .studentId(studentId)
                    .studentName(stName)
                    .courseId(schedule.getCourseId())
                    .batchId(schedule.getBatchId())
                    .date(schedule.getDate())
                    .status(normalizedStatus)
                    .originalStatus("Absent")
                    .remarks(remark.trim())
                    .remarkBy(changedBy != null ? changedBy : "Trainer")
                    .remarkAt(nowLocal)
                    .statusChangedBy(changedBy != null ? changedBy : "Trainer")
                    .statusChangedAt(nowLocal)
                    .recordedBy("TRAINER_CORRECTION")
                    .createdAt(nowLocal)
                    .build();
        }

        AttendanceRecord saved = attendanceRepository.save(record);

        if (attendanceChangeRepository != null) {
            com.zoroacademy.entity.AttendanceChange change = com.zoroacademy.entity.AttendanceChange.builder()
                    .id("attchg_" + java.util.UUID.randomUUID())
                    .attendanceId(saved.getId())
                    .scheduleId(scheduleId)
                    .studentId(studentId)
                    .originalStatus(originalStatus)
                    .newStatus(normalizedStatus)
                    .changedBy(changedBy != null ? changedBy : "Trainer")
                    .changedAt(nowLocal)
                    .remark(remark.trim())
                    .build();
            attendanceChangeRepository.save(change);
        }

        enrichAttendanceRecord(saved);
        logActivity("ATTENDANCE_CORRECTED", "Attendance corrected for student " + studentId + " on schedule " + scheduleId + " to " + normalizedStatus + " (Remark: " + remark + ")", changedBy);
        return saved;
    }
}
