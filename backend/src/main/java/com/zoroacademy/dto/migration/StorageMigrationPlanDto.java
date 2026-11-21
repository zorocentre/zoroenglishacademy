package com.zoroacademy.dto.migration;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class StorageMigrationPlanDto {
    private long totalFiles;
    private long totalSizeBytes;
    private long verifiedFilesCount;
    private long missingSourceFilesCount;
    private long unindexedMediaReferencesCount;
    private Map<String, Long> sizeByCategory = new HashMap<>();
    private Map<String, Long> categoryCounts = new HashMap<>();
    private List<String> sampleStoragePaths = new ArrayList<>();
    private boolean executionReady;
    private String sourceStorageProvider;
    private String targetStorageZone;

    public StorageMigrationPlanDto() {}

    public long getTotalFiles() {
        return totalFiles;
    }

    public void setTotalFiles(long totalFiles) {
        this.totalFiles = totalFiles;
    }

    public long getTotalSizeBytes() {
        return totalSizeBytes;
    }

    public void setTotalSizeBytes(long totalSizeBytes) {
        this.totalSizeBytes = totalSizeBytes;
    }

    public long getVerifiedFilesCount() {
        return verifiedFilesCount;
    }

    public void setVerifiedFilesCount(long verifiedFilesCount) {
        this.verifiedFilesCount = verifiedFilesCount;
    }

    public long getMissingSourceFilesCount() {
        return missingSourceFilesCount;
    }

    public void setMissingSourceFilesCount(long missingSourceFilesCount) {
        this.missingSourceFilesCount = missingSourceFilesCount;
    }

    public long getUnindexedMediaReferencesCount() {
        return unindexedMediaReferencesCount;
    }

    public void setUnindexedMediaReferencesCount(long unindexedMediaReferencesCount) {
        this.unindexedMediaReferencesCount = unindexedMediaReferencesCount;
    }

    public Map<String, Long> getSizeByCategory() {
        return sizeByCategory;
    }

    public void setSizeByCategory(Map<String, Long> sizeByCategory) {
        this.sizeByCategory = sizeByCategory != null ? sizeByCategory : new HashMap<>();
    }

    public Map<String, Long> getCategoryCounts() {
        return categoryCounts;
    }

    public void setCategoryCounts(Map<String, Long> categoryCounts) {
        this.categoryCounts = categoryCounts != null ? categoryCounts : new HashMap<>();
    }

    public List<String> getSampleStoragePaths() {
        return sampleStoragePaths;
    }

    public void setSampleStoragePaths(List<String> sampleStoragePaths) {
        this.sampleStoragePaths = sampleStoragePaths != null ? sampleStoragePaths : new ArrayList<>();
    }

    public boolean isExecutionReady() {
        return executionReady;
    }

    public void setExecutionReady(boolean executionReady) {
        this.executionReady = executionReady;
    }

    public String getSourceStorageProvider() {
        return sourceStorageProvider;
    }

    public void setSourceStorageProvider(String sourceStorageProvider) {
        this.sourceStorageProvider = sourceStorageProvider;
    }

    public String getTargetStorageZone() {
        return targetStorageZone;
    }

    public void setTargetStorageZone(String targetStorageZone) {
        this.targetStorageZone = targetStorageZone;
    }
}
