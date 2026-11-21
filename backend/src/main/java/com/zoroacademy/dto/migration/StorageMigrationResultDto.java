package com.zoroacademy.dto.migration;

import java.util.ArrayList;
import java.util.List;

public class StorageMigrationResultDto {
    private boolean dryRun;
    private long totalProcessed;
    private long transferredCount;
    private long skippedExistingCount;
    private long checksumVerifiedCount;
    private long failedCount;
    private List<String> failedFiles = new ArrayList<>();
    private String executionTime;
    private String reconciliationSummary;

    public StorageMigrationResultDto() {}

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

    public long getTransferredCount() {
        return transferredCount;
    }

    public void setTransferredCount(long transferredCount) {
        this.transferredCount = transferredCount;
    }

    public long getSkippedExistingCount() {
        return skippedExistingCount;
    }

    public void setSkippedExistingCount(long skippedExistingCount) {
        this.skippedExistingCount = skippedExistingCount;
    }

    public long getChecksumVerifiedCount() {
        return checksumVerifiedCount;
    }

    public void setChecksumVerifiedCount(long checksumVerifiedCount) {
        this.checksumVerifiedCount = checksumVerifiedCount;
    }

    public long getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(long failedCount) {
        this.failedCount = failedCount;
    }

    public List<String> getFailedFiles() {
        return failedFiles;
    }

    public void setFailedFiles(List<String> failedFiles) {
        this.failedFiles = failedFiles != null ? failedFiles : new ArrayList<>();
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
