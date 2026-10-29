package com.zoroacademy.service;

import com.zoroacademy.dto.TrainerDependencyDto;
import com.zoroacademy.dto.TrainerReplacementRequest;
import com.zoroacademy.dto.UserDto;
import com.zoroacademy.entity.*;
import com.zoroacademy.repository.*;
import com.zoroacademy.security.AdminPasswordCryptoService;
import com.zoroacademy.util.PhoneValidator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminPasswordCryptoService adminPasswordCryptoService;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final BatchRepository batchRepository;
    private final ScheduleRepository scheduleRepository;
    private final StudentFeeRepository studentFeeRepository;
    private final EnrollmentService enrollmentService;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final DoubtRepository doubtRepository;
    private final NotificationRepository notificationRepository;
    private final StudentProgressRepository studentProgressRepository;
    private final StudentModuleProgressRepository studentModuleProgressRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private FileStorageService fileStorageService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.repository.FeePaymentRepository feePaymentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private TrainerCourseRequestRepository trainerCourseRequestRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AssignmentRepository assignmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SalaryRecordRepository salaryRecordRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailService emailService;

    @org.springframework.beans.factory.annotation.Autowired
    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AdminPasswordCryptoService adminPasswordCryptoService,
                       StudentCourseBatchRepository studentCourseBatchRepository,
                       EnrollmentRepository enrollmentRepository,
                       CourseRepository courseRepository,
                       BatchRepository batchRepository,
                       ScheduleRepository scheduleRepository,
                       StudentFeeRepository studentFeeRepository,
                       EnrollmentService enrollmentService,
                       NotificationService notificationService,
                       ActivityLogService activityLogService,
                       AttendanceRecordRepository attendanceRecordRepository,
                       AssignmentSubmissionRepository assignmentSubmissionRepository,
                       DoubtRepository doubtRepository,
                       NotificationRepository notificationRepository,
                       StudentProgressRepository studentProgressRepository,
                       StudentModuleProgressRepository studentModuleProgressRepository,
                       EnrollmentRequestRepository enrollmentRequestRepository,
                       CompetitionRegistrationRepository competitionRegistrationRepository,
                       RefreshTokenRepository refreshTokenRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminPasswordCryptoService = adminPasswordCryptoService != null ? adminPasswordCryptoService : new AdminPasswordCryptoService(null);
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.scheduleRepository = scheduleRepository;
        this.studentFeeRepository = studentFeeRepository;
        this.enrollmentService = enrollmentService;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.assignmentSubmissionRepository = assignmentSubmissionRepository;
        this.doubtRepository = doubtRepository;
        this.notificationRepository = notificationRepository;
        this.studentProgressRepository = studentProgressRepository;
        this.studentModuleProgressRepository = studentModuleProgressRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.competitionRegistrationRepository = competitionRegistrationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AdminPasswordCryptoService adminPasswordCryptoService,
                       StudentCourseBatchRepository studentCourseBatchRepository,
                       EnrollmentRepository enrollmentRepository,
                       CourseRepository courseRepository,
                       BatchRepository batchRepository,
                       ScheduleRepository scheduleRepository,
                       StudentFeeRepository studentFeeRepository,
                       EnrollmentService enrollmentService,
                       NotificationService notificationService,
                       ActivityLogService activityLogService) {
        this(userRepository, passwordEncoder, adminPasswordCryptoService, studentCourseBatchRepository, enrollmentRepository,
             courseRepository, batchRepository, scheduleRepository, studentFeeRepository,
             enrollmentService, notificationService, activityLogService,
             null, null, null, null, null, null, null, null, null);
    }

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       StudentCourseBatchRepository studentCourseBatchRepository,
                       EnrollmentRepository enrollmentRepository,
                       CourseRepository courseRepository,
                       BatchRepository batchRepository,
                       ScheduleRepository scheduleRepository,
                       StudentFeeRepository studentFeeRepository,
                       EnrollmentService enrollmentService,
                       NotificationService notificationService,
                       ActivityLogService activityLogService) {
        this(userRepository, passwordEncoder, new AdminPasswordCryptoService(null), studentCourseBatchRepository, enrollmentRepository,
             courseRepository, batchRepository, scheduleRepository, studentFeeRepository,
             enrollmentService, notificationService, activityLogService,
             null, null, null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public UserDto convertUserToDto(User user) {
        if (user == null) return null;
        UserDto dto = UserDto.fromEntity(user);
        if ("STUDENT".equalsIgnoreCase(user.getRole())) {
            List<StudentCourseBatch> scbs = studentCourseBatchRepository.findByStudentId(user.getId());
            if (scbs != null && !scbs.isEmpty()) {
                List<Map<String, Object>> list = scbs.stream().map(scb -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("course", scb.getCourseName());
                    map.put("courseId", scb.getCourseId());
                    map.put("batch", scb.getBatchName());
                    map.put("batchId", scb.getBatchId());
                    return map;
                }).collect(Collectors.toList());
                dto.setCourseBatches(list);

                String readable = list.stream()
                        .map(m -> {
                            String c = (String) m.get("course");
                            String b = (String) m.get("batch");
                            return (b != null && !b.isBlank()) ? c + " (" + b + ")" : c;
                        })
                        .collect(Collectors.joining(", "));
                dto.setCourse(readable);
            }
        }

        String roleUpper = (user.getRole() != null ? user.getRole() : "STUDENT").toUpperCase();
        if ("ADMIN".equals(roleUpper) || "SUPER_ADMIN".equals(roleUpper)) {
            dto.setHasCourseEnrollment(true);
            dto.setHasCompetitionRegistration(false);
        } else if ("TRAINER".equals(roleUpper)) {
            dto.setHasCourseEnrollment(true);
            dto.setHasCompetitionRegistration(false);
        } else {
            boolean hasActiveEnrollment = false;
            if (enrollmentRepository != null) {
                hasActiveEnrollment = enrollmentRepository.findByStudentId(user.getId()).stream()
                        .anyMatch(e -> !"Cancelled".equalsIgnoreCase(e.getStatus()) && !"Dropped".equalsIgnoreCase(e.getStatus()));
            }

            boolean hasBatch = false;
            if (studentCourseBatchRepository != null) {
                hasBatch = !studentCourseBatchRepository.findByStudentId(user.getId()).isEmpty();
            }

            boolean hasCourseField = user.getCourse() != null && !user.getCourse().isBlank();
            boolean isNotCompetitionOrigin = !"COMPETITION".equalsIgnoreCase(user.getOrigin());

            boolean hasCourse = hasActiveEnrollment || hasBatch || (isNotCompetitionOrigin && (hasCourseField || user.getOrigin() == null || "LEARNING".equalsIgnoreCase(user.getOrigin())));

            boolean hasCompetition = false;
            if (competitionRegistrationRepository != null) {
                List<CompetitionRegistration> regs = new ArrayList<>(competitionRegistrationRepository.findByStudentId(user.getId()));
                if (user.getEmail() != null) {
                    for (CompetitionRegistration r : competitionRegistrationRepository.findByStudentEmailIgnoreCase(user.getEmail())) {
                        if (regs.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                            regs.add(r);
                        }
                    }
                }
                hasCompetition = regs.stream().anyMatch(r -> "PAID".equalsIgnoreCase(r.getPaymentStatus()));
            }

            if (!hasCourse && !hasCompetition) {
                if ("COMPETITION".equalsIgnoreCase(user.getOrigin())) {
                    hasCompetition = false;
                } else {
                    hasCourse = true;
                }
            }

            dto.setHasCourseEnrollment(hasCourse);
            dto.setHasCompetitionRegistration(hasCompetition);
        }
        return dto;
    }

    @Transactional
    public UserDto updateProfile(String userId, UserDto updateDto) {
        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmailIgnoreCase(userId))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (updateDto.getName() != null && !updateDto.getName().isBlank()) {
            user.setName(updateDto.getName().trim());
        }

        if (updateDto.getPhone() != null && !updateDto.getPhone().isBlank()) {
            PhoneValidator.validate(updateDto.getPhone());
            user.setPhone(PhoneValidator.sanitize(updateDto.getPhone()));
        } else if (updateDto.getPhone() != null) {
            user.setPhone(null);
        }

        if (updateDto.getAvatar() != null) {
            if (user.getAvatar() != null && !user.getAvatar().equals(updateDto.getAvatar())) {
                cleanupStoredFilesFromText(user.getAvatar());
            }
            user.setAvatar(updateDto.getAvatar());
        }

        if (updateDto.getAddress() != null) {
            user.setAddress(updateDto.getAddress());
        }

        user = userRepository.save(user);
        return convertUserToDto(user);
    }

    @Transactional(readOnly = true)
    public List<UserDto> getStudents() {
        return userRepository.findLearningStudents()
                .stream().map(this::convertUserToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto> getTrainers() {
        return userRepository.findByRoleIgnoreCase("TRAINER")
                .stream().map(UserDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll()
                .stream().map(this::convertUserToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(String id) {
        User user = userRepository.findById(id)
                .or(() -> userRepository.findByEmailIgnoreCase(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        return convertUserToDto(user);
    }

    public static void validatePasswordStrength(String password) {
        if (password == null || password.length() < 8 || !password.matches(".*[a-zA-Z].*") || !password.matches(".*[0-9].*")) {
            throw new IllegalArgumentException("Password must be at least 8 characters long and contain at least one letter and one digit");
        }
    }

    @Transactional
    public UserDto saveStudent(UserDto dto) {
        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            throw new IllegalArgumentException("Student email is required");
        }
        final String cleanEmail = dto.getEmail().trim().toLowerCase();
        final String userId = (dto.getId() != null && !dto.getId().isBlank()) 
                ? dto.getId() 
                : "std_" + UUID.randomUUID().toString();

        User existingUser = (dto.getId() != null && !dto.getId().isBlank()) 
                ? userRepository.findById(dto.getId()).orElse(null)
                : null;

        final String cleanUsername = dto.getUsername() != null && !dto.getUsername().isBlank()
                ? dto.getUsername().trim()
                : (existingUser != null && existingUser.getUsername() != null && !existingUser.getUsername().isBlank()
                    ? existingUser.getUsername()
                    : cleanEmail);

        // Prevent duplicate email with another account
        userRepository.findByEmailIgnoreCase(cleanEmail).ifPresent(existing -> {
            if (existing.getId() == null || !existing.getId().equals(userId)) {
                throw new com.zoroacademy.exception.ConflictException("A student with this email already exists");
            }
        });

        // Prevent duplicate username with another account
        userRepository.findByUsernameIgnoreCase(cleanUsername).ifPresent(existing -> {
            if (existing.getId() == null || !existing.getId().equals(userId)) {
                throw new com.zoroacademy.exception.ConflictException("Username is already taken: " + cleanUsername);
            }
        });

        User user = userRepository.findById(userId).orElseGet(() -> User.builder().id(userId).role("STUDENT").build());
        user.setEmail(cleanEmail);
        user.setName(dto.getName() != null ? dto.getName().trim() : "Student");
        user.setUsername(cleanUsername);

        if (dto.getPhone() != null && !dto.getPhone().isBlank()) {
            PhoneValidator.validate(dto.getPhone());
            user.setPhone(PhoneValidator.sanitize(dto.getPhone()));
        } else {
            user.setPhone(null);
        }

        user.setAddress(dto.getAddress());
        user.setJoinedOn(dto.getJoinedOn());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : "Active");
        user.setCourse(dto.getCourse());

        final boolean isNewStudent = user.getPassword() == null || user.getPassword().isBlank();
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            validatePasswordStrength(dto.getPassword().trim());
            user.setPassword(passwordEncoder.encode(dto.getPassword().trim()));
            user.setAdminVisiblePassword(adminPasswordCryptoService.encrypt(dto.getPassword().trim()));
            user.setMustChangePassword(false);
            if (!isNewStudent && refreshTokenRepository != null) {
                refreshTokenRepository.revokeAllByUserId(user.getId());
            }
        } else if (isNewStudent) {
            throw new IllegalArgumentException("Password is required for new student (min 8 characters, at least 1 letter and 1 digit)");
        }

        user = userRepository.save(user);


        // Relational course-batch & enrollment synchronization via EnrollmentService
        if (dto.getCourseBatches() != null) {
            Set<String> previousCourseIds = enrollmentRepository.findByStudentId(userId).stream()
                    .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                    .map(Enrollment::getCourseId)
                    .collect(Collectors.toSet());
            Set<String> newCourseIds = new HashSet<>();
            List<String> readableEntries = new ArrayList<>();

            for (Map<String, Object> item : dto.getCourseBatches()) {
                String rawCName = item.get("course") != null ? item.get("course").toString().trim() : "";
                String rawCId = item.get("courseId") != null ? item.get("courseId").toString().trim() : null;
                String rawBName = item.get("batch") != null ? item.get("batch").toString().trim() : "";
                String rawBId = item.get("batchId") != null ? item.get("batchId").toString().trim() : null;

                String resolvedCId = rawCId;
                String resolvedCName = rawCName;

                if ((resolvedCId == null || resolvedCId.isBlank()) && !resolvedCName.isBlank()) {
                    resolvedCId = courseRepository.findByTitleIgnoreCase(resolvedCName).map(Course::getId).orElse(null);
                } else if (resolvedCId != null && !resolvedCId.isBlank() && resolvedCName.isBlank()) {
                    resolvedCName = courseRepository.findById(resolvedCId).map(Course::getTitle).orElse(resolvedCId);
                }

                String resolvedBId = rawBId;
                String resolvedBName = rawBName;

                if ((resolvedBId == null || resolvedBId.isBlank()) && !resolvedBName.isBlank()) {
                    final String matchBName = resolvedBName;
                    if (resolvedCId != null) {
                        resolvedBId = batchRepository.findByNameIgnoreCaseAndCourseId(matchBName, resolvedCId)
                                .map(Batch::getId).orElse(null);
                    }
                    if (resolvedBId == null && resolvedCName != null) {
                        resolvedBId = batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(matchBName, resolvedCName)
                                .map(Batch::getId).orElse(null);
                    }
                } else if (resolvedBId != null && !resolvedBId.isBlank() && resolvedBName.isBlank()) {
                    resolvedBName = batchRepository.findById(resolvedBId).map(Batch::getName).orElse(resolvedBId);
                }

                if (resolvedCId != null && !resolvedCId.isBlank()) {
                    Optional<Course> cOpt = courseRepository.findById(resolvedCId);
                    boolean isRecorded = false;
                    if (cOpt.isPresent()) {
                        Course c = cOpt.get();
                        isRecorded = "Recorded".equalsIgnoreCase(c.getMode());
                    }

                    if (isRecorded) {
                        resolvedBId = null;
                        resolvedBName = null;
                    } else {
                        if ((resolvedBId == null || resolvedBId.isBlank()) && (resolvedBName == null || resolvedBName.isBlank())) {
                            throw new com.zoroacademy.exception.BadRequestException("Batch is required for Online/Hybrid course: " + resolvedCName);
                        }
                    }

                    newCourseIds.add(resolvedCId);
                    enrollmentService.enroll(userId, dto.getEmail(), resolvedCId, resolvedBId != null ? resolvedBId : resolvedBName);
                    readableEntries.add(resolvedCName + (resolvedBName != null && !resolvedBName.isBlank() ? " (" + resolvedBName + ")" : ""));
                }
            }

            // Deactivate any courses from which the student was removed
            for (String oldCourseId : previousCourseIds) {
                if (!newCourseIds.contains(oldCourseId)) {
                    enrollmentService.deactivateEnrollment(userId, oldCourseId);
                }
            }

            if (!readableEntries.isEmpty()) {
                user.setCourse(String.join(", ", readableEntries));
                userRepository.save(user);
            }
        }

        if (isNewStudent) {
            try {
                notificationService.createNotification(
                    user.getId(),
                    "Welcome to Zoro Academy!",
                    "Your student account has been created. Start exploring your courses and materials.",
                    "SYSTEM",
                    "/student/courses"
                );
            } catch (Exception ignored) {}

            if (emailService != null) {
                try {
                    List<String> courses = (user.getCourse() != null && !user.getCourse().isBlank())
                            ? List.of(user.getCourse())
                            : Collections.emptyList();
                    emailService.sendStudentWelcomeEmail(user.getEmail(), user.getName(), dto.getPassword(), courses);
                } catch (Exception ignored) {}
            }
        } else {
            if (emailService != null) {
                try {
                    java.util.Map<String, Object> changed = new java.util.LinkedHashMap<>();
                    if (dto.getName() != null) changed.put("Full Name", dto.getName());
                    if (dto.getPhone() != null) changed.put("Phone", dto.getPhone());
                    if (user.getCourse() != null && !user.getCourse().isBlank()) changed.put("Enrolled Courses", user.getCourse());
                    if (dto.getStatus() != null) changed.put("Account Status", dto.getStatus());

                    String updatedPass = (dto.getPassword() != null && !dto.getPassword().isBlank()) ? dto.getPassword() : null;
                    emailService.sendProfileUpdatedEmail(user.getEmail(), user.getName(), "STUDENT", changed, updatedPass);
                } catch (Exception ignored) {}
            }
        }

        return convertUserToDto(user);
    }

    @Transactional
    public UserDto saveTrainer(UserDto dto) {
        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            throw new IllegalArgumentException("Trainer email is required");
        }
        final String cleanEmail = dto.getEmail().trim().toLowerCase();
        final String cleanUsername = dto.getUsername() != null && !dto.getUsername().isBlank()
                ? dto.getUsername().trim()
                : cleanEmail;

        final String userId = (dto.getId() != null && !dto.getId().isBlank()) 
                ? dto.getId() 
                : "trn_" + UUID.randomUUID().toString();

        // Prevent duplicate email with another account
        userRepository.findByEmailIgnoreCase(cleanEmail).ifPresent(existing -> {
            if (!existing.getId().equals(userId)) {
                throw new com.zoroacademy.exception.ConflictException("Email is already registered: " + cleanEmail);
            }
        });

        // Prevent duplicate username with another account
        userRepository.findByUsernameIgnoreCase(cleanUsername).ifPresent(existing -> {
            if (!existing.getId().equals(userId)) {
                throw new com.zoroacademy.exception.ConflictException("Username is already taken: " + cleanUsername);
            }
        });

        User user = userRepository.findById(userId).orElseGet(() -> User.builder().id(userId).role("TRAINER").build());
        user.setEmail(cleanEmail);
        user.setName(dto.getName() != null ? dto.getName().trim() : "Trainer");
        user.setUsername(cleanUsername);

        if (dto.getPhone() != null && !dto.getPhone().isBlank()) {
            PhoneValidator.validate(dto.getPhone());
            user.setPhone(PhoneValidator.sanitize(dto.getPhone()));
        } else {
            user.setPhone(null);
        }

        user.setAddress(dto.getAddress());
        user.setJoinedOn(dto.getJoinedOn());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : "Active");
        user.setSpecialty(dto.getSpecialty());
        user.setCode(dto.getCode());
        user.setSalaryAmount(dto.getSalaryAmount());
        user.setSalaryCreditDate(dto.getSalaryCreditDate());

        final boolean isNewTrainer = user.getPassword() == null || user.getPassword().isBlank();
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            validatePasswordStrength(dto.getPassword().trim());
            user.setPassword(passwordEncoder.encode(dto.getPassword().trim()));
            user.setAdminVisiblePassword(adminPasswordCryptoService.encrypt(dto.getPassword().trim()));
            user.setMustChangePassword(false);
            if (!isNewTrainer && refreshTokenRepository != null) {
                refreshTokenRepository.revokeAllByUserId(user.getId());
            }
        } else if (isNewTrainer) {
            throw new IllegalArgumentException("Password is required for new trainer (min 8 characters, at least 1 letter and 1 digit)");
        }

        user = userRepository.save(user);

        if (isNewTrainer) {
            try {
                notificationService.createNotification(
                    user.getId(),
                    "Welcome to Zoro Academy Faculty!",
                    "Your trainer account has been created. Check your allocated batches and schedule.",
                    "SYSTEM",
                    "/trainer/schedule"
                );
            } catch (Exception ignored) {}

            if (emailService != null) {
                try {
                    emailService.sendTrainerWelcomeEmail(user.getEmail(), user.getName(), dto.getPassword(), user.getSpecialty());
                } catch (Exception ignored) {}
            }
        } else {
            if (emailService != null) {
                try {
                    java.util.Map<String, Object> changed = new java.util.LinkedHashMap<>();
                    if (dto.getName() != null) changed.put("Full Name", dto.getName());
                    if (dto.getPhone() != null) changed.put("Phone", dto.getPhone());
                    if (dto.getSpecialty() != null) changed.put("Specialization", dto.getSpecialty());
                    if (dto.getStatus() != null) changed.put("Account Status", dto.getStatus());

                    String updatedPass = (dto.getPassword() != null && !dto.getPassword().isBlank()) ? dto.getPassword() : null;
                    emailService.sendProfileUpdatedEmail(user.getEmail(), user.getName(), "TRAINER", changed, updatedPass);
                } catch (Exception ignored) {}
            }
        }

        return UserDto.fromEntity(user);
    }


    @Transactional(readOnly = true)
    public TrainerDependencyDto getTrainerDependencies(String trainerId) {
        User trainer = userRepository.findById(trainerId)
                .or(() -> userRepository.findByEmailIgnoreCase(trainerId))
                .orElse(null);

        String tName = trainer != null ? trainer.getName() : null;
        String tId = trainer != null ? trainer.getId() : trainerId;

        List<Course> courses = courseRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(tId, tName != null ? tName : "");
        List<Batch> batches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(tId, tName != null ? tName : "");
        List<Schedule> schedules = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(tId, tName != null ? tName : "");

        List<Map<String, String>> courseMaps = courses.stream().map(c -> {
            Map<String, String> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("title", c.getTitle());
            m.put("category", c.getCategory());
            return m;
        }).collect(Collectors.toList());

        List<Map<String, String>> batchMaps = batches.stream().map(b -> {
            Map<String, String> m = new HashMap<>();
            m.put("id", b.getId());
            m.put("name", b.getName());
            m.put("courseName", b.getCourseName());
            return m;
        }).collect(Collectors.toList());

        List<Map<String, String>> schedMaps = schedules.stream().map(s -> {
            Map<String, String> m = new HashMap<>();
            m.put("id", s.getId());
            m.put("title", s.getTitle());
            m.put("course", s.getCourse());
            m.put("batch", s.getBatch());
            m.put("date", s.getDate());
            return m;
        }).collect(Collectors.toList());

        boolean hasDeps = !courses.isEmpty() || !batches.isEmpty() || !schedules.isEmpty();

        return new TrainerDependencyDto(tId, tName, hasDeps, courses.size(), batches.size(), schedules.size(),
                courseMaps, batchMaps, schedMaps);
    }

    @Transactional(readOnly = true)
    public com.zoroacademy.dto.DeletionImpactDto getTrainerDeletionImpact(String trainerId) {
        User trainer = userRepository.findById(trainerId)
                .or(() -> userRepository.findByEmailIgnoreCase(trainerId))
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("Trainer not found: " + trainerId));

        boolean canDelete = true;
        List<String> blockingReasons = new ArrayList<>();
        Map<String, Long> counts = new HashMap<>();
        Map<String, List<String>> names = new HashMap<>();

        String tName = trainer.getName() != null ? trainer.getName() : "";
        String tId = trainer.getId();

        // 1. Courses (assigned trainer OR approved trainer course request)
        List<Course> directCourses = courseRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(tId, tName);
        Set<String> courseTitles = directCourses.stream().map(Course::getTitle).filter(Objects::nonNull).collect(Collectors.toSet());
        if (trainerCourseRequestRepository != null) {
            List<TrainerCourseRequest> approvedReqs = trainerCourseRequestRepository.findByTrainerIdAndStatusIgnoreCase(tId, "Approved");
            for (TrainerCourseRequest req : approvedReqs) {
                if (req.getCourseTitle() != null && !req.getCourseTitle().isBlank()) {
                    courseTitles.add(req.getCourseTitle());
                } else {
                    courseRepository.findById(req.getCourseId()).ifPresent(c -> courseTitles.add(c.getTitle()));
                }
            }
        }
        counts.put("courses", (long) courseTitles.size());
        names.put("courses", new ArrayList<>(courseTitles));

        // 2. Batches
        List<Batch> batches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(tId, tName);
        List<String> batchNames = batches.stream().map(Batch::getName).filter(Objects::nonNull).distinct().toList();
        counts.put("batches", (long) batchNames.size());
        names.put("batches", batchNames);

        // 3. Schedules
        List<Schedule> schedules = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(tId, tName);
        List<String> scheduleTitles = schedules.stream().map(Schedule::getTitle).filter(Objects::nonNull).distinct().toList();
        counts.put("schedules", (long) scheduleTitles.size());
        names.put("schedules", scheduleTitles);

        // 4. Doubt duty
        List<Doubt> doubts = doubtRepository != null ? doubtRepository.findByTrainerId(tId) : Collections.emptyList();
        List<Doubt> pendingDoubts = doubts.stream().filter(d -> !"Resolved".equalsIgnoreCase(d.getStatus())).toList();
        counts.put("doubts", (long) pendingDoubts.size());

        // 5. Assignment duty
        List<Assignment> assignments = assignmentRepository != null ? assignmentRepository.findByTrainerId(tId) : Collections.emptyList();
        List<String> assignmentTitles = assignments.stream().map(Assignment::getTitle).filter(Objects::nonNull).distinct().toList();
        counts.put("assignments", (long) assignmentTitles.size());
        names.put("assignments", assignmentTitles);

        List<String> assignmentsList = new ArrayList<>();
        if (!batchNames.isEmpty()) {
            assignmentsList.add("batch(es) " + String.join(", ", batchNames));
        }
        if (!courseTitles.isEmpty()) {
            assignmentsList.add("course(s) " + String.join(", ", courseTitles));
        }
        if (!scheduleTitles.isEmpty()) {
            assignmentsList.add("schedule(s) " + String.join(", ", scheduleTitles));
        }
        if (!pendingDoubts.isEmpty()) {
            assignmentsList.add(pendingDoubts.size() + " doubt duty");
        }
        if (!assignmentTitles.isEmpty()) {
            assignmentsList.add("assignment(s) " + String.join(", ", assignmentTitles));
        }

        if (!assignmentsList.isEmpty()) {
            canDelete = false;
            blockingReasons.add("Assigned to " + String.join(" and ", assignmentsList) + ". Reassign them first.");
        }

        return new com.zoroacademy.dto.DeletionImpactDto(canDelete, blockingReasons, counts, names);
    }

    @Transactional
    public boolean replaceTrainer(String oldTrainerId, TrainerReplacementRequest request) {
        User oldTrainer = userRepository.findById(oldTrainerId)
                .or(() -> userRepository.findByEmailIgnoreCase(oldTrainerId))
                .orElseThrow(() -> new IllegalArgumentException("Trainer not found: " + oldTrainerId));

        if (request.getNewTrainerId() == null || request.getNewTrainerId().isBlank()) {
            throw new IllegalArgumentException("New replacement trainer ID is required");
        }

        User newTrainer = userRepository.findById(request.getNewTrainerId())
                .or(() -> userRepository.findByEmailIgnoreCase(request.getNewTrainerId()))
                .orElseThrow(() -> new IllegalArgumentException("Replacement trainer not found: " + request.getNewTrainerId()));

        String oldId = oldTrainer.getId();
        String oldName = oldTrainer.getName();
        String newId = newTrainer.getId();
        String newName = newTrainer.getName();

        // 1. Reassign Courses
        List<Course> courses = courseRepository.findByTrainerIdOrAssignedTrainerIgnoreCase(oldId, oldName != null ? oldName : "");
        for (Course c : courses) {
            c.setTrainerId(newId);
            c.setAssignedTrainer(newName);
            courseRepository.save(c);
        }

        // 2. Reassign Batches
        List<Batch> batches = batchRepository.findByTrainerIdOrTrainerNameIgnoreCase(oldId, oldName != null ? oldName : "");
        for (Batch b : batches) {
            b.setTrainerId(newId);
            b.setTrainerName(newName);
            batchRepository.save(b);
        }

        // 3. Reassign Schedules
        List<Schedule> schedules = scheduleRepository.findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(oldId, oldName != null ? oldName : "");
        for (Schedule s : schedules) {
            s.setTrainerId(newId);
            s.setTrainer(newName);
            scheduleRepository.save(s);
        }

        // 4. Handle requested action on old trainer
        if ("DELETE".equalsIgnoreCase(request.getAction())) {
            userRepository.delete(oldTrainer);
        } else {
            oldTrainer.setStatus("Inactive");
            userRepository.save(oldTrainer);
        }

        activityLogService.logAction(newId, newName, "TRAINER_REPLACED",
                "Replaced trainer " + oldName + " with " + newName + " (" + courses.size() + " courses, " + batches.size() + " batches, " + schedules.size() + " schedules)", "System");

        notificationService.createNotification(Notification.builder()
                .id("notif_" + UUID.randomUUID())
                .recipientId(newId)
                .recipientRole("TRAINER")
                .title("Assigned to Replacement Courses & Batches")
                .message("You have been assigned to replace " + oldName + " across " + courses.size() + " courses and " + batches.size() + " batches.")
                .readStatus(false)
                .build());

        return true;
    }

    @Transactional
    public boolean updatePassword(String userIdOrEmail, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required");
        }
        validatePasswordStrength(newPassword.trim());

        User user = userRepository.findById(userIdOrEmail)
                .or(() -> userRepository.findByEmailIgnoreCase(userIdOrEmail))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdOrEmail));

        // Strictly verify current password using passwordEncoder
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return false;
        }

        user.setPassword(passwordEncoder.encode(newPassword.trim()));
        user.setAdminVisiblePassword(adminPasswordCryptoService.encrypt(newPassword.trim()));
        user.setMustChangePassword(false);
        userRepository.save(user);
        if (refreshTokenRepository != null) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }
        return true;
    }

    @Transactional(readOnly = true)
    public String getAdminVisiblePassword(String userId) {
        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmailIgnoreCase(userId))
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("User not found: " + userId));

        String encrypted = user.getAdminVisiblePassword();
        if (encrypted == null || encrypted.isBlank()) {
            return null;
        }
        return adminPasswordCryptoService.decrypt(encrypted);
    }

    @Transactional
    public void setAdminPassword(String userId, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required");
        }
        validatePasswordStrength(newPassword.trim());

        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmailIgnoreCase(userId))
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("User not found: " + userId));

        user.setPassword(passwordEncoder.encode(newPassword.trim()));
        user.setAdminVisiblePassword(adminPasswordCryptoService.encrypt(newPassword.trim()));
        user.setMustChangePassword(false);
        userRepository.save(user);

        if (refreshTokenRepository != null) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }
    }

    @Transactional
    public UserDto updateUserStatus(String id, String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Status is required");
        }
        User user = userRepository.findById(id)
                .or(() -> userRepository.findByEmailIgnoreCase(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

        user.setStatus(status.trim());
        user = userRepository.save(user);

        // Keep enrollment status synchronized with single source of truth (user status)
        if (enrollmentRepository != null) {
            List<Enrollment> enrs = enrollmentRepository.findByStudentId(user.getId());
            if (enrs != null && !enrs.isEmpty()) {
                for (Enrollment enr : enrs) {
                    enr.setStatus(status.trim());
                }
                enrollmentRepository.saveAll(enrs);
            }
        }

        if (refreshTokenRepository != null && !"Active".equalsIgnoreCase(status.trim())) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }

        return convertUserToDto(user);
    }

    @Transactional
    public void deleteUser(String id) {
        deleteUser(id, false);
    }

    @Transactional
    public void deleteUser(String id, boolean force) {
        User user = userRepository.findById(id)
                .or(() -> userRepository.findByEmailIgnoreCase(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            long adminCount = userRepository.countByRoleIgnoreCase("ADMIN");
            if (adminCount <= 1) {
                throw new IllegalStateException("Cannot delete the last remaining administrator account");
            }
        }

        if (!force) {
            if ("TRAINER".equalsIgnoreCase(user.getRole())) {
                com.zoroacademy.dto.DeletionImpactDto impact = getTrainerDeletionImpact(user.getId());
                if (!impact.isCanDelete()) {
                    throw new com.zoroacademy.exception.ConflictException(String.join(" ", impact.getBlockingReasons()));
                }
            }

            if ("STUDENT".equalsIgnoreCase(user.getRole())) {
                List<Enrollment> activeEnrs = enrollmentRepository.findByStudentId(user.getId()).stream()
                        .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                        .toList();
                if (!activeEnrs.isEmpty()) {
                    throw new com.zoroacademy.exception.ConflictException("Cannot delete student with " + activeEnrs.size() + " active course enrollments.");
                }
                List<StudentFee> pendingFees = studentFeeRepository.findByStudentId(user.getId()).stream()
                        .filter(f -> "Pending".equalsIgnoreCase(f.getStatus()))
                        .toList();
                if (!pendingFees.isEmpty()) {
                    throw new com.zoroacademy.exception.ConflictException("Cannot delete student with " + pendingFees.size() + " pending fee records.");
                }
            }
        }

        if (refreshTokenRepository != null) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }

        // Cascaded removal of student's dependents in ONE transaction
        if (attendanceRecordRepository != null) {
            attendanceRecordRepository.deleteAll(attendanceRecordRepository.findByStudentId(user.getId()));
        }
        if (assignmentSubmissionRepository != null) {
            assignmentSubmissionRepository.deleteAll(assignmentSubmissionRepository.findByStudentId(user.getId()));
            if (user.getEmail() != null) {
                assignmentSubmissionRepository.deleteAll(assignmentSubmissionRepository.findByStudentEmailIgnoreCase(user.getEmail()));
            }
        }
        if (doubtRepository != null) {
            doubtRepository.deleteAll(doubtRepository.findByStudentId(user.getId()));
        }
        if (notificationRepository != null) {
            notificationRepository.deleteAll(notificationRepository.findByRecipientId(user.getId()));
        }
        if (studentProgressRepository != null) {
            studentProgressRepository.deleteAll(studentProgressRepository.findByStudentIdIgnoreCase(user.getId()));
        }
        if (studentModuleProgressRepository != null) {
            studentModuleProgressRepository.deleteAll(studentModuleProgressRepository.findByStudentId(user.getId()));
        }
        if (enrollmentRequestRepository != null) {
            enrollmentRequestRepository.deleteAll(enrollmentRequestRepository.findByStudentId(user.getId()));
            if (user.getEmail() != null) {
                enrollmentRequestRepository.deleteAll(enrollmentRequestRepository.findByStudentEmailIgnoreCase(user.getEmail()));
            }
        }
        if (competitionRegistrationRepository != null) {
            competitionRegistrationRepository.deleteAll(competitionRegistrationRepository.findByStudentId(user.getId()));
        }
        if (studentFeeRepository != null) {
            List<StudentFee> fees = studentFeeRepository.findByStudentId(user.getId());
            if (feePaymentRepository != null && fees != null) {
                for (StudentFee f : fees) {
                    try {
                        feePaymentRepository.deleteAll(feePaymentRepository.findByFeeId(f.getId()));
                    } catch (Exception ignored) {}
                }
            }
            studentFeeRepository.deleteAll(fees);
        }

        if (salaryRecordRepository != null) {
            salaryRecordRepository.deleteAll(salaryRecordRepository.findByTrainerId(user.getId()));
        }

        studentCourseBatchRepository.deleteByStudentId(user.getId());
        List<Enrollment> enrs = enrollmentRepository.findByStudentId(user.getId());
        if (enrs != null && !enrs.isEmpty()) {
            enrollmentRepository.deleteAll(enrs);
        }
        if (user.getEmail() != null) {
            List<Enrollment> enrsByEmail = enrollmentRepository.findByStudentEmailIgnoreCase(user.getEmail());
            if (enrsByEmail != null && !enrsByEmail.isEmpty()) {
                enrollmentRepository.deleteAll(enrsByEmail);
            }
        }
        if (user.getAvatar() != null) {
            cleanupStoredFilesFromText(user.getAvatar());
        }
        userRepository.delete(user);
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

    @Transactional(readOnly = true)
    public Map<String, Object> getTrainerDashboardStats(String trainerIdOrName) {
        User trainer = null;
        if (trainerIdOrName != null && !trainerIdOrName.isBlank()) {
            trainer = userRepository.findById(trainerIdOrName)
                    .or(() -> userRepository.findByEmailIgnoreCase(trainerIdOrName))
                    .or(() -> userRepository.findByUsernameIgnoreCase(trainerIdOrName))
                    .or(() -> userRepository.findByNameIgnoreCase(trainerIdOrName).stream().findFirst())
                    .orElse(null);
        }

        String trainerId = trainer != null ? trainer.getId() : trainerIdOrName;
        String trainerName = trainer != null ? trainer.getName() : trainerIdOrName;
        String trainerEmail = trainer != null ? trainer.getEmail() : null;

        // 1. Batches assigned to this trainer (as teacher)
        List<Batch> allBatches = batchRepository.findAll();
        List<Batch> taughtBatches = allBatches.stream()
                .filter(b -> (b.getTrainerId() != null && b.getTrainerId().equals(trainerId))
                        || (b.getTrainerIds() != null && b.getTrainerIds().contains(trainerId))
                        || (trainerName != null && b.getTrainerName() != null && b.getTrainerName().equalsIgnoreCase(trainerName)))
                .toList();

        Set<String> taughtBatchIds = taughtBatches.stream().map(Batch::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> taughtBatchNames = taughtBatches.stream().map(Batch::getName).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());

        // 2. Courses assigned to this trainer (as teacher)
        List<Course> allCourses = courseRepository.findAll();
        List<Course> taughtCourses = allCourses.stream()
                .filter(c -> !"trainer".equalsIgnoreCase(c.getAudience())) // exclude trainer learner courses
                .filter(c -> (c.getTrainerId() != null && c.getTrainerId().equals(trainerId))
                        || (c.getAssignedTrainerId() != null && c.getAssignedTrainerId().equals(trainerId))
                        || (trainerName != null && c.getAssignedTrainer() != null && c.getAssignedTrainer().equalsIgnoreCase(trainerName))
                        || taughtBatches.stream().anyMatch(b -> b.getCourseId() != null && b.getCourseId().equals(c.getId())))
                .toList();

        Set<String> taughtCourseIds = taughtCourses.stream().map(Course::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> taughtCourseTitles = taughtCourses.stream().map(Course::getTitle).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());

        // 3. Distinct active students in batches/courses assigned to this trainer
        Set<String> distinctStudentIds = new HashSet<>();
        List<Enrollment> enrollments = enrollmentRepository.findAll();
        for (Enrollment e : enrollments) {
            if ("Inactive".equalsIgnoreCase(e.getStatus()) || "Dropped".equalsIgnoreCase(e.getStatus())) continue;
            if (trainerId != null && trainerId.equals(e.getStudentId())) continue;
            if (trainerEmail != null && trainerEmail.equalsIgnoreCase(e.getStudentEmail())) continue;

            boolean matchesBatch = (e.getBatchId() != null && taughtBatchIds.contains(e.getBatchId()))
                    || (e.getBatchName() != null && taughtBatchNames.contains(e.getBatchName().toLowerCase()));
            boolean matchesCourse = (e.getCourseId() != null && taughtCourseIds.contains(e.getCourseId()))
                    || (e.getCourseTitle() != null && taughtCourseTitles.contains(e.getCourseTitle().toLowerCase()));

            if (matchesBatch || matchesCourse) {
                if (e.getStudentId() != null && !e.getStudentId().isBlank()) {
                    distinctStudentIds.add(e.getStudentId());
                } else if (e.getStudentEmail() != null && !e.getStudentEmail().isBlank()) {
                    distinctStudentIds.add(e.getStudentEmail().toLowerCase());
                }
            }
        }

        List<StudentCourseBatch> scbs = studentCourseBatchRepository.findAll();
        for (StudentCourseBatch scb : scbs) {
            if (trainerId != null && trainerId.equals(scb.getStudentId())) continue;
            boolean matchesBatch = (scb.getBatchId() != null && taughtBatchIds.contains(scb.getBatchId()))
                    || (scb.getBatchName() != null && taughtBatchNames.contains(scb.getBatchName().toLowerCase()));
            boolean matchesCourse = (scb.getCourseId() != null && taughtCourseIds.contains(scb.getCourseId()));
            if (matchesBatch || matchesCourse) {
                if (scb.getStudentId() != null && !scb.getStudentId().isBlank()) {
                    distinctStudentIds.add(scb.getStudentId());
                }
            }
        }

        // 4. Schedules for this trainer
        List<Schedule> allSchedules = scheduleRepository.findAll();
        List<Schedule> trainerSchedules = allSchedules.stream()
                .filter(s -> (s.getTrainerId() != null && s.getTrainerId().equals(trainerId))
                        || (trainerName != null && s.getTrainer() != null && s.getTrainer().equalsIgnoreCase(trainerName))
                        || (s.getBatchId() != null && taughtBatchIds.contains(s.getBatchId())))
                .toList();

        String todayStr = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata().toLocalDate().toString();
        long todaySessions = trainerSchedules.stream()
                .filter(s -> s.getDate() != null && s.getDate().equals(todayStr))
                .count();

        long conductedClasses = trainerSchedules.stream()
                .filter(s -> "Completed".equalsIgnoreCase(s.getStatus()))
                .count();
        long totalClasses = trainerSchedules.size();

        // 5. Submissions (Pending Corrections vs Corrected)
        List<AssignmentSubmission> allSubmissions = assignmentSubmissionRepository.findAll();
        List<AssignmentSubmission> trainerSubmissions = allSubmissions.stream()
                .filter(s -> !"TRAINER".equalsIgnoreCase(s.getSubmitterRole()))
                .filter(s -> !(trainerId != null && trainerId.equals(s.getStudentId())))
                .filter(s -> (s.getTrainerId() != null && s.getTrainerId().equals(trainerId))
                        || (trainerName != null && s.getAssignedTrainer() != null && s.getAssignedTrainer().equalsIgnoreCase(trainerName))
                        || (s.getBatchId() != null && taughtBatchIds.contains(s.getBatchId()))
                        || (s.getBatchName() != null && taughtBatchNames.contains(s.getBatchName().toLowerCase())))
                .toList();

        long pendingCorrections = trainerSubmissions.stream()
                .filter(s -> s.getStatus() == null || s.getStatus().toLowerCase().contains("pending") || "submitted".equalsIgnoreCase(s.getStatus()))
                .count();
        long correctedAssignments = trainerSubmissions.stream()
                .filter(s -> s.getStatus() != null && (s.getStatus().toLowerCase().contains("corrected") || s.getStatus().toLowerCase().contains("graded") || s.getStatus().toLowerCase().contains("completed")))
                .count();
        long totalAssignments = trainerSubmissions.size();

        // 6. Doubts to Answer
        List<Doubt> allDoubts = doubtRepository.findAll();
        long doubtsToAnswer = allDoubts.stream()
                .filter(d -> (d.getTrainerId() != null && d.getTrainerId().equals(trainerId))
                        || (trainerName != null && d.getTrainerName() != null && d.getTrainerName().equalsIgnoreCase(trainerName))
                        || (d.getBatchId() != null && taughtBatchIds.contains(d.getBatchId())))
                .filter(d -> d.getStatus() == null || "pending".equalsIgnoreCase(d.getStatus()) || "open".equalsIgnoreCase(d.getStatus()))
                .count();

        // 7. Attendance & Performance
        List<AttendanceRecord> allAttendance = attendanceRecordRepository.findAll();
        Set<String> scheduleIdSet = trainerSchedules.stream().map(Schedule::getId).collect(Collectors.toSet());
        List<AttendanceRecord> relevantAtt = allAttendance.stream()
                .filter(r -> (r.getScheduleId() != null && scheduleIdSet.contains(r.getScheduleId()))
                        || (r.getBatchId() != null && taughtBatchIds.contains(r.getBatchId())))
                .toList();
        long presentCount = relevantAtt.stream().filter(r -> "PRESENT".equalsIgnoreCase(r.getStatus())).count();
        int attendanceRate = !relevantAtt.isEmpty()
                ? (int) Math.round(((double) presentCount / relevantAtt.size()) * 100)
                : (totalClasses > 0 ? (int) Math.round(((double) conductedClasses / totalClasses) * 100) : 0);

        int performancePercent = totalClasses > 0
                ? (int) Math.round(((double) conductedClasses / totalClasses) * 100)
                : (!relevantAtt.isEmpty() ? attendanceRate : 0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("todaySessions", todaySessions);
        stats.put("myStudents", distinctStudentIds.size());
        stats.put("batchCount", taughtBatches.size());
        stats.put("pendingCorrections", pendingCorrections);
        stats.put("doubtsToAnswer", doubtsToAnswer);
        stats.put("conductedClasses", conductedClasses);
        stats.put("totalClasses", totalClasses);
        stats.put("correctedAssignments", correctedAssignments);
        stats.put("totalAssignments", totalAssignments);
        stats.put("attendanceRate", attendanceRate);
        stats.put("performancePercent", performancePercent);
        stats.put("studentSatisfaction", 4.9);

        return stats;
    }
}
