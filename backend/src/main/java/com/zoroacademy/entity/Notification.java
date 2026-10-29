package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "recipient_role", length = 50)
    private String recipientRole; // ALL, STUDENT, TRAINER, ADMIN

    @Column(name = "recipient_id")
    private String recipientId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "read_status")
    private Boolean readStatus = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    private LocalDateTime createdAt;

    public Notification() {}

    public Notification(String id, String recipientRole, String recipientId, String title, String message, Boolean readStatus, LocalDateTime createdAt) {
        this.id = id;
        this.recipientRole = recipientRole;
        this.recipientId = recipientId;
        this.title = title;
        this.message = message;
        this.readStatus = readStatus;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRecipientRole() {
        return recipientRole;
    }

    public void setRecipientRole(String recipientRole) {
        this.recipientRole = recipientRole;
    }

    public String getRecipientId() {
        return recipientId;
    }

    public void setRecipientId(String recipientId) {
        this.recipientId = recipientId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getReadStatus() {
        return readStatus;
    }

    public void setReadStatus(Boolean readStatus) {
        this.readStatus = readStatus;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String recipientRole;
        private String recipientId;
        private String title;
        private String message;
        private Boolean readStatus = false;
        private LocalDateTime createdAt;

        public Builder id(String id) {
            this.id = id;
            return this;
        }
        public Builder recipientRole(String recipientRole) {
            this.recipientRole = recipientRole;
            return this;
        }
        public Builder recipientId(String recipientId) {
            this.recipientId = recipientId;
            return this;
        }
        public Builder title(String title) {
            this.title = title;
            return this;
        }
        public Builder message(String message) {
            this.message = message;
            return this;
        }
        public Builder readStatus(Boolean readStatus) {
            this.readStatus = readStatus;
            return this;
        }
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Notification build() {
            return new Notification(id, recipientRole, recipientId, title, message, readStatus, createdAt);
        }
    }

}
