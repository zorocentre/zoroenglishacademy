package com.zoroacademy.dto;

import java.util.ArrayList;
import java.util.List;

public class CleanupResultDto {
    private boolean dryRun;
    private long orphanedFilesFound;
    private long orphanedFilesDeleted;
    private long orphanedVideosFound;
    private long orphanedVideosDeleted;
    private long submissionsPurged;
    private long bytesReclaimed;
    private String executionTime;
    private String message;

    // Enhanced audit and operational reporting fields (Objective C)
    private long totalScanned;
    private long totalReferenced;
    private long orphanCandidates;
    private long skippedRecent;
    private long skippedActiveRef;
    private long skippedUncertain;
    private long eligibleForDeletion;
    private long failedDeletions;
    private List<String> failureReasons = new ArrayList<>();
    private boolean requiresOptIn;
    private boolean livePurgeAllowed;

    public CleanupResultDto() {}

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public long getOrphanedFilesFound() {
        return orphanedFilesFound;
    }

    public void setOrphanedFilesFound(long orphanedFilesFound) {
        this.orphanedFilesFound = orphanedFilesFound;
    }

    public long getOrphanedFilesDeleted() {
        return orphanedFilesDeleted;
    }

    public void setOrphanedFilesDeleted(long orphanedFilesDeleted) {
        this.orphanedFilesDeleted = orphanedFilesDeleted;
    }

    public long getOrphanedVideosFound() {
        return orphanedVideosFound;
    }

    public void setOrphanedVideosFound(long orphanedVideosFound) {
        this.orphanedVideosFound = orphanedVideosFound;
    }

    public long getOrphanedVideosDeleted() {
        return orphanedVideosDeleted;
    }

    public void setOrphanedVideosDeleted(long orphanedVideosDeleted) {
        this.orphanedVideosDeleted = orphanedVideosDeleted;
    }

    public long getSubmissionsPurged() {
        return submissionsPurged;
    }

    public void setSubmissionsPurged(long submissionsPurged) {
        this.submissionsPurged = submissionsPurged;
    }

    public long getBytesReclaimed() {
        return bytesReclaimed;
    }

    public void setBytesReclaimed(long bytesReclaimed) {
        this.bytesReclaimed = bytesReclaimed;
    }

    public String getExecutionTime() {
        return executionTime;
    }

    public void setExecutionTime(String executionTime) {
        this.executionTime = executionTime;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getTotalScanned() {
        return totalScanned;
    }

    public void setTotalScanned(long totalScanned) {
        this.totalScanned = totalScanned;
    }

    public long getTotalReferenced() {
        return totalReferenced;
    }

    public void setTotalReferenced(long totalReferenced) {
        this.totalReferenced = totalReferenced;
    }

    public long getOrphanCandidates() {
        return orphanCandidates;
    }

    public void setOrphanCandidates(long orphanCandidates) {
        this.orphanCandidates = orphanCandidates;
    }

    public long getSkippedRecent() {
        return skippedRecent;
    }

    public void setSkippedRecent(long skippedRecent) {
        this.skippedRecent = skippedRecent;
    }

    public long getSkippedActiveRef() {
        return skippedActiveRef;
    }

    public void setSkippedActiveRef(long skippedActiveRef) {
        this.skippedActiveRef = skippedActiveRef;
    }

    public long getSkippedUncertain() {
        return skippedUncertain;
    }

    public void setSkippedUncertain(long skippedUncertain) {
        this.skippedUncertain = skippedUncertain;
    }

    public long getEligibleForDeletion() {
        return eligibleForDeletion;
    }

    public void setEligibleForDeletion(long eligibleForDeletion) {
        this.eligibleForDeletion = eligibleForDeletion;
    }

    public long getFailedDeletions() {
        return failedDeletions;
    }

    public void setFailedDeletions(long failedDeletions) {
        this.failedDeletions = failedDeletions;
    }

    public List<String> getFailureReasons() {
        return failureReasons;
    }

    public void setFailureReasons(List<String> failureReasons) {
        this.failureReasons = failureReasons != null ? failureReasons : new ArrayList<>();
    }

    public boolean isRequiresOptIn() {
        return requiresOptIn;
    }

    public void setRequiresOptIn(boolean requiresOptIn) {
        this.requiresOptIn = requiresOptIn;
    }

    public boolean isLivePurgeAllowed() {
        return livePurgeAllowed;
    }

    public void setLivePurgeAllowed(boolean livePurgeAllowed) {
        this.livePurgeAllowed = livePurgeAllowed;
    }
}
