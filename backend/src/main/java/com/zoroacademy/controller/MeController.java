package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.dto.UserDto;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final BatchRepository batchRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final ScheduleRepository scheduleRepository;
    private final TrainerCourseRequestRepository trainerCourseRequestRepository;
    private final UserService userService;
    private final StudentFeeRepository studentFeeRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final NotificationRepository notificationRepository;
    private final EnquiryRepository enquiryRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private CompetitionRepository competitionRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private CompetitionSetRepository competitionSetRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.service.AssignmentService assignmentService;

    @org.springframework.beans.factory.annotation.Autowired
    public MeController(UserRepository userRepository,
                        CourseRepository courseRepository,
                        BatchRepository batchRepository,
                        EnrollmentRepository enrollmentRepository,
                        StudentCourseBatchRepository studentCourseBatchRepository,
                        AssignmentRepository assignmentRepository,
                        AssignmentSubmissionRepository assignmentSubmissionRepository,
                        ScheduleRepository scheduleRepository,
                        TrainerCourseRequestRepository trainerCourseRequestRepository,
                        UserService userService,
                        StudentFeeRepository studentFeeRepository,
                        AttendanceRecordRepository attendanceRecordRepository,
                        NotificationRepository notificationRepository,
                        EnquiryRepository enquiryRepository,
                        CompetitionRegistrationRepository competitionRegistrationRepository) {
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.assignmentRepository = assignmentRepository;
        this.assignmentSubmissionRepository = assignmentSubmissionRepository;
        this.scheduleRepository = scheduleRepository;
        this.trainerCourseRequestRepository = trainerCourseRequestRepository;
        this.userService = userService;
        this.studentFeeRepository = studentFeeRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.notificationRepository = notificationRepository;
        this.enquiryRepository = enquiryRepository;
        this.competitionRegistrationRepository = competitionRegistrationRepository;
    }

    public MeController(UserRepository userRepository,
                        CourseRepository courseRepository,
                        BatchRepository batchRepository,
                        EnrollmentRepository enrollmentRepository,
                        StudentCourseBatchRepository studentCourseBatchRepository,
                        AssignmentRepository assignmentRepository,
                        AssignmentSubmissionRepository assignmentSubmissionRepository,
                        ScheduleRepository scheduleRepository,
                        TrainerCourseRequestRepository trainerCourseRequestRepository,
                        UserService userService,
                        StudentFeeRepository studentFeeRepository,
                        AttendanceRecordRepository attendanceRecordRepository,
                        NotificationRepository notificationRepository,
                        EnquiryRepository enquiryRepository) {
        this(userRepository, courseRepository, batchRepository, enrollmentRepository, studentCourseBatchRepository,
             assignmentRepository, assignmentSubmissionRepository, scheduleRepository, trainerCourseRequestRepository,
             userService, studentFeeRepository, attendanceRecordRepository, notificationRepository, enquiryRepository,
             null);
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

    private void checkLearningAccess(User user) {
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";
        if ("STUDENT".equals(role)) {
            boolean hasActive = enrollmentRepository.findByStudentId(user.getId()).stream()
                    .anyMatch(e -> !"Cancelled".equalsIgnoreCase(e.getStatus()) && !"Dropped".equalsIgnoreCase(e.getStatus()));
            boolean hasBatch = studentCourseBatchRepository != null && !studentCourseBatchRepository.findByStudentId(user.getId()).isEmpty();
            boolean hasCourseField = user.getCourse() != null && !user.getCourse().isBlank();
            boolean isNotCompetitionOrigin = !"COMPETITION".equalsIgnoreCase(user.getOrigin());
            boolean hasLearningAccess = hasActive || hasBatch || (isNotCompetitionOrigin && (hasCourseField || user.getOrigin() == null || "LEARNING".equalsIgnoreCase(user.getOrigin())));
            if (!hasLearningAccess) {
                throw new com.zoroacademy.exception.ForbiddenException("Access denied: You do not have an active learning enrollment");
            }
        }
    }

    @GetMapping("/portals")
    public ApiResponse<Map<String, Object>> getMyPortals() {
        User user = getCurrentUser();
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";

        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            Map<String, Object> response = new HashMap<>();
            response.put("learning", true);
            response.put("competition", false);
            response.put("competitions", Collections.emptyList());
            response.put("defaultPortal", "admin");
            return ApiResponse.ok(response);
        }

        if ("TRAINER".equals(role)) {
            Map<String, Object> response = new HashMap<>();
            response.put("learning", true);
            response.put("competition", false);
            response.put("competitions", Collections.emptyList());
            response.put("defaultPortal", "trainer");
            return ApiResponse.ok(response);
        }

        boolean hasActiveEnrollment = enrollmentRepository.findByStudentId(user.getId()).stream()
                .anyMatch(e -> !"Cancelled".equalsIgnoreCase(e.getStatus()) && !"Dropped".equalsIgnoreCase(e.getStatus()));
        boolean hasBatch = studentCourseBatchRepository != null && !studentCourseBatchRepository.findByStudentId(user.getId()).isEmpty();
        boolean hasCourseField = user.getCourse() != null && !user.getCourse().isBlank();
        boolean isNotCompetitionOrigin = !"COMPETITION".equalsIgnoreCase(user.getOrigin());

        boolean learning = hasActiveEnrollment || hasBatch || (isNotCompetitionOrigin && (hasCourseField || user.getOrigin() == null || "LEARNING".equalsIgnoreCase(user.getOrigin())));

        List<CompetitionRegistration> regs = new ArrayList<>(competitionRegistrationRepository.findByStudentId(user.getId()));
        if (user.getEmail() != null) {
            for (CompetitionRegistration r : competitionRegistrationRepository.findByStudentEmailIgnoreCase(user.getEmail())) {
                if (regs.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                    regs.add(r);
                }
            }
        }

        List<Map<String, Object>> paidCompetitions = regs.stream()
                .filter(r -> ("PAID".equalsIgnoreCase(r.getPaymentStatus()) || "SUCCESS".equalsIgnoreCase(r.getPaymentStatus())))
                .map(r -> {
                    Map<String, Object> compMap = new HashMap<>();
                    if (r.getCompetition() != null) {
                        compMap.put("id", r.getCompetition().getId());
                        compMap.put("title", r.getCompetition().getTitle());
                        compMap.put("registrationId", r.getId());
                    } else if (r.getCompetitionId() != null) {
                        compMap.put("id", r.getCompetitionId());
                        compMap.put("registrationId", r.getId());
                    }
                    return compMap;
                })
                .filter(m -> m.get("id") != null)
                .collect(Collectors.toList());

        boolean competition = !paidCompetitions.isEmpty();

        if (!learning && !competition) {
            if ("COMPETITION".equalsIgnoreCase(user.getOrigin())) {
                competition = false;
            } else {
                learning = true;
            }
        }

        String defaultPortal = null;
        if (learning && !competition) {
            defaultPortal = "learning";
        } else if (!learning && competition) {
            defaultPortal = "competition";
        } else if (learning && competition) {
            defaultPortal = null;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("learning", learning);
        response.put("competition", competition);
        response.put("competitions", paidCompetitions);
        response.put("defaultPortal", defaultPortal);
        return ApiResponse.ok(response);
    }

    @GetMapping("/courses")
    public ApiResponse<List<Course>> getMyCourses() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(courseRepository.findAll());
        }

        if ("TRAINER".equals(role)) {
            List<Course> courses = new ArrayList<>(courseRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(user.getId(), user.getName()));
            Set<String> courseIds = courses.stream().map(Course::getId).collect(Collectors.toSet());

            // Include courses where trainer has an approved request
            List<TrainerCourseRequest> approvedReqs = trainerCourseRequestRepository.findByTrainerIdAndStatusIgnoreCase(user.getId(), "Approved");
            for (TrainerCourseRequest req : approvedReqs) {
                if (!courseIds.contains(req.getCourseId())) {
                    courseRepository.findById(req.getCourseId()).ifPresent(c -> {
                        courses.add(c);
                        courseIds.add(c.getId());
                    });
                }
            }
            return ApiResponse.ok(courses);
        }

        // STUDENT
        checkLearningAccess(user);
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(user.getId()).stream()
                .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                .toList();
        List<String> courseIds = enrollments.stream().map(Enrollment::getCourseId).distinct().toList();
        List<Course> enrolledCourses = courseRepository.findAllById(courseIds);
        return ApiResponse.ok(enrolledCourses);
    }

    @GetMapping("/trainer-courses")
    public ApiResponse<Map<String, Object>> getMyTrainerCourses() {
        User user = getCurrentUser();
        String trainerId = user.getId();
        String trainerEmail = user.getEmail();

        List<Course> trainerAudienceCourses = courseRepository.findByAudienceIgnoreCase("trainer");

        // Find all requests for this trainer by trainerId and trainerEmail
        List<TrainerCourseRequest> requests = new ArrayList<>(trainerCourseRequestRepository.findByTrainerId(trainerId));
        if (trainerEmail != null && !trainerEmail.isBlank()) {
            for (TrainerCourseRequest req : trainerCourseRequestRepository.findByTrainerEmailIgnoreCase(trainerEmail)) {
                if (requests.stream().noneMatch(r -> r.getId().equals(req.getId()))) {
                    requests.add(req);
                }
            }
        }

        Set<String> approvedCourseIds = requests.stream()
                .filter(r -> "Approved".equalsIgnoreCase(r.getStatus()))
                .map(TrainerCourseRequest::getCourseId)
                .collect(Collectors.toSet());

        Set<String> pendingCourseIds = requests.stream()
                .filter(r -> "Pending".equalsIgnoreCase(r.getStatus()))
                .map(TrainerCourseRequest::getCourseId)
                .collect(Collectors.toSet());

        List<Course> enrolled = new ArrayList<>();
        List<Course> pending = new ArrayList<>();
        List<Course> available = new ArrayList<>();

        Map<String, String> courseRequestStatus = new HashMap<>();
        for (TrainerCourseRequest req : requests) {
            courseRequestStatus.put(req.getCourseId(), req.getStatus());
        }

        for (Course c : trainerAudienceCourses) {
            String reqStatus = courseRequestStatus.get(c.getId());
            c.setRequestStatus(reqStatus);
            if (approvedCourseIds.contains(c.getId())) {
                if (c.getModules() != null) {
                    c.getModules().forEach(m -> m.setLocked(false));
                }
                enrolled.add(c);
            } else if (pendingCourseIds.contains(c.getId())) {
                pending.add(c);
            } else {
                available.add(c);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enrolled", enrolled);
        result.put("pending", pending);
        result.put("available", available);

        return ApiResponse.ok(result);
    }

    @GetMapping("/batches")
    public ApiResponse<List<Batch>> getMyBatches() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(batchRepository.findAll());
        }

        if ("TRAINER".equals(role)) {
            return ApiResponse.ok(batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(user.getId(), user.getName()));
        }

        // STUDENT
        checkLearningAccess(user);
        Set<String> batchIds = studentCourseBatchRepository.findByStudentId(user.getId()).stream()
                .map(StudentCourseBatch::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Batch> batches = batchRepository.findAllById(batchIds);
        return ApiResponse.ok(batches);
    }

    @GetMapping("/assignments")
    public ApiResponse<List<Assignment>> getMyAssignments() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(assignmentRepository.findAll());
        }

        if ("TRAINER".equals(role)) {
            return ApiResponse.ok(assignmentRepository.findByTrainerIdOrTrainerIgnoreCase(user.getId(), user.getName()));
        }

        // STUDENT: assignments matching student's enrolled courses and batches or specific targeting
        checkLearningAccess(user);
        if (assignmentService != null) {
            return ApiResponse.ok(assignmentService.getAssignmentsForStudent(user.getId()));
        }

        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(user.getId()).stream()
                .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                .toList();

        Set<String> courseIds = enrollments.stream().map(Enrollment::getCourseId).collect(Collectors.toSet());
        Set<String> courseTitles = enrollments.stream().map(Enrollment::getCourseTitle).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());
        Set<String> batchIds = enrollments.stream().map(Enrollment::getBatchId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> batchNames = enrollments.stream().map(Enrollment::getBatchName).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());

        List<Assignment> matching = assignmentRepository.findAll().stream()
                .filter(a -> {
                    boolean courseMatch = (a.getCourseId() != null && courseIds.contains(a.getCourseId()))
                            || (a.getCourse() != null && courseTitles.contains(a.getCourse().toLowerCase()));
                    if (!courseMatch) return false;

                    if (a.getBatchId() != null && !a.getBatchId().isBlank() && !"All".equalsIgnoreCase(a.getBatchId())) {
                        return batchIds.contains(a.getBatchId()) || (a.getBatch() != null && batchNames.contains(a.getBatch().toLowerCase()));
                    }
                    if (a.getBatch() != null && !a.getBatch().isBlank() && !"All".equalsIgnoreCase(a.getBatch())) {
                        return batchNames.contains(a.getBatch().toLowerCase()) || (a.getBatchId() != null && batchIds.contains(a.getBatchId()));
                    }
                    return true;
                })
                .toList();

        return ApiResponse.ok(matching);
    }

    @GetMapping("/submissions")
    public ApiResponse<List<AssignmentSubmission>> getMySubmissions(@RequestParam(required = false) String context) {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(assignmentSubmissionRepository.findAll());
        }

        if ("TRAINER".equals(role)) {
            if ("learning".equalsIgnoreCase(context) || "learner".equalsIgnoreCase(context)) {
                return ApiResponse.ok(assignmentSubmissionRepository.findByStudentIdAndSubmitterRoleIgnoreCase(user.getId(), "TRAINER"));
            }
            // By default, return student submissions assigned to this trainer for grading
            return ApiResponse.ok(assignmentSubmissionRepository.findByTrainerIdAndSubmitterRoleIgnoreCase(user.getId(), "STUDENT"));
        }

        // STUDENT: return only student submissions
        checkLearningAccess(user);
        return ApiResponse.ok(assignmentSubmissionRepository.findByStudentIdAndSubmitterRoleIgnoreCase(user.getId(), "STUDENT"));
    }

    @GetMapping("/trainer-submissions")
    public ApiResponse<List<AssignmentSubmission>> getMyTrainerSubmissions() {
        User user = getCurrentUser();
        return ApiResponse.ok(assignmentSubmissionRepository.findByStudentIdAndSubmitterRoleIgnoreCase(user.getId(), "TRAINER"));
    }

    @GetMapping("/schedules")
    public ApiResponse<List<Schedule>> getMySchedules() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(scheduleRepository.findAll());
        }

        if ("TRAINER".equals(role)) {
            List<Schedule> teachingSchedules = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(user.getId(), user.getName());

            // Also include schedules for trainer-audience courses where this trainer is approved/enrolled
            List<com.zoroacademy.entity.TrainerCourseRequest> approvedRequests = trainerCourseRequestRepository.findByTrainerId(user.getId()).stream()
                    .filter(r -> "Approved".equalsIgnoreCase(r.getStatus()))
                    .toList();
            Set<String> approvedCourseIds = approvedRequests.stream().map(com.zoroacademy.entity.TrainerCourseRequest::getCourseId).collect(Collectors.toSet());
            Set<String> approvedCourseTitles = approvedRequests.stream().map(com.zoroacademy.entity.TrainerCourseRequest::getCourseTitle).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());

            List<Schedule> learningSchedules = scheduleRepository.findByAudienceIgnoreCase("TRAINER").stream()
                    .filter(s -> (s.getCourseId() != null && approvedCourseIds.contains(s.getCourseId()))
                            || (s.getCourse() != null && approvedCourseTitles.contains(s.getCourse().toLowerCase())))
                    .toList();

            Set<String> seenIds = new HashSet<>();
            List<Schedule> combined = new ArrayList<>();
            for (Schedule s : teachingSchedules) {
                if (seenIds.add(s.getId())) combined.add(s);
            }
            for (Schedule s : learningSchedules) {
                if (seenIds.add(s.getId())) combined.add(s);
            }
            combined.sort(Comparator.comparing(Schedule::getDate, Comparator.nullsLast(Comparator.naturalOrder())));
            return ApiResponse.ok(combined);
        }

        // STUDENT
        checkLearningAccess(user);
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(user.getId()).stream()
                .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                .toList();

        Set<String> courseIds = enrollments.stream().map(Enrollment::getCourseId).collect(Collectors.toSet());
        Set<String> courseTitles = enrollments.stream().map(Enrollment::getCourseTitle).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());
        Set<String> batchIds = enrollments.stream().map(Enrollment::getBatchId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> batchNames = enrollments.stream().map(Enrollment::getBatchName).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());

        List<Schedule> matching = scheduleRepository.findAll().stream()
                .filter(s -> {
                    boolean courseMatch = (s.getCourseId() != null && courseIds.contains(s.getCourseId()))
                            || (s.getCourse() != null && courseTitles.contains(s.getCourse().toLowerCase()));
                    if (!courseMatch) return false;

                    if (s.getBatchId() != null && !s.getBatchId().isBlank() && !"All".equalsIgnoreCase(s.getBatchId())) {
                        return batchIds.contains(s.getBatchId()) || (s.getBatch() != null && batchNames.contains(s.getBatch().toLowerCase()));
                    }
                    if (s.getBatch() != null && !s.getBatch().isBlank() && !"All".equalsIgnoreCase(s.getBatch())) {
                        return batchNames.contains(s.getBatch().toLowerCase()) || (s.getBatchId() != null && batchIds.contains(s.getBatchId()));
                    }
                    return true;
                })
                .toList();

        return ApiResponse.ok(matching);
    }

    @GetMapping("/students")
    public ApiResponse<List<UserDto>> getMyStudents() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("STUDENT".equals(role)) {
            throw new org.springframework.security.access.AccessDeniedException("Students are not authorized to view student lists");
        }

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(userService.getStudents());
        }

        // TRAINER
        List<Batch> batches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(user.getId(), user.getName());
        List<Course> courses = new ArrayList<>(courseRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(user.getId(), user.getName()));
        List<TrainerCourseRequest> approvedReqs = trainerCourseRequestRepository.findByTrainerIdAndStatusIgnoreCase(user.getId(), "Approved");
        Set<String> courseIds = courses.stream().map(Course::getId).collect(Collectors.toSet());
        for (TrainerCourseRequest req : approvedReqs) {
            courseIds.add(req.getCourseId());
        }

        Set<String> studentIds = new LinkedHashSet<>();
        for (Batch b : batches) {
            if (b.getId() != null) {
                studentCourseBatchRepository.findByBatchId(b.getId()).forEach(scb -> {
                    if (scb.getStudentId() != null) studentIds.add(scb.getStudentId());
                });
                enrollmentRepository.findByBatchId(b.getId()).forEach(e -> {
                    if (e.getStudentId() != null) studentIds.add(e.getStudentId());
                });
            }
            if (b.getName() != null) {
                enrollmentRepository.findByBatchNameIgnoreCase(b.getName()).forEach(e -> {
                    if (e.getStudentId() != null) studentIds.add(e.getStudentId());
                });
            }
        }

        for (String cId : courseIds) {
            studentCourseBatchRepository.findByCourseId(cId).forEach(scb -> {
                if (scb.getStudentId() != null) studentIds.add(scb.getStudentId());
            });
            enrollmentRepository.findByCourseId(cId).forEach(e -> {
                if (e.getStudentId() != null) studentIds.add(e.getStudentId());
            });
        }

        List<User> students = userRepository.findAllById(studentIds).stream()
                .filter(u -> "STUDENT".equalsIgnoreCase(u.getRole()))
                .filter(u -> !"inactive".equalsIgnoreCase(u.getStatus()))
                .toList();

        List<UserDto> dtos = students.stream()
                .map(userService::convertUserToDto)
                .collect(Collectors.toList());

        return ApiResponse.ok(dtos);
    }

    @GetMapping("/profile")
    public ApiResponse<UserDto> getMyProfile() {
        User user = getCurrentUser();
        return ApiResponse.ok(userService.convertUserToDto(user));
    }

    @PutMapping("/profile")
    public ApiResponse<UserDto> updateMyProfile(@RequestBody UserDto updateDto) {
        User user = getCurrentUser();
        UserDto updated = userService.updateProfile(user.getId(), updateDto);
        return ApiResponse.ok(updated, "Profile updated successfully");
    }

    @GetMapping("/fees")
    public ApiResponse<List<StudentFee>> getMyFees() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(studentFeeRepository.findAll());
        }

        if ("STUDENT".equals(role)) {
            checkLearningAccess(user);
            List<StudentFee> fees = new ArrayList<>(studentFeeRepository.findByStudentId(user.getId()));
            if (user.getEmail() != null) {
                for (StudentFee f : studentFeeRepository.findByStudentId(user.getEmail())) {
                    if (fees.stream().noneMatch(existing -> existing.getId().equals(f.getId()))) {
                        fees.add(f);
                    }
                }
            }
            return ApiResponse.ok(fees);
        }

        return ApiResponse.ok(Collections.emptyList());
    }

    @GetMapping("/attendance")
    public ApiResponse<List<AttendanceRecord>> getMyAttendance() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(attendanceRecordRepository.findAll());
        }

        if ("STUDENT".equals(role)) {
            checkLearningAccess(user);
            List<AttendanceRecord> records = new ArrayList<>(attendanceRecordRepository.findByStudentId(user.getId()));
            if (user.getEmail() != null) {
                for (AttendanceRecord r : attendanceRecordRepository.findByStudentId(user.getEmail())) {
                    if (records.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                        records.add(r);
                    }
                }
            }
            return ApiResponse.ok(records);
        }

        // TRAINER
        List<Schedule> schedules = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(user.getId(), user.getName());
        Set<String> scheduleIds = schedules.stream().map(Schedule::getId).collect(Collectors.toSet());
        List<AttendanceRecord> records = attendanceRecordRepository.findAll().stream()
                .filter(ar -> ar.getScheduleId() != null && scheduleIds.contains(ar.getScheduleId()))
                .collect(Collectors.toList());
        return ApiResponse.ok(records);
    }

    @GetMapping("/notifications")
    public ApiResponse<List<Notification>> getMyNotifications() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();

        List<Notification> roleNotifs = notificationRepository.findByRecipientRoleIgnoreCaseOrRecipientRoleIgnoreCase("ALL", role).stream()
                .filter(n -> n.getRecipientId() == null || n.getRecipientId().isBlank())
                .toList();
        List<Notification> userNotifs = new ArrayList<>();
        if (user.getId() != null && !user.getId().isBlank()) {
            userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(user.getId()));
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(user.getEmail()));
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(user.getUsername()));
        }
        if (user.getName() != null && !user.getName().isBlank()) {
            userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(user.getName()));
        }

        Set<String> seenIds = new HashSet<>();
        List<Notification> merged = new ArrayList<>();
        for (Notification n : userNotifs) {
            if (seenIds.add(n.getId())) {
                merged.add(n);
            }
        }
        for (Notification n : roleNotifs) {
            if (seenIds.add(n.getId())) {
                merged.add(n);
            }
        }
        merged.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return ApiResponse.ok(merged);
    }

    @GetMapping("/enquiries")
    public ApiResponse<List<Enquiry>> getMyEnquiries() {
        User user = getCurrentUser();
        String role = user.getRole().toUpperCase();
        if ("ADMIN".equals(role)) {
            return ApiResponse.ok(enquiryRepository.findAll());
        }
        return ApiResponse.ok(enquiryRepository.findByEmailIgnoreCaseOrNameIgnoreCase(user.getEmail(), user.getName()));
    }

    // --- TRAINER EXTRA ASSIGNMENTS ALLOCATION ENDPOINTS ---

    @GetMapping({"/trainer-allocated-courses", "/trainer/courses/allocated-active"})
    public ApiResponse<List<Course>> getMyTrainerAllocatedCourses() {
        User user = getCurrentUser();
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";

        // Filter all courses: strictly Online and Hybrid modes, not Deleted
        List<Course> allCourses = courseRepository.findAll().stream()
                .filter(c -> c.getMode() != null && ("Online".equalsIgnoreCase(c.getMode()) || "Hybrid".equalsIgnoreCase(c.getMode())))
                .filter(c -> c.getStatus() == null || !"Deleted".equalsIgnoreCase(c.getStatus()))
                .toList();

        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            return ApiResponse.ok(allCourses);
        }

        if (!"TRAINER".equals(role)) {
            throw new com.zoroacademy.exception.ForbiddenException("Only trainers can access allocated courses");
        }

        String tId = user.getId();
        String tName = user.getName() != null ? user.getName().trim() : "";
        String tEmail = user.getEmail() != null ? user.getEmail().trim() : "";

        // Approved requests
        Set<String> approvedCourseIds = new HashSet<>();
        if (trainerCourseRequestRepository != null) {
            List<TrainerCourseRequest> reqs = new ArrayList<>(trainerCourseRequestRepository.findByTrainerId(tId));
            if (!tEmail.isEmpty()) {
                reqs.addAll(trainerCourseRequestRepository.findByTrainerEmailIgnoreCase(tEmail));
            }
            for (TrainerCourseRequest r : reqs) {
                if ("Approved".equalsIgnoreCase(r.getStatus()) || "Accepted".equalsIgnoreCase(r.getStatus())) {
                    if (r.getCourseId() != null) approvedCourseIds.add(r.getCourseId());
                }
            }
        }

        // Batches handled by trainer
        List<Batch> trainerBatches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(tId, tName);
        Set<String> batchCourseIdsOrTitles = new HashSet<>();
        for (Batch b : trainerBatches) {
            if (b.getCourseId() != null) batchCourseIdsOrTitles.add(b.getCourseId());
            if (b.getCourseName() != null) batchCourseIdsOrTitles.add(b.getCourseName().toLowerCase());
        }

        List<Course> allocated = allCourses.stream().filter(c -> {
            boolean isDirect = (c.getTrainerId() != null && c.getTrainerId().equals(tId))
                    || (c.getAssignedTrainer() != null && !tName.isEmpty() && c.getAssignedTrainer().equalsIgnoreCase(tName));
            boolean isRequested = approvedCourseIds.contains(c.getId());
            boolean isBatchMatch = batchCourseIdsOrTitles.contains(c.getId()) || (c.getTitle() != null && batchCourseIdsOrTitles.contains(c.getTitle().toLowerCase()));
            return isDirect || isRequested || isBatchMatch;
        }).toList();

        return ApiResponse.ok(allocated);
    }

    @GetMapping({"/courses/{courseId}/trainer-batches", "/trainer/courses/{courseId}/batches"})
    public ApiResponse<List<Batch>> getMyTrainerBatchesForCourse(@PathVariable String courseId) {
        User user = getCurrentUser();
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";

        Course course = courseRepository.findById(courseId)
                .or(() -> courseRepository.findByTitleIgnoreCase(courseId))
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("Course not found: " + courseId));

        List<Batch> courseBatches = batchRepository.findByCourseId(course.getId());
        if (courseBatches.isEmpty()) {
            courseBatches = batchRepository.findByCourseNameIgnoreCase(course.getTitle());
        }

        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            return ApiResponse.ok(courseBatches);
        }

        if (!"TRAINER".equals(role)) {
            throw new com.zoroacademy.exception.ForbiddenException("Only trainers can access course batches");
        }

        String tId = user.getId();
        String tName = user.getName() != null ? user.getName().trim() : "";

        List<Batch> trainerBatches = courseBatches.stream()
                .filter(b -> (b.getTrainerId() != null && b.getTrainerId().equals(tId))
                        || (b.getTrainerName() != null && !tName.isEmpty() && b.getTrainerName().equalsIgnoreCase(tName)))
                .toList();

        return ApiResponse.ok(trainerBatches);
    }

    @GetMapping({"/courses/{courseId}/trainer-students", "/trainer/courses/{courseId}/students"})
    public ApiResponse<List<UserDto>> getMyTrainerStudentsForCourse(
            @PathVariable String courseId,
            @RequestParam(required = false) String batchId) {
        User user = getCurrentUser();
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";

        Course course = courseRepository.findById(courseId)
                .or(() -> courseRepository.findByTitleIgnoreCase(courseId))
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("Course not found: " + courseId));

        if ("Recorded".equalsIgnoreCase(course.getMode())) {
            return ApiResponse.ok(Collections.emptyList());
        }

        List<Batch> allowedBatches;
        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            allowedBatches = batchRepository.findByCourseId(course.getId());
            if (allowedBatches.isEmpty()) allowedBatches = batchRepository.findByCourseNameIgnoreCase(course.getTitle());
        } else {
            String tId = user.getId();
            String tName = user.getName() != null ? user.getName().trim() : "";
            List<Batch> allCourseBatches = batchRepository.findByCourseId(course.getId());
            if (allCourseBatches.isEmpty()) allCourseBatches = batchRepository.findByCourseNameIgnoreCase(course.getTitle());
            allowedBatches = allCourseBatches.stream()
                    .filter(b -> (b.getTrainerId() != null && b.getTrainerId().equals(tId))
                            || (b.getTrainerName() != null && !tName.isEmpty() && b.getTrainerName().equalsIgnoreCase(tName)))
                    .toList();
        }

        Set<String> targetBatchIds = new HashSet<>();
        if (batchId != null && !batchId.isBlank() && !"all".equalsIgnoreCase(batchId)) {
            allowedBatches.stream()
                    .filter(b -> b.getId().equals(batchId) || b.getName().equalsIgnoreCase(batchId))
                    .map(Batch::getId)
                    .findFirst()
                    .ifPresent(targetBatchIds::add);
        } else {
            allowedBatches.forEach(b -> targetBatchIds.add(b.getId()));
        }

        Set<String> studentIds = new HashSet<>();
        for (String bId : targetBatchIds) {
            studentCourseBatchRepository.findByBatchId(bId).forEach(scb -> {
                if (scb.getStudentId() != null) studentIds.add(scb.getStudentId());
            });
        }

        if (targetBatchIds.isEmpty() || studentIds.isEmpty()) {
            enrollmentRepository.findByCourseId(course.getId()).stream()
                    .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                    .forEach(e -> studentIds.add(e.getStudentId()));
        }

        List<User> students = userRepository.findAllById(studentIds).stream()
                .filter(s -> !"Inactive".equalsIgnoreCase(s.getStatus()) && !"Deleted".equalsIgnoreCase(s.getStatus()))
                .filter(s -> !"COMPETITION".equalsIgnoreCase(s.getOrigin()))
                .toList();

        List<UserDto> dtos = students.stream().map(s -> {
            UserDto d = UserDto.fromEntity(s);
            studentCourseBatchRepository.findByStudentId(s.getId()).stream()
                    .filter(scb -> course.getId().equals(scb.getCourseId()) || (scb.getBatchId() != null && targetBatchIds.contains(scb.getBatchId())))
                    .findFirst()
                    .ifPresent(scb -> {
                        d.setBatchId(scb.getBatchId());
                        batchRepository.findById(scb.getBatchId()).ifPresent(b -> d.setBatch(b.getName()));
                    });
            return d;
        }).toList();

        return ApiResponse.ok(dtos);
    }
}
