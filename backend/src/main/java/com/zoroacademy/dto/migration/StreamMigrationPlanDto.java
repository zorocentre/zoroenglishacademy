package com.zoroacademy.dto.migration;

import java.util.ArrayList;
import java.util.List;

public class StreamMigrationPlanDto {
    private long totalVideos;
    private long courseVideosCount;
    private long guidanceVideosCount;
    private long feedbackVideosCount;
    private List<String> existingVideoGuids = new ArrayList<>();
    private List<String> sampleVideoTitles = new ArrayList<>();
    private String currentLibraryId;
    private String targetLibraryId;

    public StreamMigrationPlanDto() {}

    public long getTotalVideos() {
        return totalVideos;
    }

    public void setTotalVideos(long totalVideos) {
        this.totalVideos = totalVideos;
    }

    public long getCourseVideosCount() {
        return courseVideosCount;
    }

    public void setCourseVideosCount(long courseVideosCount) {
        this.courseVideosCount = courseVideosCount;
    }

    public long getGuidanceVideosCount() {
        return guidanceVideosCount;
    }

    public void setGuidanceVideosCount(long guidanceVideosCount) {
        this.guidanceVideosCount = guidanceVideosCount;
    }

    public long getFeedbackVideosCount() {
        return feedbackVideosCount;
    }

    public void setFeedbackVideosCount(long feedbackVideosCount) {
        this.feedbackVideosCount = feedbackVideosCount;
    }

    public List<String> getExistingVideoGuids() {
        return existingVideoGuids;
    }

    public void setExistingVideoGuids(List<String> existingVideoGuids) {
        this.existingVideoGuids = existingVideoGuids != null ? existingVideoGuids : new ArrayList<>();
    }

    public List<String> getSampleVideoTitles() {
        return sampleVideoTitles;
    }

    public void setSampleVideoTitles(List<String> sampleVideoTitles) {
        this.sampleVideoTitles = sampleVideoTitles != null ? sampleVideoTitles : new ArrayList<>();
    }

    public String getCurrentLibraryId() {
        return currentLibraryId;
    }

    public void setCurrentLibraryId(String currentLibraryId) {
        this.currentLibraryId = currentLibraryId;
    }

    public String getTargetLibraryId() {
        return targetLibraryId;
    }

    public void setTargetLibraryId(String targetLibraryId) {
        this.targetLibraryId = targetLibraryId;
    }
}
