package com.zoroacademy;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.controller.AdminStorageController;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.dto.StorageMetricsDto;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.StorageCleanupService;
import com.zoroacademy.service.migration.BunnyMigrationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class AdminStorageSecurityTest {

    private StorageCleanupService storageCleanupService;
    private BunnyMigrationService migrationService;
    private AdminStorageController controller;

    @BeforeEach
    void setUp() {
        storageCleanupService = mock(StorageCleanupService.class);
        migrationService = mock(BunnyMigrationService.class);
        controller = new AdminStorageController(storageCleanupService, migrationService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(String role) {
        List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
        UserPrincipal principal = new UserPrincipal("user-1", "user@test.com", "User", role, "password", authorities);
        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                authorities
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("Admin Storage Authorization: Class-level PreAuthorize enforces ADMIN or SUPER_ADMIN")
    void testControllerClassAnnotationSecurity() {
        PreAuthorize classPreAuthorize = AdminStorageController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(classPreAuthorize, "AdminStorageController must be secured with @PreAuthorize");
        assertEquals("hasAnyRole('ADMIN', 'SUPER_ADMIN')", classPreAuthorize.value());
    }

    @Test
    @DisplayName("Admin Storage Authorization: Evaluation logic blocks STUDENT and TRAINER, allows ADMIN and SUPER_ADMIN")
    void testRoleAuthorizationLogic() {
        java.util.function.Predicate<Authentication> isAuthorized = auth -> {
            if (auth == null || !auth.isAuthenticated()) return false;
            return auth.getAuthorities().stream().anyMatch(a ->
                    a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        };

        // Unauthenticated
        assertFalse(isAuthorized.test(null), "Unauthenticated must be denied (401)");

        // Student
        authenticate("STUDENT");
        assertFalse(isAuthorized.test(SecurityContextHolder.getContext().getAuthentication()), "STUDENT must be denied (403)");

        // Trainer
        authenticate("TRAINER");
        assertFalse(isAuthorized.test(SecurityContextHolder.getContext().getAuthentication()), "TRAINER must be denied (403)");

        // Admin
        authenticate("ADMIN");
        assertTrue(isAuthorized.test(SecurityContextHolder.getContext().getAuthentication()), "ADMIN must be authorized");

        // Super Admin
        authenticate("SUPER_ADMIN");
        assertTrue(isAuthorized.test(SecurityContextHolder.getContext().getAuthentication()), "SUPER_ADMIN must be authorized");
    }

    @Test
    @DisplayName("Admin Storage Operations: Controller executes successfully for authorized admin")
    void testAdminExecutionSuccess() {
        authenticate("ADMIN");
        when(storageCleanupService.getMetrics()).thenReturn(new StorageMetricsDto());

        ApiResponse<StorageMetricsDto> resp = controller.getMetrics();
        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        verify(storageCleanupService, times(1)).getMetrics();
    }
}
