package com.zoroacademy.dto.migration;

import java.util.HashMap;
import java.util.Map;

public class StreamMigrationResultDto {
    private boolean dryRun;
    private long totalProcessed;
    private long updatedCourseVideosCount;
    private long updatedGuidanceVideosCount;
    private long updatedFeedbackVideosCount;
    private long failedCount;
    private Map<String, String> idMappingTable = new HashMap<>();
    private String executionTime;
    private String reconciliationSummary;

    public StreamMigrationResultDto() {}

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public long getTotalProcessed() {
        return totalProcessed;
    }

    public void setTotalProcessed(long totalProcessed) {
        this.totalProcessed = totalProcessed;
    }

    public long getUpdatedCourseVideosCount() {
        return updatedCourseVideosCount;
    }

    public void setUpdatedCourseVideosCount(long updatedCourseVideosCount) {
        this.updatedCourseVideosCount = updatedCourseVideosCount;
    }

    public long getUpdatedGuidanceVideosCount() {
        return updatedGuidanceVideosCount;
    }

    public void setUpdatedGuidanceVideosCount(long updatedGuidanceVideosCount) {
        this.updatedGuidanceVideosCount = updatedGuidanceVideosCount;
    }

    public long getUpdatedFeedbackVideosCount() {
        return updatedFeedbackVideosCount;
    }

    public void setUpdatedFeedbackVideosCount(long updatedFeedbackVideosCount) {
        this.updatedFeedbackVideosCount = updatedFeedbackVideosCount;
    }

    public long getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(long failedCount) {
        this.failedCount = failedCount;
    }

    public Map<String, String> getIdMappingTable() {
        return idMappingTable;
    }

    public void setIdMappingTable(Map<String, String> idMappingTable) {
        this.idMappingTable = idMappingTable != null ? idMappingTable : new HashMap<>();
    }

    public String getExecutionTime() {
        return executionTime;
    }

    public void setExecutionTime(String executionTime) {
        this.executionTime = executionTime;
    }

    public String getReconciliationSummary() {
        return reconciliationSummary;
    }

    public void setReconciliationSummary(String reconciliationSummary) {
        this.reconciliationSummary = reconciliationSummary;
    }
}
