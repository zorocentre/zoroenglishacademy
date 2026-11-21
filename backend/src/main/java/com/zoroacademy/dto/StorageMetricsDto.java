package com.zoroacademy.dto;

import java.util.Map;

public class StorageMetricsDto {
    private long totalFiles;
    private long totalSizeBytes;
    private Map<String, Long> sizeByCategory;
    private Map<String, Long> countByCategory;
    private long orphanCount;
    private long orphanSizeBytes;
    private String lastCleanupTime;
    private long lastCleanedCount;
    private long lastReclaimedBytes;
    private int submissionRetentionMonths;
    private boolean dryRunDefault;

    // Safety status fields (Objective C)
    private boolean cleanupEnabled;
    private int orphanRetentionHours;
    private boolean livePurgeAllowed;
    private boolean isCurrentlyRunning;

    public StorageMetricsDto() {}

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

    public Map<String, Long> getSizeByCategory() {
        return sizeByCategory;
    }

    public void setSizeByCategory(Map<String, Long> sizeByCategory) {
        this.sizeByCategory = sizeByCategory;
    }

    public Map<String, Long> getCountByCategory() {
        return countByCategory;
    }

    public void setCountByCategory(Map<String, Long> countByCategory) {
        this.countByCategory = countByCategory;
    }

    public long getOrphanCount() {
        return orphanCount;
    }

    public void setOrphanCount(long orphanCount) {
        this.orphanCount = orphanCount;
    }

    public long getOrphanSizeBytes() {
        return orphanSizeBytes;
    }

    public void setOrphanSizeBytes(long orphanSizeBytes) {
        this.orphanSizeBytes = orphanSizeBytes;
    }

    public String getLastCleanupTime() {
        return lastCleanupTime;
    }

    public void setLastCleanupTime(String lastCleanupTime) {
        this.lastCleanupTime = lastCleanupTime;
    }

    public long getLastCleanedCount() {
        return lastCleanedCount;
    }

    public void setLastCleanedCount(long lastCleanedCount) {
        this.lastCleanedCount = lastCleanedCount;
    }

    public long getLastReclaimedBytes() {
        return lastReclaimedBytes;
    }

    public void setLastReclaimedBytes(long lastReclaimedBytes) {
        this.lastReclaimedBytes = lastReclaimedBytes;
    }

    public int getSubmissionRetentionMonths() {
        return submissionRetentionMonths;
    }

    public void setSubmissionRetentionMonths(int submissionRetentionMonths) {
        this.submissionRetentionMonths = submissionRetentionMonths;
    }

    public boolean isDryRunDefault() {
        return dryRunDefault;
    }

    public void setDryRunDefault(boolean dryRunDefault) {
        this.dryRunDefault = dryRunDefault;
    }

    public boolean isCleanupEnabled() {
        return cleanupEnabled;
    }

    public void setCleanupEnabled(boolean cleanupEnabled) {
        this.cleanupEnabled = cleanupEnabled;
    }

    public int getOrphanRetentionHours() {
        return orphanRetentionHours;
    }

    public void setOrphanRetentionHours(int orphanRetentionHours) {
        this.orphanRetentionHours = orphanRetentionHours;
    }

    public boolean isLivePurgeAllowed() {
        return livePurgeAllowed;
    }

    public void setLivePurgeAllowed(boolean livePurgeAllowed) {
        this.livePurgeAllowed = livePurgeAllowed;
    }

    public boolean isCurrentlyRunning() {
        return isCurrentlyRunning;
    }

    public void setCurrentlyRunning(boolean currentlyRunning) {
        isCurrentlyRunning = currentlyRunning;
    }
}
