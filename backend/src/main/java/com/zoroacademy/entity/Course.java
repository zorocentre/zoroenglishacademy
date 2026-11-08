package com.zoroacademy.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "courses")
public class Course {

    @Id
    @Column(length = 128)
    private String id;

    @Column(unique = true, length = 160)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String category;

    @Column(length = 50)
    private String mode; // Online, Recorded, Hybrid

    @Column(length = 50)
    private String level;

    @Column(length = 50)
    private String audience = "student"; // student, trainer

    @Column(length = 100)
    private String duration;

    @Column(name = "entered_fee", precision = 12, scale = 2)
    private BigDecimal enteredFee;

    @Column(name = "duration_value")
    private Integer durationValue;

    @Column(name = "duration_unit", length = 20)
    private String durationUnit;

    @Column(precision = 10, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "original_price", precision = 10, scale = 2)
    private BigDecimal originalPrice = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String thumbnail;

    @Column(name = "preview_video_url", columnDefinition = "TEXT")
    private String previewVideoUrl;

    private Integer enrolled = 0;

    @Column(precision = 3, scale = 2)
    private BigDecimal rating = new BigDecimal("5.0");

    @Column(length = 50)
    private String status = "Active";

    @Column(name = "assigned_trainer")
    private String assignedTrainer;

    @Column(name = "trainer_id", length = 64)
    private String trainerId;

    @Column(name = "google_meet_url", columnDefinition = "TEXT")
    private String googleMeetUrl;

    @Column(name = "assigned_trainer_id", length = 64)
    private String assignedTrainerId;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("moduleOrder ASC")
    @JsonManagedReference
    private List<CourseModule> modules = new ArrayList<>();

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference
    private List<CourseResource> resources = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Transient
    private String requestStatus;

    public Course() {}

    public Course(String id, String title, String description, String category, String mode, String level, String audience, String duration, BigDecimal price, BigDecimal originalPrice, String thumbnail, String previewVideoUrl, Integer enrolled, BigDecimal rating, String status, String assignedTrainer, List<CourseModule> modules, List<CourseResource> resources, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.category = category;
        this.mode = mode;
        this.level = level;
        this.audience = audience;
        this.duration = duration;
        this.price = price;
        this.originalPrice = originalPrice;
        this.thumbnail = thumbnail;
        this.previewVideoUrl = previewVideoUrl;
        this.enrolled = enrolled;
        this.rating = rating;
        this.status = status;
        this.assignedTrainer = assignedTrainer;
        this.modules = modules;
        this.resources = resources;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getAudience() {
        return audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public BigDecimal getEnteredFee() {
        return enteredFee;
    }

    public void setEnteredFee(BigDecimal enteredFee) {
        this.enteredFee = enteredFee;
    }

    public Integer getDurationValue() {
        return durationValue;
    }

    public void setDurationValue(Integer durationValue) {
        this.durationValue = durationValue;
    }

    public String getDurationUnit() {
        return durationUnit;
    }

    public void setDurationUnit(String durationUnit) {
        this.durationUnit = durationUnit;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public String getThumbnail() {
        return thumbnail;
    }

    public void setThumbnail(String thumbnail) {
        this.thumbnail = thumbnail;
    }

    public String getPreviewVideoUrl() {
        return previewVideoUrl;
    }

    public void setPreviewVideoUrl(String previewVideoUrl) {
        this.previewVideoUrl = previewVideoUrl;
    }

    public Integer getEnrolled() {
        return enrolled;
    }

    public void setEnrolled(Integer enrolled) {
        this.enrolled = enrolled;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAssignedTrainer() {
        return assignedTrainer;
    }

    public void setAssignedTrainer(String assignedTrainer) {
        this.assignedTrainer = assignedTrainer;
    }

    public String getTrainerId() {
        return trainerId;
    }

    public void setTrainerId(String trainerId) {
        this.trainerId = trainerId;
    }

    public String getGoogleMeetUrl() {
        return googleMeetUrl;
    }

    public void setGoogleMeetUrl(String googleMeetUrl) {
        this.googleMeetUrl = googleMeetUrl;
    }

    public String getAssignedTrainerId() {
        return assignedTrainerId;
    }

    public void setAssignedTrainerId(String assignedTrainerId) {
        this.assignedTrainerId = assignedTrainerId;
    }

    public List<CourseModule> getModules() {
        return modules;
    }

    public void setModules(List<CourseModule> modules) {
        this.modules = modules;
    }

    public List<CourseResource> getResources() {
        return resources;
    }

    public void setResources(List<CourseResource> resources) {
        this.resources = resources;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getRequestStatus() {
        return requestStatus;
    }

    public void setRequestStatus(String requestStatus) {
        this.requestStatus = requestStatus;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String title;
        private String description;
        private String category;
        private String mode;
        private String level;
        private String audience = "student";
        private String duration;
        private BigDecimal price = BigDecimal.ZERO;
        private BigDecimal originalPrice = BigDecimal.ZERO;
        private String thumbnail;
        private String previewVideoUrl;
        private Integer enrolled = 0;
        private BigDecimal rating = new BigDecimal("5.0");
        private String status = "Active";
        private String assignedTrainer;
        private List<CourseModule> modules = new ArrayList<>();
        private List<CourseResource> resources = new ArrayList<>();
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(String id) {
            this.id = id;
            return this;
        }
        public Builder title(String title) {
            this.title = title;
            return this;
        }
        public Builder description(String description) {
            this.description = description;
            return this;
        }
        public Builder category(String category) {
            this.category = category;
            return this;
        }
        public Builder mode(String mode) {
            this.mode = mode;
            return this;
        }
        public Builder level(String level) {
            this.level = level;
            return this;
        }
        public Builder audience(String audience) {
            this.audience = audience;
            return this;
        }
        public Builder duration(String duration) {
            this.duration = duration;
            return this;
        }
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }
        public Builder originalPrice(BigDecimal originalPrice) {
            this.originalPrice = originalPrice;
            return this;
        }
        public Builder thumbnail(String thumbnail) {
            this.thumbnail = thumbnail;
            return this;
        }
        public Builder previewVideoUrl(String previewVideoUrl) {
            this.previewVideoUrl = previewVideoUrl;
            return this;
        }
        public Builder enrolled(Integer enrolled) {
            this.enrolled = enrolled;
            return this;
        }
        public Builder rating(BigDecimal rating) {
            this.rating = rating;
            return this;
        }
        public Builder status(String status) {
            this.status = status;
            return this;
        }
        public Builder assignedTrainer(String assignedTrainer) {
            this.assignedTrainer = assignedTrainer;
            return this;
        }
        private String googleMeetUrl;
        private String assignedTrainerId;

        public Builder googleMeetUrl(String googleMeetUrl) {
            this.googleMeetUrl = googleMeetUrl;
            return this;
        }

        public Builder assignedTrainerId(String assignedTrainerId) {
            this.assignedTrainerId = assignedTrainerId;
            return this;
        }
        public Builder modules(List<CourseModule> modules) {
            this.modules = modules;
            return this;
        }
        public Builder resources(List<CourseResource> resources) {
            this.resources = resources;
            return this;
        }
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        private String slug;

        public Builder slug(String slug) {
            this.slug = slug;
            return this;
        }

        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public Course build() {
            Course c = new Course(id, title, description, category, mode, level, audience, duration, price, originalPrice, thumbnail, previewVideoUrl, enrolled, rating, status, assignedTrainer, modules, resources, createdAt, updatedAt);
            c.setSlug(slug);
            c.setGoogleMeetUrl(googleMeetUrl);
            c.setAssignedTrainerId(assignedTrainerId);
            return c;
        }
    }

}
