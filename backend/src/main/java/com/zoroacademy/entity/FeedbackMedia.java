package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback_media")
public class FeedbackMedia {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType; // "IMAGE" or "VIDEO"

    @Column(name = "stored_file_id", length = 128)
    private String storedFileId;

    @Column(name = "bunny_video_id", length = 128)
    private String bunnyVideoId;

    @Column(columnDefinition = "TEXT")
    private String url;

    @Column(name = "thumbnail_url", columnDefinition = "TEXT")
    private String thumbnailUrl;

    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false, length = 30)
    private String status = "READY"; // "READY", "PROCESSING", "FAILED"

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    public FeedbackMedia() {}

    public FeedbackMedia(String id, String mediaType, String storedFileId, String bunnyVideoId,
                         String url, String thumbnailUrl, String originalFileName,
                         String contentType, Long sizeBytes, Integer sortOrder, String status, String createdBy) {
        this.id = id != null ? id : "fbm_" + UUID.randomUUID().toString();
        this.mediaType = mediaType;
        this.storedFileId = storedFileId;
        this.bunnyVideoId = bunnyVideoId;
        this.url = url;
        this.thumbnailUrl = thumbnailUrl;
        this.originalFileName = originalFileName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.sortOrder = sortOrder != null ? sortOrder : 0;
        this.status = status != null ? status : "READY";
        this.createdBy = createdBy;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getMediaType() {
        return mediaType;
    }

    public void setMediaType(String mediaType) {
        this.mediaType = mediaType;
    }

    public String getStoredFileId() {
        return storedFileId;
    }

    public void setStoredFileId(String storedFileId) {
        this.storedFileId = storedFileId;
    }

    public String getBunnyVideoId() {
        return bunnyVideoId;
    }

    public void setBunnyVideoId(String bunnyVideoId) {
        this.bunnyVideoId = bunnyVideoId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }
}
