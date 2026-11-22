package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "orphaned_bunny_videos")
public class OrphanedBunnyVideo {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "bunny_video_id", unique = true, nullable = false, length = 128)
    private String bunnyVideoId;

    @Column(length = 50)
    private String category; // "COURSE_MODULE", "FEEDBACK", "COMPETITION_GUIDANCE", "OTHER"

    @Column(length = 500)
    private String title;

    @Column(name = "source_entity_id", length = 128)
    private String sourceEntityId;

    @Column(name = "orphaned_at", nullable = false)
    private OffsetDateTime orphanedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public OrphanedBunnyVideo() {}

    public OrphanedBunnyVideo(String bunnyVideoId, String category, String title, String sourceEntityId, OffsetDateTime orphanedAt) {
        this.id = "obv_" + UUID.randomUUID().toString();
        this.bunnyVideoId = bunnyVideoId;
        this.category = category;
        this.title = title;
        this.sourceEntityId = sourceEntityId;
        this.orphanedAt = orphanedAt != null ? orphanedAt : OffsetDateTime.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getBunnyVideoId() {
        return bunnyVideoId;
    }

    public void setBunnyVideoId(String bunnyVideoId) {
        this.bunnyVideoId = bunnyVideoId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSourceEntityId() {
        return sourceEntityId;
    }

    public void setSourceEntityId(String sourceEntityId) {
        this.sourceEntityId = sourceEntityId;
    }

    public OffsetDateTime getOrphanedAt() {
        return orphanedAt;
    }

    public void setOrphanedAt(OffsetDateTime orphanedAt) {
        this.orphanedAt = orphanedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
