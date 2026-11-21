package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.dto.CleanupResultDto;
import com.zoroacademy.dto.StorageMetricsDto;
import com.zoroacademy.dto.migration.*;
import com.zoroacademy.service.StorageCleanupService;
import com.zoroacademy.service.migration.BunnyMigrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/storage")
public class AdminStorageController {

    private final StorageCleanupService storageCleanupService;
    private final BunnyMigrationService migrationService;

    @Autowired
    public AdminStorageController(
            StorageCleanupService storageCleanupService,
            @Autowired(required = false) BunnyMigrationService migrationService
    ) {
        this.storageCleanupService = storageCleanupService;
        this.migrationService = migrationService;
    }

    @GetMapping("/metrics")
    public ApiResponse<StorageMetricsDto> getMetrics() {
        return ApiResponse.ok(storageCleanupService.getMetrics());
    }

    /**
     * Objective C: Trigger Cleanup with permanent fail-safe defaults.
     * dryRun defaults to TRUE. Physical deletion strictly requires confirmPermanentDelete=true.
     */
    @PostMapping("/cleanup")
    public ApiResponse<CleanupResultDto> triggerCleanup(
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam(required = false) Integer cutoffHours,
            @RequestParam(defaultValue = "false") boolean confirmPermanentDelete
    ) {
        int cutoff = cutoffHours != null ? Math.max(1, cutoffHours) : 168;
        CleanupResultDto result = storageCleanupService.runCleanup(dryRun, cutoff, confirmPermanentDelete);
        return ApiResponse.ok(result);
    }

    @PutMapping("/settings")
    public ApiResponse<StorageMetricsDto> updateSettings(@RequestBody Map<String, Object> body) {
        if (body != null && body.containsKey("submissionRetentionMonths")) {
            try {
                int months = Integer.parseInt(body.get("submissionRetentionMonths").toString().trim());
                storageCleanupService.setSubmissionRetentionMonths(months);
            } catch (Exception ignored) {}
        }
        return ApiResponse.ok(storageCleanupService.getMetrics());
    }

    // --- Bunny Storage & Stream Migration Operations (Objective E) ---

    @GetMapping("/migration/plan/storage")
    public ApiResponse<StorageMigrationPlanDto> getStorageMigrationPlan() {
        if (migrationService == null) {
            return ApiResponse.error("Migration service is not initialized");
        }
        return ApiResponse.ok(migrationService.generateStorageMigrationPlan());
    }

    @PostMapping("/migration/execute/storage")
    public ApiResponse<StorageMigrationResultDto> executeStorageMigration(
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam(required = false) String targetHost,
            @RequestParam(required = false) String targetZone,
            @RequestParam(required = false) String targetAccessKey,
            @RequestParam(defaultValue = "true") boolean verifyChecksum
    ) {
        if (migrationService == null) {
            return ApiResponse.error("Migration service is not initialized");
        }
        StorageMigrationResultDto result = migrationService.executeStorageMigration(
                dryRun, targetHost, targetZone, targetAccessKey, verifyChecksum
        );
        return ApiResponse.ok(result);
    }

    @GetMapping("/migration/plan/stream")
    public ApiResponse<StreamMigrationPlanDto> getStreamMigrationPlan() {
        if (migrationService == null) {
            return ApiResponse.error("Migration service is not initialized");
        }
        return ApiResponse.ok(migrationService.generateStreamMigrationPlan());
    }

    @PostMapping("/migration/execute/stream")
    public ApiResponse<StreamMigrationResultDto> executeStreamMigration(
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestBody Map<String, String> oldToNewVideoIdMap
    ) {
        if (migrationService == null) {
            return ApiResponse.error("Migration service is not initialized");
        }
        StreamMigrationResultDto result = migrationService.executeStreamMigration(dryRun, oldToNewVideoIdMap);
        return ApiResponse.ok(result);
    }

    /**
     * Incident recovery tool: Reconstructs stored_files records for unindexed media
     * (e.g. question media) if physical assets are present in storage or on disk.
     */
    @PostMapping("/metadata/recover")
    public ApiResponse<MetadataRecoveryResultDto> recoverMissingMetadata(
            @RequestParam(defaultValue = "true") boolean dryRun
    ) {
        if (migrationService == null) {
            return ApiResponse.error("Migration service is not initialized");
        }
        MetadataRecoveryResultDto result = migrationService.recoverUnindexedMediaMetadata(dryRun);
        return ApiResponse.ok(result);
    }
}
