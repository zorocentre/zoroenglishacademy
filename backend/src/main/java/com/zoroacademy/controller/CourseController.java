package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.dto.ReorderModulesRequest;
import com.zoroacademy.entity.Course;
import com.zoroacademy.entity.CourseModule;
import com.zoroacademy.entity.CourseResource;
import com.zoroacademy.repository.EnrollmentRepository;
import com.zoroacademy.service.CourseService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;
    private final EnrollmentRepository enrollmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.zoroacademy.service.TrainerCourseRequestService requestService;

    public CourseController(CourseService courseService, EnrollmentRepository enrollmentRepository) {
        this.courseService = courseService;
        this.enrollmentRepository = enrollmentRepository;
    }

    private boolean isStaffUser() {
        org.springframework.security.core.Authentication auth = 
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return false;
        }
        return auth.getAuthorities().stream().anyMatch(a -> 
            "ROLE_ADMIN".equals(a.getAuthority()) || 
            "ROLE_SUPER_ADMIN".equals(a.getAuthority()) || 
            "ROLE_TRAINER".equals(a.getAuthority())
        );
    }

    private boolean isEnrolledStudent(String courseId) {
        org.springframework.security.core.Authentication auth = 
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return false;
        }
        String email = auth.getName();
        if (email == null || email.isBlank()) return false;
        return enrollmentRepository.findByStudentEmailIgnoreCase(email).stream()
                .anyMatch(e -> courseId != null && courseId.equalsIgnoreCase(e.getCourseId())
                        && ("Active".equalsIgnoreCase(e.getStatus()) || "Completed".equalsIgnoreCase(e.getStatus())));
    }

    @GetMapping
    public ApiResponse<List<Course>> getCourses(@RequestParam(required = false) String audience) {
        boolean staff = isStaffUser();
        String effectiveAudience = audience;
        if (!staff && (effectiveAudience == null || effectiveAudience.isBlank())) {
            effectiveAudience = "student";
        }
        List<Course> courses = courseService.getAllCourses(effectiveAudience);
        if (!staff) {
            courses = courses.stream()
                    .filter(c -> c.getAudience() == null || !"trainer".equalsIgnoreCase(c.getAudience()))
                    .map(courseService::sanitizeCourseForPublic)
                    .toList();
        }
        return ApiResponse.ok(courses);
    }

    @GetMapping("/{id}")
    public ApiResponse<Course> getCourseById(@PathVariable String id,
                                             @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        Course course = courseService.getCourseById(id);
        boolean isTrainerAudience = course != null && "trainer".equalsIgnoreCase(course.getAudience());
        boolean isAdmin = principal != null && ("ADMIN".equalsIgnoreCase(principal.getRole()) || "SUPER_ADMIN".equalsIgnoreCase(principal.getRole()));

        if (isAdmin) {
            if (course.getModules() != null) {
                course.getModules().forEach(m -> m.setLocked(false));
            }
            return ApiResponse.ok(course);
        }

        if (isTrainerAudience) {
            String trainerId = principal != null ? principal.getId() : null;
            String trainerEmail = principal != null ? principal.getEmail() : null;
            if (principal != null && "TRAINER".equalsIgnoreCase(principal.getRole())) {
                if (requestService != null && !requestService.isTrainerAuthorizedForCourse(trainerId, trainerEmail, course.getId())) {
                    throw new org.springframework.security.access.AccessDeniedException("Access denied: You do not have approved access to this course.");
                }
            }
            Course trainerCourse = courseService.getCourseForStudent(course.getId(), trainerId, trainerEmail);
            return ApiResponse.ok(trainerCourse);
        }

        boolean isStaff = isStaffUser();
        boolean isEnrolled = isEnrolledStudent(course.getId());

        if (!isStaff && !isEnrolled) {
            return ApiResponse.ok(courseService.sanitizeCourseForPublic(course));
        }

        if (isStaff) {
            if (course.getModules() != null) {
                course.getModules().forEach(m -> m.setLocked(false));
            }
            return ApiResponse.ok(course);
        }

        // Enrolled student
        String studentId = principal != null ? principal.getId() : null;
        String studentEmail = principal != null ? principal.getEmail() : null;
        Course studentCourse = courseService.getCourseForStudent(course.getId(), studentId, studentEmail);
        return ApiResponse.ok(studentCourse);
    }

    @GetMapping("/{courseId}/modules/{moduleId}")
    public ApiResponse<CourseModule> getModuleById(@PathVariable String courseId,
                                                   @PathVariable String moduleId,
                                                   @org.springframework.security.core.annotation.AuthenticationPrincipal com.zoroacademy.security.UserPrincipal principal) {
        String userId = principal != null ? principal.getId() : null;
        String userEmail = principal != null ? principal.getEmail() : null;
        String userRole = principal != null ? principal.getRole() : "STUDENT";

        if (principal != null && "TRAINER".equalsIgnoreCase(principal.getRole())) {
            Course c = courseService.getCourseById(courseId);
            if (c != null && "trainer".equalsIgnoreCase(c.getAudience())) {
                if (requestService != null && !requestService.isTrainerAuthorizedForCourse(userId, userEmail, courseId)) {
                    throw new org.springframework.security.access.AccessDeniedException("Access denied: You do not have approved access to this course.");
                }
            }
        }

        return ApiResponse.ok(courseService.getModuleForUser(courseId, moduleId, userId, userEmail, userRole));
    }

    @PostMapping
    public ApiResponse<Course> createCourse(@RequestBody Course course) {
        return ApiResponse.ok(courseService.createCourse(course), "Course created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<Course> updateCourse(@PathVariable String id, @RequestBody Course course) {
        return ApiResponse.ok(courseService.updateCourse(id, course), "Course updated successfully");
    }

    @GetMapping("/{id}/deletion-impact")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<com.zoroacademy.dto.DeletionImpactDto> getCourseDeletionImpact(@PathVariable String id) {
        return ApiResponse.ok(courseService.getCourseDeletionImpact(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteCourse(@PathVariable String id) {
        courseService.deleteCourse(id);
        return ApiResponse.ok(true, "Course deleted successfully");
    }

    @PostMapping("/{courseId}/modules")
    public ApiResponse<CourseModule> addModule(@PathVariable String courseId, @RequestBody CourseModule module) {
        return ApiResponse.ok(courseService.addModule(courseId, module), "Module added successfully");
    }

    @PutMapping("/{courseId}/modules/{moduleId}")
    public ApiResponse<CourseModule> updateModule(@PathVariable String courseId,
                                                 @PathVariable String moduleId,
                                                 @RequestBody CourseModule module) {
        return ApiResponse.ok(courseService.updateModule(courseId, moduleId, module), "Module updated successfully");
    }

    @DeleteMapping("/{courseId}/modules/{moduleId}")
    public ApiResponse<Boolean> deleteModule(@PathVariable String courseId, @PathVariable String moduleId) {
        courseService.deleteModule(courseId, moduleId);
        return ApiResponse.ok(true, "Module deleted successfully");
    }

    @PutMapping("/{courseId}/modules/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<CourseModule>> reorderModules(@PathVariable String courseId,
                                                         @RequestBody ReorderModulesRequest request) {
        return ApiResponse.ok(courseService.reorderModules(courseId, request != null ? request.getModuleIds() : null), "Modules reordered successfully");
    }

    @PostMapping("/{courseId}/resources")
    public ApiResponse<CourseResource> addResource(@PathVariable String courseId, @RequestBody CourseResource resource) {
        return ApiResponse.ok(courseService.addResource(courseId, resource), "Resource added successfully");
    }

    @DeleteMapping("/{courseId}/resources/{resourceId}")
    public ApiResponse<Boolean> deleteResource(@PathVariable String courseId, @PathVariable String resourceId) {
        courseService.deleteResource(resourceId);
        return ApiResponse.ok(true, "Resource deleted successfully");
    }

    @GetMapping("/{courseId}/students")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'TRAINER')")
    public ApiResponse<java.util.List<java.util.Map<String, Object>>> getCourseStudents(@PathVariable String courseId) {
        return ApiResponse.ok(courseService.getStudentsForCourse(courseId));
    }
}
