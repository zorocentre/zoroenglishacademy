package com.zoroacademy.service;

import com.zoroacademy.entity.*;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CourseService {

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final CourseResourceRepository resourceRepository;
    private final UserRepository userRepository;
    private final BatchRepository batchRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final StudentCourseBatchRepository studentCourseBatchRepository;
    private final StudentFeeRepository studentFeeRepository;
    private final ScheduleRepository scheduleRepository;
    private final AssignmentRepository assignmentRepository;
    private final DoubtRepository doubtRepository;
    private final BunnyStreamService bunnyStreamService;
    private final FileStorageService fileStorageService;
    private final VideoRepository videoRepository;
    private final StudentProgressRepository studentProgressRepository;
    private final StudentModuleProgressRepository studentModuleProgressRepository;
    private final AssignmentSubmissionRepository submissionRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private TrainerCourseRequestRepository trainerCourseRequestRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    @org.springframework.beans.factory.annotation.Autowired
    public CourseService(CourseRepository courseRepository,
                         CourseModuleRepository moduleRepository,
                         CourseResourceRepository resourceRepository,
                         UserRepository userRepository,
                         BatchRepository batchRepository,
                         EnrollmentRepository enrollmentRepository,
                         StudentCourseBatchRepository studentCourseBatchRepository,
                         StudentFeeRepository studentFeeRepository,
                         ScheduleRepository scheduleRepository,
                         AssignmentRepository assignmentRepository,
                         DoubtRepository doubtRepository,
                         BunnyStreamService bunnyStreamService,
                         FileStorageService fileStorageService,
                         VideoRepository videoRepository,
                         StudentProgressRepository studentProgressRepository,
                         StudentModuleProgressRepository studentModuleProgressRepository,
                         @org.springframework.beans.factory.annotation.Autowired(required = false) AssignmentSubmissionRepository submissionRepository) {
        this.courseRepository = courseRepository;
        this.moduleRepository = moduleRepository;
        this.resourceRepository = resourceRepository;
        this.userRepository = userRepository;
        this.batchRepository = batchRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.studentCourseBatchRepository = studentCourseBatchRepository;
        this.studentFeeRepository = studentFeeRepository;
        this.scheduleRepository = scheduleRepository;
        this.assignmentRepository = assignmentRepository;
        this.doubtRepository = doubtRepository;
        this.bunnyStreamService = bunnyStreamService;
        this.fileStorageService = fileStorageService;
        this.videoRepository = videoRepository;
        this.studentProgressRepository = studentProgressRepository;
        this.studentModuleProgressRepository = studentModuleProgressRepository;
        this.submissionRepository = submissionRepository;
    }

    public CourseService(CourseRepository courseRepository,
                         CourseModuleRepository moduleRepository,
                         CourseResourceRepository resourceRepository,
                         UserRepository userRepository,
                         BatchRepository batchRepository,
                         EnrollmentRepository enrollmentRepository,
                         StudentCourseBatchRepository studentCourseBatchRepository,
                         StudentFeeRepository studentFeeRepository,
                         ScheduleRepository scheduleRepository,
                         AssignmentRepository assignmentRepository,
                         DoubtRepository doubtRepository,
                         BunnyStreamService bunnyStreamService,
                         FileStorageService fileStorageService,
                         VideoRepository videoRepository) {
        this(courseRepository, moduleRepository, resourceRepository, userRepository,
             batchRepository, enrollmentRepository, studentCourseBatchRepository,
             studentFeeRepository, scheduleRepository, assignmentRepository,
             doubtRepository, bunnyStreamService, fileStorageService, videoRepository,
             null, null, null);
    }

    @Transactional(readOnly = true)
    public List<Course> getAllCourses(String audience) {
        if (audience != null && !audience.isBlank()) {
            return courseRepository.findByAudienceIgnoreCase(audience);
        }
        return courseRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Course getCourseById(String idOrSlug) {
        return courseRepository.findById(idOrSlug)
                .or(() -> courseRepository.findBySlug(idOrSlug))
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + idOrSlug));
    }

    public Course sanitizeCourseForPublic(Course course) {
        if (course == null) return null;
        Course copy = new Course();
        copy.setId(course.getId());
        copy.setSlug(course.getSlug());
        copy.setTitle(course.getTitle());
        copy.setDescription(course.getDescription());
        copy.setCategory(course.getCategory());
        copy.setMode(course.getMode());
        copy.setLevel(course.getLevel());
        copy.setAudience(course.getAudience());
        copy.setDuration(course.getDuration());
        copy.setPrice(course.getPrice());
        copy.setOriginalPrice(course.getOriginalPrice());
        copy.setThumbnail(course.getThumbnail());
        copy.setPreviewVideoUrl(course.getPreviewVideoUrl());
        copy.setEnrolled(course.getEnrolled());
        copy.setRating(course.getRating());
        copy.setStatus(course.getStatus());
        copy.setAssignedTrainer(course.getAssignedTrainer());
        copy.setTrainerId(course.getTrainerId());
        copy.setAssignedTrainerId(course.getAssignedTrainerId());
        copy.setGoogleMeetUrl(null);
        copy.setCreatedAt(course.getCreatedAt());
        copy.setUpdatedAt(course.getUpdatedAt());
        copy.setRequestStatus(course.getRequestStatus());

        if (course.getModules() != null) {
            java.util.List<CourseModule> sorted = new java.util.ArrayList<>(course.getModules());
            sorted.sort(java.util.Comparator.comparing(
                CourseModule::getModuleOrder,
                java.util.Comparator.nullsLast(Integer::compareTo)
            ));
            java.util.List<CourseModule> safeModules = new java.util.ArrayList<>();
            for (CourseModule m : sorted) {
                CourseModule sm = new CourseModule();
                sm.setId(m.getId());
                sm.setModuleOrder(m.getModuleOrder());
                sm.setTitle(m.getTitle());
                sm.setDescription(m.getDescription());
                sm.setDuration(m.getDuration());
                sm.setThumbnailUrl(m.getThumbnailUrl());
                sm.setVideoStorageRef(null);
                sm.setNotesFileUrl(null);
                sm.setNotesFileName(null);
                sm.setWorksheetFileUrl(null);
                sm.setWorksheetFileName(null);
                sm.setAssignmentFileUrl(null);
                sm.setAssignmentFileName(null);
                sm.setCreatedAt(m.getCreatedAt());
                sm.setUpdatedAt(m.getUpdatedAt());
                safeModules.add(sm);
            }
            copy.setModules(safeModules);
        } else {
            copy.setModules(new java.util.ArrayList<>());
        }
        copy.setResources(new java.util.ArrayList<>());
        return copy;
    }

    private boolean isModuleCompleted(CourseModule m, String courseId, String studentId, String studentEmail) {
        String effectiveStudentId = studentId;
        String effectiveEmail = studentEmail;
        if (effectiveStudentId != null && effectiveStudentId.contains("@") && effectiveEmail == null) {
            effectiveEmail = effectiveStudentId;
        }
        if ((effectiveStudentId == null || effectiveStudentId.contains("@")) && effectiveEmail != null && userRepository != null) {
            effectiveStudentId = userRepository.findByEmailIgnoreCase(effectiveEmail)
                    .map(com.zoroacademy.entity.User::getId)
                    .orElse(effectiveStudentId);
        }

        boolean hasVideo = (m.getVideoStorageRef() != null && !m.getVideoStorageRef().isBlank() && !"null".equalsIgnoreCase(m.getVideoStorageRef().trim()) && !"{}".equals(m.getVideoStorageRef().trim()))
                || (videoRepository != null && !videoRepository.findByModuleId(m.getId()).isEmpty());

        boolean videoDone = !hasVideo;
        if (hasVideo) {
            if (effectiveStudentId != null && studentModuleProgressRepository != null) {
                java.util.Optional<com.zoroacademy.entity.StudentModuleProgress> smpOpt = studentModuleProgressRepository.findByStudentIdAndModuleId(effectiveStudentId, m.getId());
                if (smpOpt.isPresent()) {
                    com.zoroacademy.entity.StudentModuleProgress smp = smpOpt.get();
                    if (Boolean.TRUE.equals(smp.getVideoCompleted()) || Boolean.TRUE.equals(smp.getCompleted())) {
                        videoDone = true;
                    } else if (smp.getWatchedSeconds() != null && smp.getDurationSeconds() != null && smp.getDurationSeconds() > 0) {
                        int threshold = (int) Math.ceil(smp.getDurationSeconds() * 0.95);
                        if (smp.getWatchedSeconds() >= threshold) {
                            videoDone = true;
                        }
                    }
                }
            }
            if (!videoDone && effectiveStudentId != null && studentProgressRepository != null) {
                videoDone = studentProgressRepository.findByStudentIdIgnoreCaseAndCourseIdAndModuleId(effectiveStudentId, courseId, m.getId())
                        .map(sp -> "Completed".equalsIgnoreCase(sp.getStatus())).orElse(false);
            }
            if (!videoDone && effectiveEmail != null && studentProgressRepository != null) {
                videoDone = studentProgressRepository.findByStudentIdIgnoreCaseAndCourseIdAndModuleId(effectiveEmail, courseId, m.getId())
                        .map(sp -> "Completed".equalsIgnoreCase(sp.getStatus())).orElse(false);
            }
        }

        boolean hasAssignment = (m.getAssignmentFileUrl() != null && !m.getAssignmentFileUrl().isBlank())
                || (m.getAssignmentFileName() != null && !m.getAssignmentFileName().isBlank());

        boolean assignmentDone = !hasAssignment;
        if (hasAssignment) {
            if (submissionRepository != null) {
                if (effectiveStudentId != null && !submissionRepository.findBySourceTypeAndSourceIdAndStudentId("module", m.getId(), effectiveStudentId).isEmpty()) {
                    assignmentDone = true;
                }
                if (!assignmentDone && effectiveEmail != null && !submissionRepository.findBySourceTypeAndSourceIdAndStudentEmailIgnoreCase("module", m.getId(), effectiveEmail).isEmpty()) {
                    assignmentDone = true;
                }
            }
        }

        return videoDone && assignmentDone;
    }

    public boolean isModuleLockedForStudent(String courseId, String moduleId, String studentId, String studentEmail) {
        if (moduleId == null || courseId == null) return false;
        java.util.List<CourseModule> modules = moduleRepository.findByCourseIdOrderByModuleOrderAsc(courseId);
        if (modules == null || modules.isEmpty()) return false;

        // Module 1 (index 0) is always unlocked
        if (modules.get(0).getId().equals(moduleId)) {
            return false;
        }

        boolean prevCompleted = true;
        for (int i = 0; i < modules.size(); i++) {
            CourseModule m = modules.get(i);
            if (m.getId().equals(moduleId)) {
                return !prevCompleted;
            }

            if (!isModuleCompleted(m, courseId, studentId, studentEmail)) {
                prevCompleted = false;
            }

            if (!prevCompleted) {
                return true;
            }
        }
        return false;
    }

    public Course getCourseForStudent(String idOrSlug, String studentId, String studentEmail) {
        Course course = getCourseById(idOrSlug);
        Course copy = new Course();
        copy.setId(course.getId());
        copy.setSlug(course.getSlug());
        copy.setTitle(course.getTitle());
        copy.setDescription(course.getDescription());
        copy.setCategory(course.getCategory());
        copy.setMode(course.getMode());
        copy.setLevel(course.getLevel());
        copy.setAudience(course.getAudience());
        copy.setDuration(course.getDuration());
        copy.setPrice(course.getPrice());
        copy.setOriginalPrice(course.getOriginalPrice());
        copy.setThumbnail(course.getThumbnail());
        copy.setPreviewVideoUrl(course.getPreviewVideoUrl());
        copy.setEnrolled(course.getEnrolled());
        copy.setRating(course.getRating());
        copy.setStatus(course.getStatus());
        copy.setAssignedTrainer(course.getAssignedTrainer());
        copy.setTrainerId(course.getTrainerId());
        copy.setAssignedTrainerId(course.getAssignedTrainerId());
        copy.setGoogleMeetUrl(course.getGoogleMeetUrl());
        copy.setCreatedAt(course.getCreatedAt());
        copy.setUpdatedAt(course.getUpdatedAt());
        copy.setResources(course.getResources() != null ? new java.util.ArrayList<>(course.getResources()) : new java.util.ArrayList<>());

        if (course.getModules() != null) {
            java.util.List<CourseModule> sorted = new java.util.ArrayList<>(course.getModules());
            sorted.sort(java.util.Comparator.comparing(
                    CourseModule::getModuleOrder,
                    java.util.Comparator.nullsLast(Integer::compareTo)
            ));

            java.util.List<CourseModule> resultModules = new java.util.ArrayList<>();
            boolean prevCompleted = true;

            for (int i = 0; i < sorted.size(); i++) {
                CourseModule orig = sorted.get(i);
                CourseModule m = new CourseModule();
                m.setId(orig.getId());
                m.setModuleOrder(orig.getModuleOrder());
                m.setTitle(orig.getTitle());
                m.setDescription(orig.getDescription());
                m.setDuration(orig.getDuration());
                m.setThumbnailUrl(orig.getThumbnailUrl());
                m.setCreatedAt(orig.getCreatedAt());
                m.setUpdatedAt(orig.getUpdatedAt());

                boolean isLocked = (i == 0) ? false : !prevCompleted;
                m.setLocked(isLocked);

                if (isLocked) {
                    // Never leak file URLs or video storage refs of locked modules
                    m.setNotesFileUrl(null);
                    m.setNotesFileName(null);
                    m.setWorksheetFileUrl(null);
                    m.setWorksheetFileName(null);
                    m.setAssignmentFileUrl(null);
                    m.setAssignmentFileName(null);
                    m.setVideoStorageRef(null);
                } else {
                    m.setNotesFileUrl(orig.getNotesFileUrl());
                    m.setNotesFileName(orig.getNotesFileName());
                    m.setWorksheetFileUrl(orig.getWorksheetFileUrl());
                    m.setWorksheetFileName(orig.getWorksheetFileName());
                    m.setAssignmentFileUrl(orig.getAssignmentFileUrl());
                    m.setAssignmentFileName(orig.getAssignmentFileName());
                    m.setVideoStorageRef(orig.getVideoStorageRef());

                    // Check if current unlocked module is completed for next module's unlock
                    if (!isModuleCompleted(orig, course.getId(), studentId, studentEmail)) {
                        prevCompleted = false;
                    }
                }
                resultModules.add(m);
            }
            copy.setModules(resultModules);
        } else {
            copy.setModules(new java.util.ArrayList<>());
        }
        return copy;
    }

    public CourseModule getModuleForUser(String courseId, String moduleId, String userId, String userEmail, String userRole) {
        CourseModule module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new IllegalArgumentException("Module not found: " + moduleId));

        Course course = courseRepository.findById(courseId).orElse(null);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(userRole) || "SUPER_ADMIN".equalsIgnoreCase(userRole);
        if (!isAdmin) {
            if (isModuleLockedForStudent(courseId, moduleId, userId, userEmail)) {
                throw new org.springframework.security.access.AccessDeniedException("Module is locked. Complete previous module assignment to unlock.");
            }
        }
        module.setLocked(false);
        return module;
    }

    private String generateUniqueSlug(String titleOrSlug, String currentCourseId) {
        if (titleOrSlug == null || titleOrSlug.isBlank()) {
            return "course-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        }
        String baseSlug = titleOrSlug.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (baseSlug.isBlank()) {
            baseSlug = "course-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        }
        String candidate = baseSlug;
        int counter = 1;
        while (true) {
            java.util.Optional<Course> existing = courseRepository.findBySlug(candidate);
            if (existing.isEmpty() || (currentCourseId != null && existing.get().getId().equals(currentCourseId))) {
                return candidate;
            }
            counter++;
            candidate = baseSlug + "-" + counter;
        }
    }

    public static String normalizeMeetUrl(String url) {
        if (url == null || url.isBlank()) return null;
        String trimmed = url.trim();
        if (!trimmed.toLowerCase().startsWith("http://") && !trimmed.toLowerCase().startsWith("https://")) {
            trimmed = "https://" + trimmed;
        } else if (trimmed.toLowerCase().startsWith("http://")) {
            trimmed = "https://" + trimmed.substring(7);
        }
        return trimmed;
    }

    public static boolean isValidGoogleMeetUrl(String url) {
        if (url == null || url.isBlank()) return false;
        String normalized = normalizeMeetUrl(url);
        if (normalized == null) return false;
        String lower = normalized.toLowerCase();
        if (lower.contains("meet.google.com/new") || lower.contains("meet.google.com/zoro-live-class")) {
            return false;
        }
        return lower.contains("meet.google.com/") && normalized.matches("(?i)^https:\\/\\/meet\\.google\\.com\\/[a-zA-Z0-9_-]+(\\/)?(\\?.*)?$");
    }

    private void updateFutureSchedulesMeetLink(String courseId, String meetUrl) {
        if (scheduleRepository == null || courseId == null) return;
        java.util.List<Schedule> schedules = scheduleRepository.findAll();
        java.time.ZonedDateTime now = com.zoroacademy.util.ScheduleTimeUtil.nowInKolkata();
        for (Schedule s : schedules) {
            if (courseId.equals(s.getCourseId())) {
                boolean isFinished = com.zoroacademy.util.ScheduleTimeUtil.isSessionFinished(s.getDate(), s.getTime(), now);
                if (!isFinished) {
                    s.setMeetLink(meetUrl);
                    scheduleRepository.save(s);
                }
            }
        }
    }

    @Transactional
    public Course createCourse(Course course) {
        if (course.getId() == null || course.getId().isBlank()) {
            course.setId("crs_" + java.util.UUID.randomUUID());
        }

        if (course.getSlug() == null || course.getSlug().isBlank()) {
            course.setSlug(generateUniqueSlug(course.getTitle(), null));
        } else {
            course.setSlug(generateUniqueSlug(course.getSlug(), null));
        }

        String mode = course.getMode() != null ? course.getMode() : "Online";
        if ("Online".equalsIgnoreCase(mode) || "Hybrid".equalsIgnoreCase(mode)) {
            String meetUrl = course.getGoogleMeetUrl();
            if (meetUrl == null || meetUrl.isBlank()) {
                throw new IllegalArgumentException("Google Meet URL is required for " + mode + " courses");
            }
            String normalized = normalizeMeetUrl(meetUrl);
            if (!isValidGoogleMeetUrl(normalized)) {
                throw new IllegalArgumentException("Invalid Google Meet URL. Must be a valid Meet link like https://meet.google.com/xxx-xxxx-xxx");
            }
            course.setGoogleMeetUrl(normalized);
            // Online and Hybrid courses do NOT have a course-level trainer; only the batch has trainers
            course.setTrainerId(null);
            course.setAssignedTrainer(null);
            course.setAssignedTrainerId(null);
        } else {
            course.setGoogleMeetUrl(null);
            String audience = course.getAudience() != null ? course.getAudience().trim().toLowerCase() : "student";
            if ("trainer".equals(audience)) {
                // Trainer-audience recorded courses: trainer is fixed to "Admin"
                String adminId = userRepository.findByRoleIgnoreCase("ADMIN").stream().findFirst().map(User::getId).orElse("usr_admin_001");
                course.setTrainerId(adminId);
                course.setAssignedTrainer("Admin");
                course.setAssignedTrainerId(adminId);
            } else {
                // Student-audience recorded courses: trainer is REQUIRED
                String tId = course.getTrainerId() != null && !course.getTrainerId().isBlank() 
                        ? course.getTrainerId() 
                        : (course.getAssignedTrainerId() != null && !course.getAssignedTrainerId().isBlank() ? course.getAssignedTrainerId() : null);
                String tName = course.getAssignedTrainer() != null && !course.getAssignedTrainer().isBlank() && !"None (Self-Paced)".equalsIgnoreCase(course.getAssignedTrainer()) && !"Unassigned".equalsIgnoreCase(course.getAssignedTrainer())
                        ? course.getAssignedTrainer()
                        : null;

                if (tId == null && tName == null) {
                    throw new IllegalArgumentException("Trainer is required for Student Recorded courses (Instructor-Led).");
                }

                if (tId != null) {
                    course.setTrainerId(tId);
                    course.setAssignedTrainerId(tId);
                    userRepository.findById(tId).ifPresent(u -> course.setAssignedTrainer(u.getName()));
                } else {
                    course.setAssignedTrainer(tName);
                    userRepository.findByNameIgnoreCase(tName).stream()
                            .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                            .findFirst()
                            .ifPresent(u -> {
                                course.setTrainerId(u.getId());
                                course.setAssignedTrainerId(u.getId());
                            });
                }
            }
        }

        if (course.getModules() != null) {
            course.getModules().forEach(m -> {
                if (m.getId() == null || m.getId().isBlank()) {
                    m.setId("mod_" + java.util.UUID.randomUUID());
                }
                m.setCourse(course);
            });
        }
        if (course.getResources() != null) {
            course.getResources().forEach(r -> {
                if (r.getId() == null || r.getId().isBlank()) {
                    r.setId("res_" + java.util.UUID.randomUUID());
                }
                r.setCourse(course);
            });
        }
        return courseRepository.save(course);
    }

    @Transactional
    public Course updateCourse(String id, Course updated) {
        final Course targetCourse = getCourseById(id);
        String oldTitle = targetCourse.getTitle();

        if (updated.getTitle() != null) targetCourse.setTitle(updated.getTitle());
        if (updated.getDescription() != null) targetCourse.setDescription(updated.getDescription());
        if (updated.getCategory() != null) targetCourse.setCategory(updated.getCategory());
        if (updated.getMode() != null) targetCourse.setMode(updated.getMode());
        if (updated.getLevel() != null) targetCourse.setLevel(updated.getLevel());
        if (updated.getAudience() != null) targetCourse.setAudience(updated.getAudience());
        if (updated.getDuration() != null) targetCourse.setDuration(updated.getDuration());
        if (updated.getPrice() != null) targetCourse.setPrice(updated.getPrice());
        if (updated.getOriginalPrice() != null) targetCourse.setOriginalPrice(updated.getOriginalPrice());
        if (updated.getThumbnail() != null) targetCourse.setThumbnail(updated.getThumbnail());
        if (updated.getPreviewVideoUrl() != null) targetCourse.setPreviewVideoUrl(updated.getPreviewVideoUrl());
        if (updated.getEnrolled() != null) targetCourse.setEnrolled(updated.getEnrolled());
        if (updated.getRating() != null) targetCourse.setRating(updated.getRating());
        if (updated.getStatus() != null) targetCourse.setStatus(updated.getStatus());

        String effectiveMode = updated.getMode() != null ? updated.getMode() : targetCourse.getMode();
        if ("Online".equalsIgnoreCase(effectiveMode) || "Hybrid".equalsIgnoreCase(effectiveMode)) {
            String meetUrl = updated.getGoogleMeetUrl() != null ? updated.getGoogleMeetUrl() : targetCourse.getGoogleMeetUrl();
            if (meetUrl == null || meetUrl.isBlank()) {
                throw new IllegalArgumentException("Google Meet URL is required for " + effectiveMode + " courses");
            }
            String normalized = normalizeMeetUrl(meetUrl);
            if (!isValidGoogleMeetUrl(normalized)) {
                throw new IllegalArgumentException("Invalid Google Meet URL. Must be a valid Meet link like https://meet.google.com/xxx-xxxx-xxx");
            }
            String oldMeet = targetCourse.getGoogleMeetUrl();
            targetCourse.setGoogleMeetUrl(normalized);
            if (oldMeet == null || !oldMeet.equals(normalized)) {
                updateFutureSchedulesMeetLink(targetCourse.getId(), normalized);
            }
        } else if ("Recorded".equalsIgnoreCase(effectiveMode)) {
            targetCourse.setGoogleMeetUrl(null);
        }

        if (updated.getSlug() != null && !updated.getSlug().isBlank()) {
            targetCourse.setSlug(generateUniqueSlug(updated.getSlug(), targetCourse.getId()));
        } else if (updated.getTitle() != null && !updated.getTitle().equalsIgnoreCase(oldTitle)) {
            targetCourse.setSlug(generateUniqueSlug(targetCourse.getTitle(), targetCourse.getId()));
        } else if (targetCourse.getSlug() == null || targetCourse.getSlug().isBlank()) {
            targetCourse.setSlug(generateUniqueSlug(targetCourse.getTitle(), targetCourse.getId()));
        }

        if ("Online".equalsIgnoreCase(effectiveMode) || "Hybrid".equalsIgnoreCase(effectiveMode)) {
            targetCourse.setTrainerId(null);
            targetCourse.setAssignedTrainer(null);
            targetCourse.setAssignedTrainerId(null);
        } else {
            String audience = targetCourse.getAudience() != null ? targetCourse.getAudience().trim().toLowerCase() : "student";
            if ("trainer".equals(audience)) {
                String adminId = userRepository.findByRoleIgnoreCase("ADMIN").stream().findFirst().map(User::getId).orElse("usr_admin_001");
                targetCourse.setTrainerId(adminId);
                targetCourse.setAssignedTrainer("Admin");
                targetCourse.setAssignedTrainerId(adminId);
            } else {
                // Student-audience recorded course: trainer is REQUIRED
                String tId = updated.getTrainerId() != null && !updated.getTrainerId().isBlank()
                        ? updated.getTrainerId()
                        : (updated.getAssignedTrainerId() != null && !updated.getAssignedTrainerId().isBlank() 
                            ? updated.getAssignedTrainerId() 
                            : targetCourse.getTrainerId());
                String tName = updated.getAssignedTrainer() != null && !updated.getAssignedTrainer().isBlank() && !"None (Self-Paced)".equalsIgnoreCase(updated.getAssignedTrainer()) && !"Unassigned".equalsIgnoreCase(updated.getAssignedTrainer())
                        ? updated.getAssignedTrainer()
                        : (targetCourse.getAssignedTrainer() != null && !"None (Self-Paced)".equalsIgnoreCase(targetCourse.getAssignedTrainer()) && !"Unassigned".equalsIgnoreCase(targetCourse.getAssignedTrainer()) ? targetCourse.getAssignedTrainer() : null);

                if (tId == null && tName == null) {
                    throw new IllegalArgumentException("Trainer is required for Student Recorded courses (Instructor-Led).");
                }

                if (tId != null) {
                    targetCourse.setTrainerId(tId);
                    targetCourse.setAssignedTrainerId(tId);
                    userRepository.findById(tId).ifPresent(u -> targetCourse.setAssignedTrainer(u.getName()));
                } else {
                    targetCourse.setAssignedTrainer(tName);
                    userRepository.findByNameIgnoreCase(tName).stream()
                            .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                            .findFirst()
                            .ifPresent(u -> {
                                targetCourse.setTrainerId(u.getId());
                                targetCourse.setAssignedTrainerId(u.getId());
                            });
                }
            }
        }

        Course savedCourse = courseRepository.save(targetCourse);

        // Propagate renamed course title to related records
        if (updated.getTitle() != null && !updated.getTitle().equalsIgnoreCase(oldTitle)) {
            String newTitle = updated.getTitle();
            String cId = savedCourse.getId();

            for (Batch b : batchRepository.findByCourseId(cId)) {
                b.setCourseName(newTitle);
                batchRepository.save(b);
            }
            for (Enrollment e : enrollmentRepository.findByCourseId(cId)) {
                e.setCourseTitle(newTitle);
                enrollmentRepository.save(e);
            }
            for (StudentCourseBatch scb : studentCourseBatchRepository.findByCourseId(cId)) {
                scb.setCourseName(newTitle);
                studentCourseBatchRepository.save(scb);
            }
            for (StudentFee f : studentFeeRepository.findByCourseId(cId)) {
                f.setCourse(newTitle);
                studentFeeRepository.save(f);
            }
            for (Schedule s : scheduleRepository.findByCourseId(cId)) {
                s.setCourse(newTitle);
                scheduleRepository.save(s);
            }
            for (Assignment a : assignmentRepository.findByCourseId(cId)) {
                a.setCourse(newTitle);
                assignmentRepository.save(a);
            }
            for (Doubt d : doubtRepository.findByCourseId(cId)) {
                d.setCourseTitle(newTitle);
                doubtRepository.save(d);
            }
        }

        return savedCourse;
    }

    private void purgeVideo(String videoId) {
        if (videoId == null || videoId.isBlank()) return;
        try {
            if (eventPublisher != null) {
                eventPublisher.publishEvent(new com.zoroacademy.event.StorageVideoPurgeEvent(videoId));
            } else {
                bunnyStreamService.deleteVideo(videoId);
            }
        } catch (Exception ignored) {}
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

    private void cleanupModuleFilesAndVideos(CourseModule module) {
        if (module == null) return;
        java.util.Set<String> deletedVideoIds = new java.util.HashSet<>();
        List<Video> videos = videoRepository.findByModuleId(module.getId());
        for (Video v : videos) {
            if (deletedVideoIds.add(v.getBunnyVideoId())) {
                purgeVideo(v.getBunnyVideoId());
            }
        }
        if (module.getVideoStorageRef() != null) {
            try {
                com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(module.getVideoStorageRef());
                if (node.has("videoId")) {
                    String vid = node.get("videoId").asText();
                    if (deletedVideoIds.add(vid)) {
                        purgeVideo(vid);
                    }
                }
            } catch (Exception ignored) {}
            cleanupStoredFilesFromText(module.getVideoStorageRef());
        }
        cleanupStoredFilesFromText(module.getThumbnailUrl());
        cleanupStoredFilesFromText(module.getNotesFileUrl());
        cleanupStoredFilesFromText(module.getWorksheetFileUrl());
        cleanupStoredFilesFromText(module.getAssignmentFileUrl());
    }

    @Transactional(readOnly = true)
    public com.zoroacademy.dto.DeletionImpactDto getCourseDeletionImpact(String id) {
        Course course = courseRepository.findById(id)
                .or(() -> courseRepository.findBySlug(id))
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + id));

        boolean canDelete = true;
        List<String> blockingReasons = new ArrayList<>();
        Map<String, Long> counts = new HashMap<>();
        Map<String, List<String>> names = new HashMap<>();

        // Trainer audience courses: check approved trainer access
        if ("trainer".equalsIgnoreCase(course.getAudience())) {
            List<TrainerCourseRequest> approvedReqs = trainerCourseRequestRepository != null
                    ? trainerCourseRequestRepository.findByCourseId(course.getId()).stream()
                        .filter(r -> "Approved".equalsIgnoreCase(r.getStatus()))
                        .toList()
                    : Collections.emptyList();
            counts.put("assignedTrainers", (long) approvedReqs.size());
            List<String> trainerNames = approvedReqs.stream()
                    .map(r -> r.getTrainerName() != null && !r.getTrainerName().isBlank() ? r.getTrainerName() : r.getTrainerEmail())
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            names.put("trainers", trainerNames);

            if (!approvedReqs.isEmpty()) {
                canDelete = false;
                blockingReasons.add("Trainers are assigned to this course. Remove their access first, then delete the course.");
            }
        } else {
            // Student audience courses: no active enrollments or batches
            List<Enrollment> activeEnrs = enrollmentRepository.findByCourseId(course.getId()).stream()
                    .filter(e -> "Active".equalsIgnoreCase(e.getStatus()))
                    .toList();
            counts.put("activeEnrollments", (long) activeEnrs.size());
            if (!activeEnrs.isEmpty()) {
                canDelete = false;
                blockingReasons.add("Course has " + activeEnrs.size() + " active student enrollment(s). Remove their access first, then delete the course.");
            }

            List<Batch> batches = batchRepository.findByCourseId(course.getId());
            counts.put("batches", (long) batches.size());
            List<String> batchNames = batches.stream().map(Batch::getName).filter(Objects::nonNull).toList();
            names.put("batches", batchNames);
            if (!batches.isEmpty()) {
                canDelete = false;
                blockingReasons.add("Course is assigned to active batch(es): " + String.join(", ", batchNames) + ". Reassign or delete batches first, then delete the course.");
            }

            if (course.getTrainerId() != null && !course.getTrainerId().isBlank()) {
                canDelete = false;
                String tName = course.getAssignedTrainer() != null ? course.getAssignedTrainer() : "assigned trainer";
                blockingReasons.add("Trainer " + tName + " is assigned to this course. Remove their access first, then delete the course.");
            }
        }

        return new com.zoroacademy.dto.DeletionImpactDto(canDelete, blockingReasons, counts, names);
    }

    @Transactional
    public void deleteCourse(String id) {
        com.zoroacademy.dto.DeletionImpactDto impact = getCourseDeletionImpact(id);
        if (!impact.isCanDelete()) {
            throw new ConflictException(String.join(" ", impact.getBlockingReasons()));
        }

        Course course = courseRepository.findById(id)
                .or(() -> courseRepository.findBySlug(id))
                .orElse(null);

        if (course != null) {
            String courseId = course.getId();

            // Pending and Rejected trainer requests are not access: delete them in the same transaction as the course
            if (trainerCourseRequestRepository != null) {
                List<TrainerCourseRequest> requests = trainerCourseRequestRepository.findByCourseId(courseId);
                if (requests != null && !requests.isEmpty()) {
                    trainerCourseRequestRepository.deleteAll(requests);
                }
            }

            if (course.getModules() != null) {
                for (CourseModule m : course.getModules()) {
                    cleanupModuleFilesAndVideos(m);
                }
            }
            List<Video> courseVideos = videoRepository.findByCourseId(courseId);
            for (Video v : courseVideos) {
                purgeVideo(v.getBunnyVideoId());
            }
            cleanupStoredFilesFromText(course.getThumbnail());
            cleanupStoredFilesFromText(course.getPreviewVideoUrl());
            courseRepository.delete(course);
        }
    }

    @Transactional
    public CourseModule addModule(String courseId, CourseModule module) {
        Course course = getCourseById(courseId);
        if (module.getId() == null || module.getId().isBlank()) {
            module.setId("mod_" + UUID.randomUUID());
        }
        module.setCourse(course);

        // Requirement A2.1: A new module is appended at max(module_order)+1, computed on the backend.
        List<CourseModule> existingModules = moduleRepository.findByCourseIdOrderByModuleOrderAsc(courseId);
        int maxOrder = existingModules.stream()
                .map(CourseModule::getModuleOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0);
        module.setModuleOrder(maxOrder + 1);

        CourseModule saved = moduleRepository.save(module);

        if (saved.getVideoStorageRef() != null) {
            try {
                com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(saved.getVideoStorageRef());
                if (node.has("videoId")) {
                    String vid = node.get("videoId").asText();
                    videoRepository.findById(vid).or(() -> videoRepository.findByBunnyVideoId(vid)).ifPresent(v -> {
                        v.setCourseId(courseId);
                        v.setModuleId(saved.getId());
                        videoRepository.save(v);
                    });
                }
            } catch (Exception ignored) {}
        }

        return saved;
    }

    @Transactional
    public CourseModule updateModule(String courseId, String moduleId, CourseModule updated) {
        CourseModule existing = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new IllegalArgumentException("Module not found: " + moduleId));

        if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getDuration() != null) existing.setDuration(updated.getDuration());

        if (updated.getVideoStorageRef() != null) {
            // If replacing video, delete previous video if it changed
            String oldRef = existing.getVideoStorageRef();
            if (oldRef != null && !oldRef.equals(updated.getVideoStorageRef())) {
                try {
                    com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(oldRef);
                    if (node.has("videoId")) {
                        purgeVideo(node.get("videoId").asText());
                    }
                } catch (Exception ignored) {}
            }
            existing.setVideoStorageRef(updated.getVideoStorageRef());

            try {
                com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(updated.getVideoStorageRef());
                if (node.has("videoId")) {
                    String vid = node.get("videoId").asText();
                    videoRepository.findById(vid).or(() -> videoRepository.findByBunnyVideoId(vid)).ifPresent(v -> {
                        v.setCourseId(courseId);
                        v.setModuleId(moduleId);
                        videoRepository.save(v);
                    });
                }
            } catch (Exception ignored) {}
        }

        if (updated.getThumbnailUrl() != null) {
            if (existing.getThumbnailUrl() != null && !existing.getThumbnailUrl().equals(updated.getThumbnailUrl())) {
                cleanupStoredFilesFromText(existing.getThumbnailUrl());
            }
            existing.setThumbnailUrl(updated.getThumbnailUrl().isBlank() ? null : updated.getThumbnailUrl());
        }

        if (updated.getNotesFileUrl() != null) {
            if (existing.getNotesFileUrl() != null && !existing.getNotesFileUrl().equals(updated.getNotesFileUrl())) {
                cleanupStoredFilesFromText(existing.getNotesFileUrl());
            }
            existing.setNotesFileUrl(updated.getNotesFileUrl().isBlank() ? null : updated.getNotesFileUrl());
            existing.setNotesFileName(updated.getNotesFileName());
        } else if (updated.getNotesFileName() != null) {
            existing.setNotesFileName(updated.getNotesFileName());
        }

        if (updated.getWorksheetFileUrl() != null) {
            if (existing.getWorksheetFileUrl() != null && !existing.getWorksheetFileUrl().equals(updated.getWorksheetFileUrl())) {
                cleanupStoredFilesFromText(existing.getWorksheetFileUrl());
            }
            existing.setWorksheetFileUrl(updated.getWorksheetFileUrl().isBlank() ? null : updated.getWorksheetFileUrl());
            existing.setWorksheetFileName(updated.getWorksheetFileName());
        } else if (updated.getWorksheetFileName() != null) {
            existing.setWorksheetFileName(updated.getWorksheetFileName());
        }

        if (updated.getAssignmentFileUrl() != null) {
            if (existing.getAssignmentFileUrl() != null && !existing.getAssignmentFileUrl().equals(updated.getAssignmentFileUrl())) {
                cleanupStoredFilesFromText(existing.getAssignmentFileUrl());
            }
            existing.setAssignmentFileUrl(updated.getAssignmentFileUrl().isBlank() ? null : updated.getAssignmentFileUrl());
            existing.setAssignmentFileName(updated.getAssignmentFileName());
        } else if (updated.getAssignmentFileName() != null) {
            existing.setAssignmentFileName(updated.getAssignmentFileName());
        }

        return moduleRepository.save(existing);
    }

    @Transactional
    public void deleteModule(String courseId, String moduleId) {
        CourseModule module = moduleRepository.findById(moduleId).orElse(null);
        if (module != null) {
            cleanupModuleFilesAndVideos(module);
            moduleRepository.delete(module);
            moduleRepository.flush();

            // Requirement A2.5: When a module is deleted, re-compact the orders to 1..n in the same transaction.
            List<CourseModule> remaining = moduleRepository.findByCourseIdOrderByModuleOrderAsc(courseId);
            for (int i = 0; i < remaining.size(); i++) {
                CourseModule m = remaining.get(i);
                m.setModuleOrder(i + 1);
                moduleRepository.save(m);
            }
        }
    }

    @Transactional
    public List<CourseModule> reorderModules(String courseId, List<String> moduleIds) {
        if (moduleIds == null) {
            throw new BadRequestException("Module IDs list cannot be null");
        }
        // Validate course exists
        getCourseById(courseId);

        List<CourseModule> currentModules = moduleRepository.findByCourseIdOrderByModuleOrderAsc(courseId);
        if (currentModules.size() != moduleIds.size()) {
            throw new BadRequestException("Reorder module IDs count (" + moduleIds.size() + ") does not match current course module count (" + currentModules.size() + ")");
        }

        Set<String> currentIds = currentModules.stream().map(CourseModule::getId).collect(Collectors.toSet());
        Set<String> requestIds = new HashSet<>(moduleIds);
        if (requestIds.size() != moduleIds.size()) {
            throw new BadRequestException("Reorder list contains duplicate module IDs");
        }
        if (!currentIds.equals(requestIds)) {
            throw new BadRequestException("All module IDs must belong to the specified course");
        }

        Map<String, CourseModule> moduleMap = currentModules.stream()
                .collect(Collectors.toMap(CourseModule::getId, m -> m));

        List<CourseModule> updated = new ArrayList<>();
        for (int i = 0; i < moduleIds.size(); i++) {
            CourseModule m = moduleMap.get(moduleIds.get(i));
            m.setModuleOrder(i + 1);
            updated.add(moduleRepository.save(m));
        }
        return updated;
    }

    @Transactional
    public CourseResource addResource(String courseId, CourseResource resource) {
        Course course = getCourseById(courseId);
        if (resource.getId() == null || resource.getId().isBlank()) {
            resource.setId("res_" + UUID.randomUUID());
        }
        resource.setCourse(course);
        return resourceRepository.save(resource);
    }

    @Transactional
    public void deleteResource(String courseId, String resourceId) {
        resourceRepository.deleteById(resourceId);
    }

    @Transactional
    public void deleteResource(String resourceId) {
        resourceRepository.deleteById(resourceId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStudentsForCourse(String courseId) {
        Course course = getCourseById(courseId);
        int totalModules = (course.getModules() != null) ? course.getModules().size() : 0;

        List<Enrollment> enrollments = enrollmentRepository.findByCourseId(course.getId());
        List<StudentCourseBatch> scbs = studentCourseBatchRepository.findByCourseId(course.getId());

        if (enrollments.isEmpty() && course.getTitle() != null) {
            enrollments = enrollmentRepository.findAll().stream()
                    .filter(e -> course.getTitle().equalsIgnoreCase(e.getCourseTitle()) || course.getId().equalsIgnoreCase(e.getCourseId()))
                    .toList();
        }
        if (scbs.isEmpty() && course.getTitle() != null) {
            scbs = studentCourseBatchRepository.findAll().stream()
                    .filter(s -> course.getTitle().equalsIgnoreCase(s.getCourseName()) || course.getId().equalsIgnoreCase(s.getCourseId()))
                    .toList();
        }

        Set<String> studentIds = new LinkedHashSet<>();
        Map<String, String> enrolledDateMap = new HashMap<>();
        Map<String, String> statusMap = new HashMap<>();

        for (Enrollment e : enrollments) {
            if (e.getStudentId() != null && !e.getStudentId().isBlank()) {
                studentIds.add(e.getStudentId());
                if (e.getEnrolledDate() != null) {
                    enrolledDateMap.putIfAbsent(e.getStudentId(), e.getEnrolledDate());
                }
                if (e.getStatus() != null) {
                    statusMap.putIfAbsent(e.getStudentId(), e.getStatus());
                }
            }
        }

        for (StudentCourseBatch scb : scbs) {
            if (scb.getStudentId() != null && !scb.getStudentId().isBlank()) {
                studentIds.add(scb.getStudentId());
            }
        }

        List<User> allStudents = userRepository.findByRoleIgnoreCase("STUDENT");
        for (User u : allStudents) {
            if (u.getCourse() != null && (u.getCourse().toLowerCase().contains(course.getTitle().toLowerCase()) || u.getCourse().equalsIgnoreCase(course.getId()))) {
                studentIds.add(u.getId());
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (String sId : studentIds) {
            Optional<User> uOpt = userRepository.findById(sId)
                    .or(() -> userRepository.findByEmailIgnoreCase(sId));
            if (uOpt.isEmpty()) continue;
            User u = uOpt.get();

            long completedModules = 0;
            if (studentModuleProgressRepository != null) {
                List<StudentModuleProgress> smpList = studentModuleProgressRepository.findByStudentIdAndCourseId(u.getId(), course.getId());
                if (smpList != null && !smpList.isEmpty()) {
                    completedModules = smpList.stream().filter(s -> Boolean.TRUE.equals(s.getCompleted())).count();
                }
            }
            if (completedModules == 0 && studentProgressRepository != null) {
                List<StudentProgress> spList = studentProgressRepository.findByStudentIdIgnoreCaseAndCourseId(u.getId(), course.getId());
                if (spList != null && !spList.isEmpty()) {
                    completedModules = spList.stream().filter(sp -> "Completed".equalsIgnoreCase(sp.getStatus())).count();
                }
            }

            int percentage = totalModules > 0 ? (int) Math.round((completedModules * 100.0) / totalModules) : 0;
            if (percentage > 100) percentage = 100;

            String enrolledDate = enrolledDateMap.get(u.getId());
            if (enrolledDate == null || enrolledDate.isBlank()) {
                enrolledDate = u.getJoinedOn() != null ? u.getJoinedOn() : "";
            }

            String status = u.getStatus() != null && !u.getStatus().isBlank() ? u.getStatus() : "Active";

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("email", u.getEmail());
            map.put("username", u.getUsername());
            map.put("phone", u.getPhone());
            map.put("enrolledDate", enrolledDate);
            map.put("status", status);
            map.put("completedModules", completedModules);
            map.put("totalModules", totalModules);
            map.put("progress", completedModules + " / " + totalModules);
            map.put("progressPercentage", percentage);

            result.add(map);
        }

        return result;
    }
}
