package com.zoroacademy.service;

import com.zoroacademy.entity.Schedule;
import com.zoroacademy.entity.User;
import com.zoroacademy.repository.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final com.zoroacademy.repository.CourseRepository courseRepository;
    private final com.zoroacademy.repository.BatchRepository batchRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository;
    private final com.zoroacademy.repository.AttendanceRecordRepository attendanceRecordRepository;
    private final com.zoroacademy.repository.TrainerAttendanceRecordRepository trainerAttendanceRecordRepository;
    private final com.zoroacademy.repository.EnrollmentRepository enrollmentRepository;
    private final NotificationService notificationService;
    private final com.zoroacademy.repository.TrainerCourseRequestRepository trainerCourseRequestRepository;

    @org.springframework.beans.factory.annotation.Value("${schedule.resources-unlock-minutes:30}")
    private int resourcesUnlockMinutes = 30;

    public int getResourcesUnlockMinutes() {
        return resourcesUnlockMinutes;
    }

    public void setResourcesUnlockMinutes(int resourcesUnlockMinutes) {
        this.resourcesUnlockMinutes = resourcesUnlockMinutes;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ScheduleService(ScheduleRepository scheduleRepository,
                           com.zoroacademy.repository.CourseRepository courseRepository,
                           com.zoroacademy.repository.BatchRepository batchRepository,
                           com.zoroacademy.repository.UserRepository userRepository,
                           FileStorageService fileStorageService,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StudentCourseBatchRepository studentCourseBatchRepository,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.AttendanceRecordRepository attendanceRecordRepository,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.TrainerAttendanceRecordRepository trainerAttendanceRecordRepository,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.EnrollmentRepository enrollmentRepository,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) NotificationService notificationService,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.TrainerCourseRequestRepository trainerCourseRequestRepository) {
        this.scheduleRepository = scheduleRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.trainerAttendanceRecordRepository = trainerAttendanceRecordRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.notificationService = notificationService;
        this.trainerCourseRequestRepository = trainerCourseRequestRepository;
    }

    public ScheduleService(ScheduleRepository scheduleRepository,
                           com.zoroacademy.repository.CourseRepository courseRepository,
                           com.zoroacademy.repository.BatchRepository batchRepository,
                           com.zoroacademy.repository.UserRepository userRepository) {
        this(scheduleRepository, courseRepository, batchRepository, userRepository, null, null, null, null, null, null, null);
    }

    private void enrichSchedule(Schedule s) {
        if (s == null) return;
        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
        s.setServerNow(now.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        java.time.ZonedDateTime start = com.zoroacademy.util.ScheduleTimeUtil.getSessionStart(s.getDate(), s.getTime());
        java.time.ZonedDateTime end = com.zoroacademy.util.ScheduleTimeUtil.getSessionEnd(s.getDate(), s.getTime());
        if (start != null && end != null) {
            if (now.isBefore(start)) {
                s.setStatus("Upcoming");
            } else if (!now.isAfter(end)) {
                s.setStatus("Live");
            } else {
                s.setStatus("Completed");
            }
        }
    }

    @Transactional(readOnly = true)
    public List<Schedule> getAllSchedules() {
        List<Schedule> list = scheduleRepository.findAllByOrderByDateAsc();
        list.forEach(this::enrichSchedule);
        return list;
    }

    @Transactional(readOnly = true)
    public List<Schedule> getTrainerSchedules(String trainerIdOrName) {
        List<Schedule> list = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(trainerIdOrName, trainerIdOrName);
        list.forEach(this::enrichSchedule);
        return list;
    }

    public void validateAndNormalizeSchedule(Schedule schedule, String currentScheduleId) {
        if (schedule.getDate() == null || schedule.getDate().isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Schedule date is required");
        }

        java.time.LocalDate sDate;
        try {
            sDate = java.time.LocalDate.parse(schedule.getDate().trim());
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid schedule date: " + schedule.getDate());
        }

        java.time.LocalDate todayKolkata = java.time.LocalDate.now(com.zoroacademy.util.ScheduleTimeUtil.KOLKATA_ZONE);
        if (sDate.isBefore(todayKolkata)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Schedule date cannot be in the past (" + schedule.getDate() + ")");
        }

        java.time.LocalTime st = null;
        java.time.LocalTime et = null;

        if (schedule.getStartTime() != null && !schedule.getStartTime().isBlank()
                && schedule.getEndTime() != null && !schedule.getEndTime().isBlank()) {
            try {
                st = java.time.LocalTime.parse(schedule.getStartTime().trim());
                et = java.time.LocalTime.parse(schedule.getEndTime().trim());
            } catch (Exception e) {
                int sMin = com.zoroacademy.util.ScheduleTimeUtil.parseTimeToMinutes(schedule.getStartTime());
                int eMin = com.zoroacademy.util.ScheduleTimeUtil.parseEndTimeToMinutes(" - " + schedule.getEndTime());
                st = java.time.LocalTime.of(sMin / 60, sMin % 60);
                et = java.time.LocalTime.of(eMin / 60, eMin % 60);
            }
        } else if (schedule.getTime() != null && !schedule.getTime().isBlank()) {
            int sMin = com.zoroacademy.util.ScheduleTimeUtil.parseTimeToMinutes(schedule.getTime());
            int eMin = com.zoroacademy.util.ScheduleTimeUtil.parseEndTimeToMinutes(schedule.getTime());
            st = java.time.LocalTime.of(sMin / 60, sMin % 60);
            et = java.time.LocalTime.of(eMin / 60, eMin % 60);
        } else {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Start time and end time are required");
        }

        if (!et.isAfter(st)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "End time (" + et + ") must be after start time (" + st + ")");
        }

        long durationMinutes = java.time.Duration.between(st, et).toMinutes();
        if (durationMinutes < 15) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Session duration must be at least 15 minutes");
        }
        if (durationMinutes > 240) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Session duration cannot exceed 4 hours (240 minutes)");
        }

        java.time.format.DateTimeFormatter dtf24 = java.time.format.DateTimeFormatter.ofPattern("HH:mm");
        java.time.format.DateTimeFormatter dtf12 = java.time.format.DateTimeFormatter.ofPattern("hh:mm a", java.util.Locale.ENGLISH);

        schedule.setStartTime(st.format(dtf24));
        schedule.setEndTime(et.format(dtf24));
        schedule.setTime(st.format(dtf12) + " - " + et.format(dtf12));
        schedule.setStartAt(sDate.atTime(st));
        schedule.setEndAt(sDate.atTime(et));

        // Overlap validation for same date:
        List<Schedule> sameDate = scheduleRepository.findByDate(schedule.getDate().trim());
        for (Schedule existing : sameDate) {
            if (currentScheduleId != null && currentScheduleId.equals(existing.getId())) {
                continue;
            }
            if (schedule.getId() != null && schedule.getId().equals(existing.getId())) {
                continue;
            }

            boolean batchMatch = (schedule.getBatchId() != null && !schedule.getBatchId().isBlank() && !"All".equalsIgnoreCase(schedule.getBatchId()) && schedule.getBatchId().equals(existing.getBatchId()))
                    || (schedule.getBatch() != null && !schedule.getBatch().isBlank() && !"All".equalsIgnoreCase(schedule.getBatch()) && schedule.getBatch().equalsIgnoreCase(existing.getBatch()));

            boolean trainerMatch = (schedule.getTrainerId() != null && !schedule.getTrainerId().isBlank() && schedule.getTrainerId().equals(existing.getTrainerId()))
                    || (schedule.getTrainer() != null && !schedule.getTrainer().isBlank() && schedule.getTrainer().equalsIgnoreCase(existing.getTrainer()));

            boolean courseMatch = "TRAINER".equalsIgnoreCase(schedule.getAudience())
                    && ((schedule.getCourseId() != null && !schedule.getCourseId().isBlank() && schedule.getCourseId().equals(existing.getCourseId()))
                        || (schedule.getCourse() != null && !schedule.getCourse().isBlank() && schedule.getCourse().equalsIgnoreCase(existing.getCourse())));

            if (batchMatch || trainerMatch || courseMatch) {
                java.time.LocalTime exSt = null;
                java.time.LocalTime exEt = null;
                if (existing.getStartTime() != null && existing.getEndTime() != null) {
                    try {
                        exSt = java.time.LocalTime.parse(existing.getStartTime().trim());
                        exEt = java.time.LocalTime.parse(existing.getEndTime().trim());
                    } catch (Exception ignored) {}
                }
                if (exSt == null || exEt == null) {
                    int esMin = com.zoroacademy.util.ScheduleTimeUtil.parseTimeToMinutes(existing.getTime());
                    int eeMin = com.zoroacademy.util.ScheduleTimeUtil.parseEndTimeToMinutes(existing.getTime());
                    exSt = java.time.LocalTime.of(esMin / 60, esMin % 60);
                    exEt = java.time.LocalTime.of(eeMin / 60, eeMin % 60);
                }

                if (st.isBefore(exEt) && et.isAfter(exSt)) {
                    if (batchMatch) {
                        throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.CONFLICT,
                            "Schedule overlaps with existing session '" + existing.getTitle() + "' (" + existing.getTime() + ") for batch '" + (existing.getBatch() != null ? existing.getBatch() : schedule.getBatch()) + "'");
                    } else if (trainerMatch) {
                        throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.CONFLICT,
                            "Schedule overlaps with existing session '" + existing.getTitle() + "' (" + existing.getTime() + ") for trainer '" + (existing.getTrainer() != null ? existing.getTrainer() : schedule.getTrainer()) + "'");
                    } else {
                        throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.CONFLICT,
                            "Schedule overlaps with existing session '" + existing.getTitle() + "' (" + existing.getTime() + ") for course '" + (existing.getCourse() != null ? existing.getCourse() : schedule.getCourse()) + "'");
                    }
                }
            }
        }
    }

    @Transactional
    public Schedule createSchedule(Schedule schedule) {
        if (schedule.getId() == null || schedule.getId().isBlank()) {
            schedule.setId("sch_" + java.util.UUID.randomUUID());
        }
        if (schedule.getStatus() == null || schedule.getStatus().isBlank()) {
            schedule.setStatus("Upcoming");
        }

        // Relational course resolution
        com.zoroacademy.entity.Course resolvedCourse = null;
        if (schedule.getCourseId() != null && !schedule.getCourseId().isBlank()) {
            resolvedCourse = courseRepository.findById(schedule.getCourseId()).orElse(null);
        } else if (schedule.getCourse() != null && !schedule.getCourse().isBlank()) {
            resolvedCourse = courseRepository.findByTitleIgnoreCase(schedule.getCourse()).orElse(null);
        }

        if (resolvedCourse != null) {
            schedule.setCourse(resolvedCourse.getTitle());
            schedule.setCourseId(resolvedCourse.getId());
            if (schedule.getMeetLink() == null || schedule.getMeetLink().isBlank()) {
                schedule.setMeetLink(resolvedCourse.getGoogleMeetUrl());
            }
        }

        boolean isTrainerAudience = (resolvedCourse != null && "trainer".equalsIgnoreCase(resolvedCourse.getAudience()))
                || "TRAINER".equalsIgnoreCase(schedule.getAudience());

        if (isTrainerAudience) {
            schedule.setAudience("TRAINER");
            // Batch and batch trainer are not required for trainer-audience courses
            if ((schedule.getMeetLink() == null || schedule.getMeetLink().isBlank()) && resolvedCourse != null) {
                schedule.setMeetLink(resolvedCourse.getGoogleMeetUrl());
            }
            if (schedule.getTrainer() == null || schedule.getTrainer().isBlank()) {
                schedule.setTrainer("Admin");
            }
        } else {
            schedule.setAudience("STUDENT");
            // Relational batch resolution
            if (schedule.getBatchId() != null && !schedule.getBatchId().isBlank()) {
                batchRepository.findById(schedule.getBatchId()).ifPresent(b -> schedule.setBatch(b.getName()));
            } else if (schedule.getBatch() != null && !schedule.getBatch().isBlank()) {
                batchRepository.findByNameIgnoreCaseAndCourseId(schedule.getBatch(), schedule.getCourseId())
                        .or(() -> batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(schedule.getBatch(), schedule.getCourse()))
                        .ifPresent(b -> schedule.setBatchId(b.getId()));
            }

            // Relational trainer resolution
            if (schedule.getTrainerId() != null && !schedule.getTrainerId().isBlank()) {
                userRepository.findById(schedule.getTrainerId()).ifPresent(u -> schedule.setTrainer(u.getName()));
            } else if (schedule.getTrainer() != null && !schedule.getTrainer().isBlank()) {
                userRepository.findByNameIgnoreCase(schedule.getTrainer()).stream()
                        .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                        .findFirst()
                        .ifPresent(u -> schedule.setTrainerId(u.getId()));
            }

            // Validate that trainer belongs to the batch if batch has assigned trainers
            if (schedule.getBatchId() != null && !schedule.getBatchId().isBlank() && !"All".equalsIgnoreCase(schedule.getBatchId())) {
                batchRepository.findById(schedule.getBatchId()).ifPresent(b -> {
                    if (b.getTrainerIds() != null && !b.getTrainerIds().isEmpty()) {
                        boolean found = false;
                        for (String bTid : b.getTrainerIds()) {
                            if ((schedule.getTrainerId() != null && schedule.getTrainerId().equals(bTid)) ||
                                (schedule.getTrainer() != null && schedule.getTrainer().equalsIgnoreCase(
                                    userRepository.findById(bTid).map(User::getName).orElse("")))) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            throw new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.BAD_REQUEST, 
                                "Selected trainer is not assigned to batch '" + b.getName() + "'. Please choose an assigned batch trainer.");
                        }
                    }
                });
            }
        }

        validateAndNormalizeSchedule(schedule, null);
        enrichSchedule(schedule);

        Schedule saved = scheduleRepository.save(schedule);

        if (isTrainerAudience && notificationService != null) {
            notifyEnrolledTrainers(saved);
        } else if (notificationService != null) {
            notifyBatchStudents(saved, false);
        }

        return saved;
    }

    @Transactional
    public Schedule updateSchedule(String id, Schedule updated) {
        Schedule existing = scheduleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + id));

        String prevDate = existing.getDate();
        String prevTime = existing.getTime();

        if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
        if (updated.getCourse() != null) existing.setCourse(updated.getCourse());
        if (updated.getCourseId() != null) existing.setCourseId(updated.getCourseId());
        if (updated.getBatch() != null) existing.setBatch(updated.getBatch());
        if (updated.getBatchId() != null) existing.setBatchId(updated.getBatchId());
        if (updated.getTrainer() != null) existing.setTrainer(updated.getTrainer());
        if (updated.getTrainerId() != null) existing.setTrainerId(updated.getTrainerId());
        if (updated.getStartTime() != null) existing.setStartTime(updated.getStartTime());
        if (updated.getEndTime() != null) existing.setEndTime(updated.getEndTime());
        if (updated.getTime() != null) existing.setTime(updated.getTime());
        if (updated.getDate() != null) existing.setDate(updated.getDate());
        if (updated.getMeetLink() != null) existing.setMeetLink(updated.getMeetLink());
        if (updated.getStudentsCount() != null) existing.setStudentsCount(updated.getStudentsCount());
        if (updated.getStatus() != null) existing.setStatus(updated.getStatus());
        if (updated.getNotesFileUrl() != null) {
            if (existing.getNotesFileUrl() != null && !existing.getNotesFileUrl().equals(updated.getNotesFileUrl())) {
                cleanupStoredFilesFromText(existing.getNotesFileUrl());
            }
            existing.setNotesFileUrl(updated.getNotesFileUrl().isBlank() ? null : updated.getNotesFileUrl());
            existing.setNotesFileName(updated.getNotesFileName());
        }
        if (updated.getWorksheetFileUrl() != null) {
            if (existing.getWorksheetFileUrl() != null && !existing.getWorksheetFileUrl().equals(updated.getWorksheetFileUrl())) {
                cleanupStoredFilesFromText(existing.getWorksheetFileUrl());
            }
            existing.setWorksheetFileUrl(updated.getWorksheetFileUrl().isBlank() ? null : updated.getWorksheetFileUrl());
            existing.setWorksheetFileName(updated.getWorksheetFileName());
        }
        if (updated.getAssignmentFileUrl() != null) {
            if (existing.getAssignmentFileUrl() != null && !existing.getAssignmentFileUrl().equals(updated.getAssignmentFileUrl())) {
                cleanupStoredFilesFromText(existing.getAssignmentFileUrl());
            }
            existing.setAssignmentFileUrl(updated.getAssignmentFileUrl().isBlank() ? null : updated.getAssignmentFileUrl());
            existing.setAssignmentFileName(updated.getAssignmentFileName());
        }

        // Relational course resolution
        if (updated.getCourseId() != null && !updated.getCourseId().isBlank()) {
            courseRepository.findById(updated.getCourseId()).ifPresent(c -> {
                existing.setCourse(c.getTitle());
                existing.setCourseId(c.getId());
                if (c.getAudience() != null) {
                    existing.setAudience("trainer".equalsIgnoreCase(c.getAudience()) ? "TRAINER" : "STUDENT");
                }
            });
        }

        boolean isTrainerAudience = "TRAINER".equalsIgnoreCase(existing.getAudience())
                || (existing.getCourseId() != null && courseRepository.findById(existing.getCourseId()).map(c -> "trainer".equalsIgnoreCase(c.getAudience())).orElse(false));

        if (!isTrainerAudience) {
            // Relational batch resolution
            if (existing.getBatchId() != null && !existing.getBatchId().isBlank()) {
                batchRepository.findById(existing.getBatchId()).ifPresent(b -> existing.setBatch(b.getName()));
            } else if (existing.getBatch() != null && !existing.getBatch().isBlank()) {
                batchRepository.findByNameIgnoreCaseAndCourseId(existing.getBatch(), existing.getCourseId())
                        .or(() -> batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(existing.getBatch(), existing.getCourse()))
                        .ifPresent(b -> existing.setBatchId(b.getId()));
            }

            // Relational trainer resolution
            if (existing.getTrainerId() != null && !existing.getTrainerId().isBlank()) {
                userRepository.findById(existing.getTrainerId()).ifPresent(u -> existing.setTrainer(u.getName()));
            } else if (existing.getTrainer() != null && !existing.getTrainer().isBlank()) {
                userRepository.findByNameIgnoreCase(existing.getTrainer()).stream()
                        .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                        .findFirst()
                        .ifPresent(u -> existing.setTrainerId(u.getId()));
            }

            // Validate that trainer belongs to the batch if batch has assigned trainers
            if (existing.getBatchId() != null && !existing.getBatchId().isBlank() && !"All".equalsIgnoreCase(existing.getBatchId())) {
                batchRepository.findById(existing.getBatchId()).ifPresent(b -> {
                    if (b.getTrainerIds() != null && !b.getTrainerIds().isEmpty()) {
                        boolean found = false;
                        for (String bTid : b.getTrainerIds()) {
                            if ((existing.getTrainerId() != null && existing.getTrainerId().equals(bTid)) ||
                                (existing.getTrainer() != null && existing.getTrainer().equalsIgnoreCase(
                                    userRepository.findById(bTid).map(User::getName).orElse("")))) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            throw new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.BAD_REQUEST, 
                                "Selected trainer is not assigned to batch '" + b.getName() + "'. Please choose an assigned batch trainer.");
                        }
                    }
                });
            }
        }

        validateAndNormalizeSchedule(existing, id);
        enrichSchedule(existing);

        Schedule saved = scheduleRepository.save(existing);
        boolean isRescheduled = (prevDate != null && !prevDate.equals(saved.getDate()))
                || (prevTime != null && !prevTime.equals(saved.getTime()));
        if (isRescheduled && notificationService != null) {
            notifyBatchStudents(saved, true);
        }

        return saved;
    }

    private void notifyBatchStudents(Schedule schedule, boolean isReschedule) {
        if (notificationService == null) return;
        java.util.Set<String> recipientStudentIds = new java.util.HashSet<>();

        if (schedule.getBatchId() != null && studentCourseBatchRepository != null) {
            studentCourseBatchRepository.findByBatchId(schedule.getBatchId()).forEach(scb -> {
                if (scb.getStudentId() != null && !scb.getStudentId().isBlank()) {
                    recipientStudentIds.add(scb.getStudentId());
                }
            });
        }
        if (recipientStudentIds.isEmpty() && schedule.getCourseId() != null && enrollmentRepository != null) {
            enrollmentRepository.findByCourseId(schedule.getCourseId()).stream()
                .filter(e -> "Active".equalsIgnoreCase(e.getStatus()) || e.getStatus() == null)
                .forEach(e -> {
                    if (e.getStudentId() != null && !e.getStudentId().isBlank()) {
                        recipientStudentIds.add(e.getStudentId());
                    }
                });
        }

        String action = isReschedule ? "Rescheduled" : "Scheduled";
        String title = "Session " + action + ": " + schedule.getTitle();
        String message = "Your live session for " + schedule.getCourse() + " (" + (schedule.getBatch() != null ? schedule.getBatch() : "Batch")
                + ") is " + action.toLowerCase() + " for " + schedule.getDate() + " at " + schedule.getTime() + ".";

        for (String sId : recipientStudentIds) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                .id("notif_" + java.util.UUID.randomUUID())
                .recipientId(sId)
                .recipientRole("STUDENT")
                .title(title)
                .message(message)
                .readStatus(false)
                .build());
        }
    }

    private void notifyEnrolledTrainers(Schedule schedule) {
        if (notificationService == null) return;
        java.util.Set<String> recipientTrainerIds = new java.util.HashSet<>();

        if (schedule.getTrainerId() != null && !schedule.getTrainerId().isBlank()) {
            recipientTrainerIds.add(schedule.getTrainerId());
        } else if (schedule.getCourseId() != null && trainerCourseRequestRepository != null) {
            trainerCourseRequestRepository.findByCourseId(schedule.getCourseId()).stream()
                .filter(r -> "Approved".equalsIgnoreCase(r.getStatus()))
                .forEach(r -> {
                    if (r.getTrainerId() != null && !r.getTrainerId().isBlank()) {
                        recipientTrainerIds.add(r.getTrainerId());
                    }
                });
        }

        if (recipientTrainerIds.isEmpty()) {
            return;
        }

        String title = "New Trainer Session Scheduled: " + schedule.getTitle();
        String message = "A new session for course '" + schedule.getCourse() + "' has been scheduled on "
                + schedule.getDate() + " (" + schedule.getTime() + ").";

        for (String tId : recipientTrainerIds) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                .id("notif_" + java.util.UUID.randomUUID())
                .recipientId(tId)
                .recipientRole("TRAINER")
                .title(title)
                .message(message)
                .readStatus(false)
                .build());
        }
    }

    private void cleanupStoredFilesFromText(String text) {
        if (text == null || text.isBlank()) return;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})").matcher(text);
        while (matcher.find()) {
            try {
                fileStorageService.deleteFile(matcher.group(1));
            } catch (Exception ignored) {}
        }
    }

    @Transactional
    public void deleteSchedule(String id) {
        Schedule schedule = scheduleRepository.findById(id).orElse(null);
        if (schedule != null) {
            cleanupStoredFilesFromText(schedule.getNotesFileUrl());
            cleanupStoredFilesFromText(schedule.getWorksheetFileUrl());
            cleanupStoredFilesFromText(schedule.getAssignmentFileUrl());
            scheduleRepository.delete(schedule);
        }
    }

    public boolean isScheduleLockedForStudent(Schedule schedule, String studentId, String studentEmail) {
        if (schedule == null) return false;
        if (schedule.getDate() == null || schedule.getTime() == null) return false;

        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
        java.time.ZonedDateTime sessionStart = com.zoroacademy.util.ScheduleTimeUtil.getSessionStart(schedule.getDate(), schedule.getTime());
        if (sessionStart == null) return false;

        // If session has already started or completed -> UNLOCKED
        if (!now.isBefore(sessionStart)) {
            return false;
        }

        // If within resourcesUnlockMinutes (60 min) before start time -> UNLOCKED
        java.time.ZonedDateTime unlockThreshold = sessionStart.minusMinutes(resourcesUnlockMinutes);
        if (!now.isBefore(unlockThreshold)) {
            return false;
        }

        // More than 60 minutes before start -> LOCKED (no nearest upcoming exception)
        return true;
    }

    @Transactional(readOnly = true)
    public List<Schedule> getSchedulesForStudent(String studentId, String studentEmail) {
        List<Schedule> all = getAllSchedules();
        List<Schedule> result = new java.util.ArrayList<>();
        for (Schedule s : all) {
            Schedule copy = new Schedule(
                    s.getId(), s.getTitle(), s.getCourse(), s.getCourseId(), s.getBatch(), s.getBatchId(),
                    s.getTrainer(), s.getTrainerId(), s.getTime(), s.getDate(), s.getMeetLink(),
                    s.getStudentsCount(), s.getStatus(), s.getNotesFileUrl(), s.getNotesFileName(),
                    s.getWorksheetFileUrl(), s.getWorksheetFileName(), s.getAssignmentFileUrl(),
                    s.getAssignmentFileName(), s.getCreatedAt(), s.getUpdatedAt()
            );
            copy.setStartTime(s.getStartTime());
            copy.setEndTime(s.getEndTime());
            copy.setStartAt(s.getStartAt());
            copy.setEndAt(s.getEndAt());
            copy.setAudience(s.getAudience());
            copy.setServerNow(s.getServerNow());

            boolean isLocked = isScheduleLockedForStudent(s, studentId, studentEmail);
            copy.setLocked(isLocked);
            if (isLocked) {
                copy.setUnlockTimeLabel(com.zoroacademy.util.ScheduleTimeUtil.formatUnlockTime(s.getDate(), s.getTime(), resourcesUnlockMinutes));
                copy.setNotesFileUrl(null);
                copy.setNotesFileName(null);
                copy.setWorksheetFileUrl(null);
                copy.setWorksheetFileName(null);
                copy.setAssignmentFileUrl(null);
                copy.setAssignmentFileName(null);
            }
            result.add(copy);
        }
        return result;
    }

    @Transactional
    public java.util.Map<String, Object> joinSchedule(String scheduleId, String studentId, String studentEmail, String userRole) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + scheduleId));

        boolean isStaff = "ADMIN".equalsIgnoreCase(userRole) || "SUPER_ADMIN".equalsIgnoreCase(userRole) || "TRAINER".equalsIgnoreCase(userRole);

        // 1. Resolve student user
        com.zoroacademy.entity.User student = null;
        if (studentId != null && !studentId.isBlank()) {
            student = userRepository.findById(studentId).orElse(null);
        }
        if (student == null && studentEmail != null && !studentEmail.isBlank()) {
            student = userRepository.findByEmailIgnoreCase(studentEmail).orElse(null);
        }

        if (!isStaff) {
            if (student == null) {
                throw new IllegalArgumentException("Student not found");
            }
            String effectiveStudentId = student.getId();

            // 2. Check enrollment in course/batch
            boolean enrolled = false;
            if (studentCourseBatchRepository != null) {
                java.util.List<com.zoroacademy.entity.StudentCourseBatch> scbs = studentCourseBatchRepository.findByStudentId(effectiveStudentId);
                if (scbs.isEmpty() && student.getEmail() != null) {
                    scbs = studentCourseBatchRepository.findByStudentId(student.getEmail());
                }
                for (com.zoroacademy.entity.StudentCourseBatch scb : scbs) {
                    boolean matchCourse = (schedule.getCourseId() != null && schedule.getCourseId().equals(scb.getCourseId()));
                    boolean matchBatch = (schedule.getBatchId() == null || "All".equalsIgnoreCase(schedule.getBatchId()) || schedule.getBatchId().equals(scb.getBatchId()));
                    if (matchCourse && matchBatch) {
                        enrolled = true;
                        break;
                    }
                }
            } else {
                enrolled = true;
            }

            if (!enrolled) {
                throw new org.springframework.security.access.AccessDeniedException("Student is not enrolled in this session's course/batch");
            }
        }

        // 3. Time check [start, end] strictly using Asia/Kolkata
        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
        java.time.ZonedDateTime start = com.zoroacademy.util.ScheduleTimeUtil.getSessionStart(schedule.getDate(), schedule.getTime());
        java.time.ZonedDateTime end = com.zoroacademy.util.ScheduleTimeUtil.getSessionEnd(schedule.getDate(), schedule.getTime());

        if (start != null && now.isBefore(start)) {
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("hh:mm a");
            throw new org.springframework.security.access.AccessDeniedException("Session has not started yet. Starts at " + start.format(fmt));
        }
        if (end != null && now.isAfter(end)) {
            throw new org.springframework.security.access.AccessDeniedException("Session has already ended");
        }

        // 4. Meeting link resolution
        String meetUrl = schedule.getMeetLink();
        if (meetUrl == null || meetUrl.isBlank() || meetUrl.contains("meet.google.com/new") || meetUrl.contains("zoro-live-class") || meetUrl.contains("abc-defg-hij")) {
            if (schedule.getCourseId() != null) {
                com.zoroacademy.entity.Course c = courseRepository.findById(schedule.getCourseId()).orElse(null);
                if (c != null && c.getGoogleMeetUrl() != null && !c.getGoogleMeetUrl().isBlank()) {
                    meetUrl = c.getGoogleMeetUrl();
                }
            }
        }
        if (meetUrl == null || meetUrl.isBlank() || meetUrl.contains("meet.google.com/new") || meetUrl.contains("zoro-live-class") || meetUrl.contains("abc-defg-hij")) {
            throw new com.zoroacademy.exception.BadRequestException("Meeting link not set. Contact admin.");
        }

        // 5. Mark Attendance for student or trainer as PRESENT
        if (!isStaff && student != null && attendanceRecordRepository != null) {
            String sId = student.getId();
            com.zoroacademy.entity.AttendanceRecord att = attendanceRecordRepository.findByStudentIdAndScheduleId(sId, schedule.getId())
                    .orElse(com.zoroacademy.entity.AttendanceRecord.builder()
                            .id("att_" + java.util.UUID.randomUUID())
                            .studentId(sId)
                            .studentName(student.getName())
                            .scheduleId(schedule.getId())
                            .courseId(schedule.getCourseId())
                            .batchId(schedule.getBatchId())
                            .date(schedule.getDate())
                            .recordedBy("STUDENT_JOIN")
                            .build());
            att.setStatus("Present");
            att.setJoinedAt(java.time.LocalDateTime.now());
            attendanceRecordRepository.save(att);
        } else if ("TRAINER".equalsIgnoreCase(userRole) && trainerAttendanceRecordRepository != null) {
            String trId = studentId != null ? studentId : (student != null ? student.getId() : schedule.getTrainerId());
            String trName = student != null ? student.getName() : schedule.getTrainer();
            if (trId != null && !trId.isBlank()) {
                com.zoroacademy.entity.TrainerAttendanceRecord trAtt = trainerAttendanceRecordRepository.findByScheduleIdAndTrainerId(schedule.getId(), trId)
                        .orElse(com.zoroacademy.entity.TrainerAttendanceRecord.builder()
                                .id("tratt_" + java.util.UUID.randomUUID())
                                .scheduleId(schedule.getId())
                                .trainerId(trId)
                                .trainerName(trName != null ? trName : "Trainer")
                                .courseId(schedule.getCourseId())
                                .batchId(schedule.getBatchId())
                                .date(schedule.getDate())
                                .build());
                trAtt.setStatus("Present");
                trAtt.setJoinedAt(java.time.LocalDateTime.now());
                trAtt.setUpdatedAt(java.time.LocalDateTime.now());
                trainerAttendanceRecordRepository.save(trAtt);
            }
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("success", true);
        response.put("meetUrl", meetUrl);
        response.put("scheduleId", schedule.getId());
        response.put("status", "Present");
        response.put("message", "Joined successfully");
        return response;
    }

    @Transactional
    public java.util.Map<String, Object> startSchedule(String scheduleId, String trainerId, String trainerEmail, String userRole) {
        return joinSchedule(scheduleId, trainerId, trainerEmail, userRole != null ? userRole : "TRAINER");
    }

    @Transactional(readOnly = true)
    public List<Schedule> getTrainerAudienceSchedules() {
        List<com.zoroacademy.entity.Course> trainerCourses = courseRepository.findByAudienceIgnoreCase("trainer");
        java.util.Set<String> liveTrainerCourseIds = trainerCourses.stream()
                .filter(c -> c.getMode() != null && ("ONLINE".equalsIgnoreCase(c.getMode()) || "HYBRID".equalsIgnoreCase(c.getMode())))
                .map(com.zoroacademy.entity.Course::getId)
                .collect(java.util.stream.Collectors.toSet());
        java.util.Set<String> liveTrainerCourseTitles = trainerCourses.stream()
                .filter(c -> c.getMode() != null && ("ONLINE".equalsIgnoreCase(c.getMode()) || "HYBRID".equalsIgnoreCase(c.getMode())))
                .map(c -> c.getTitle().toLowerCase(java.util.Locale.ROOT).trim())
                .collect(java.util.stream.Collectors.toSet());

        java.util.Map<String, com.zoroacademy.entity.Course> courseMap = trainerCourses.stream()
                .collect(java.util.stream.Collectors.toMap(com.zoroacademy.entity.Course::getId, c -> c, (a, b) -> a));

        List<Schedule> all = scheduleRepository.findAllByOrderByDateAsc();
        List<Schedule> filtered = new java.util.ArrayList<>();
        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();

        for (Schedule s : all) {
            boolean isTrainerAudience = "TRAINER".equalsIgnoreCase(s.getAudience());
            boolean matchCourseId = s.getCourseId() != null && liveTrainerCourseIds.contains(s.getCourseId());
            boolean matchCourseTitle = s.getCourse() != null && liveTrainerCourseTitles.contains(s.getCourse().toLowerCase(java.util.Locale.ROOT).trim());

            if (!isTrainerAudience && !matchCourseId && !matchCourseTitle) {
                continue;
            }

            // Exclude recorded courses
            if (s.getCourseId() != null) {
                com.zoroacademy.entity.Course c = courseRepository.findById(s.getCourseId()).orElse(null);
                if (c != null && "RECORDED".equalsIgnoreCase(c.getMode())) {
                    continue;
                }
            }

            Schedule copy = new Schedule(
                    s.getId(), s.getTitle(), s.getCourse(), s.getCourseId(), s.getBatch(), s.getBatchId(),
                    s.getTrainer(), s.getTrainerId(), s.getTime(), s.getDate(), s.getMeetLink(),
                    s.getStudentsCount(), s.getStatus(), s.getNotesFileUrl(), s.getNotesFileName(),
                    s.getWorksheetFileUrl(), s.getWorksheetFileName(), s.getAssignmentFileUrl(),
                    s.getAssignmentFileName(), s.getCreatedAt(), s.getUpdatedAt()
            );
            copy.setStartTime(s.getStartTime());
            copy.setEndTime(s.getEndTime());
            copy.setStartAt(s.getStartAt());
            copy.setEndAt(s.getEndAt());
            copy.setAudience("TRAINER");
            copy.setServerNow(now.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));

            // Status: Upcoming / Live now / Completed
            java.time.ZonedDateTime start = com.zoroacademy.util.ScheduleTimeUtil.getSessionStart(s.getDate(), s.getTime());
            java.time.ZonedDateTime end = com.zoroacademy.util.ScheduleTimeUtil.getSessionEnd(s.getDate(), s.getTime());
            if (start != null && end != null) {
                if (now.isBefore(start)) {
                    copy.setStatus("Upcoming");
                } else if (!now.isAfter(end)) {
                    copy.setStatus("Live now");
                } else {
                    copy.setStatus("Completed");
                }
            } else {
                copy.setStatus(s.getStatus() != null ? s.getStatus() : "Upcoming");
            }

            // Enrolled trainers count
            int enrolledCount = 0;
            if (s.getCourseId() != null) {
                if (enrollmentRepository != null) {
                    java.util.List<com.zoroacademy.entity.Enrollment> enrollments = enrollmentRepository.findByCourseId(s.getCourseId());
                    enrolledCount = (int) enrollments.stream().filter(e -> "Active".equalsIgnoreCase(e.getStatus()) || e.getStatus() == null).count();
                }
                if (enrolledCount == 0 && courseMap.containsKey(s.getCourseId())) {
                    com.zoroacademy.entity.Course c = courseMap.get(s.getCourseId());
                    if (c.getEnrolled() != null && c.getEnrolled() > 0) {
                        enrolledCount = c.getEnrolled();
                    }
                }
            }
            copy.setStudentsCount(enrolledCount);

            // Documents unlock 30 minutes before session start
            if (start != null) {
                java.time.ZonedDateTime unlockThreshold = start.minusMinutes(30);
                if (now.isBefore(unlockThreshold)) {
                    copy.setLocked(true);
                    copy.setUnlockTimeLabel(com.zoroacademy.util.ScheduleTimeUtil.formatUnlockTime(s.getDate(), s.getTime(), 30));
                    copy.setNotesFileUrl(null);
                    copy.setNotesFileName(null);
                    copy.setWorksheetFileUrl(null);
                    copy.setWorksheetFileName(null);
                    copy.setAssignmentFileUrl(null);
                    copy.setAssignmentFileName(null);
                } else {
                    copy.setLocked(false);
                    copy.setUnlockTimeLabel(null);
                }
            } else {
                copy.setLocked(false);
            }

            filtered.add(copy);
        }

        // Sort time-slot ascending (date ascending, then start time in minutes ascending)
        filtered.sort((a, b) -> {
            int dComp = (a.getDate() != null ? a.getDate() : "").compareTo(b.getDate() != null ? b.getDate() : "");
            if (dComp != 0) return dComp;
            return Integer.compare(
                    com.zoroacademy.util.ScheduleTimeUtil.parseTimeToMinutes(a.getTime()),
                    com.zoroacademy.util.ScheduleTimeUtil.parseTimeToMinutes(b.getTime())
            );
        });

        return filtered;
    }
}
