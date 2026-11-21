package com.zoroacademy.dto.migration;

import java.util.ArrayList;
import java.util.List;

public class MetadataRecoveryResultDto {
    private boolean dryRun;
    private long unindexedReferencesScanned;
    private long recoveredCount;
    private List<String> recoveredFiles = new ArrayList<>();
    private long unrecoverableCount;
    private List<String> unrecoverableReferences = new ArrayList<>();
    private String executionTime;
    private String summary;

    public MetadataRecoveryResultDto() {}

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public long getUnindexedReferencesScanned() {
        return unindexedReferencesScanned;
    }

    public void setUnindexedReferencesScanned(long unindexedReferencesScanned) {
        this.unindexedReferencesScanned = unindexedReferencesScanned;
    }

    public long getRecoveredCount() {
        return recoveredCount;
    }

    public void setRecoveredCount(long recoveredCount) {
        this.recoveredCount = recoveredCount;
    }

    public List<String> getRecoveredFiles() {
        return recoveredFiles;
    }

    public void setRecoveredFiles(List<String> recoveredFiles) {
        this.recoveredFiles = recoveredFiles != null ? recoveredFiles : new ArrayList<>();
    }

    public long getUnrecoverableCount() {
        return unrecoverableCount;
    }

    public void setUnrecoverableCount(long unrecoverableCount) {
        this.unrecoverableCount = unrecoverableCount;
    }

    public List<String> getUnrecoverableReferences() {
        return unrecoverableReferences;
    }

    public void setUnrecoverableReferences(List<String> unrecoverableReferences) {
        this.unrecoverableReferences = unrecoverableReferences != null ? unrecoverableReferences : new ArrayList<>();
    }

    public String getExecutionTime() {
        return executionTime;
    }

    public void setExecutionTime(String executionTime) {
        this.executionTime = executionTime;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }
}
