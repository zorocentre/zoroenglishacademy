package com.zoroacademy;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.controller.AdminStorageController;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.dto.StorageMetricsDto;
import com.zoroacademy.dto.migration.StorageMigrationPlanDto;
import com.zoroacademy.service.StorageCleanupService;
import com.zoroacademy.service.migration.BunnyMigrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class AdminStorageControllerDefaultSafetyTest {

    private StorageCleanupService storageCleanupService;
    private BunnyMigrationService migrationService;
    private AdminStorageController controller;

    @BeforeEach
    void setUp() {
        storageCleanupService = mock(StorageCleanupService.class);
        migrationService = mock(BunnyMigrationService.class);
        controller = new AdminStorageController(storageCleanupService, migrationService);
    }

    @Test
    @DisplayName("Endpoint Safety: Cleanup defaults to dryRun=true and 168h cutoff if unspecified")
    void testCleanupDefaultParameters() {
        CleanupResultDto mockResult = new CleanupResultDto();
        mockResult.setDryRun(true);
        when(storageCleanupService.runCleanup(true, 168, false)).thenReturn(mockResult);

        ApiResponse<CleanupResultDto> response = controller.triggerCleanup(true, null, false);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertTrue(response.getData().isDryRun());
        verify(storageCleanupService, times(1)).runCleanup(true, 168, false);
    }

    @Test
    @DisplayName("Metrics Endpoint: Returns storage metrics and safety status")
    void testGetMetrics() {
        StorageMetricsDto metrics = new StorageMetricsDto();
        metrics.setCleanupEnabled(false);
        metrics.setLivePurgeAllowed(false);
        metrics.setOrphanRetentionHours(168);
        when(storageCleanupService.getMetrics()).thenReturn(metrics);

        ApiResponse<StorageMetricsDto> response = controller.getMetrics();

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertFalse(response.getData().isCleanupEnabled());
        assertFalse(response.getData().isLivePurgeAllowed());
        assertEquals(168, response.getData().getOrphanRetentionHours());
    }

    @Test
    @DisplayName("Migration Plan: Exposes plan generation endpoint")
    void testStorageMigrationPlan() {
        StorageMigrationPlanDto plan = new StorageMigrationPlanDto();
        plan.setTotalFiles(50);
        when(migrationService.generateStorageMigrationPlan()).thenReturn(plan);

        ApiResponse<StorageMigrationPlanDto> response = controller.getStorageMigrationPlan();

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(50, response.getData().getTotalFiles());
    }
}
