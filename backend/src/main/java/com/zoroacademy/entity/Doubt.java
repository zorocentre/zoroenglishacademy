package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "doubts")
public class Doubt {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "student_id", length = 64)
    private String studentId;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "course_id", length = 128)
    private String courseId;

    @Column(name = "course_title")
    private String courseTitle;

    @Column(name = "batch_id", length = 128)
    private String batchId;

    @Transient
    private String batchName;

    @Column(name = "module_id", length = 128)
    private String moduleId;

    @Column(name = "module_title")
    private String moduleTitle;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "trainer_name")
    private String trainerName;

    @Column(name = "trainer_id", length = 64)
    private String trainerId;

    @Column(columnDefinition = "TEXT")
    private String reply;

    @Column(name = "reply_date", length = 50)
    private String replyDate;

    @Column(length = 50)
    private String status = "Pending"; // Pending, Resolved

    @Column(name = "course_mode", length = 50)
    private String courseMode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Doubt() {}

    public Doubt(String id, String studentId, String studentName, String courseId, String courseTitle, String courseMode, String batchId, String moduleId, String moduleTitle, String question, String trainerName, String trainerId, String reply, String replyDate, String status, LocalDateTime createdAt) {
        this.id = id;
        this.studentId = studentId;
        this.studentName = studentName;
        this.courseId = courseId;
        this.courseTitle = courseTitle;
        this.courseMode = courseMode;
        this.batchId = batchId;
        this.moduleId = moduleId;
        this.moduleTitle = moduleTitle;
        this.question = question;
        this.trainerName = trainerName;
        this.trainerId = trainerId;
        this.reply = reply;
        this.replyDate = replyDate;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Doubt(String id, String studentId, String studentName, String courseId, String courseTitle, String moduleId, String moduleTitle, String question, String trainerName, String trainerId, String reply, String replyDate, String status, LocalDateTime createdAt) {
        this(id, studentId, studentName, courseId, courseTitle, null, null, moduleId, moduleTitle, question, trainerName, trainerId, reply, replyDate, status, createdAt);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getCourseId() {
        return courseId;
    }

    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getCourseTitle() {
        return courseTitle;
    }

    public void setCourseTitle(String courseTitle) {
        this.courseTitle = courseTitle;
    }

    public String getCourseMode() {
        return courseMode;
    }

    public void setCourseMode(String courseMode) {
        this.courseMode = courseMode;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getBatchName() {
        return batchName;
    }

    public void setBatchName(String batchName) {
        this.batchName = batchName;
    }

    public String getModuleId() {
        return moduleId;
    }

    public void setModuleId(String moduleId) {
        this.moduleId = moduleId;
    }

    public String getModuleTitle() {
        return moduleTitle;
    }

    public void setModuleTitle(String moduleTitle) {
        this.moduleTitle = moduleTitle;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getTrainerName() {
        return trainerName;
    }

    public void setTrainerName(String trainerName) {
        this.trainerName = trainerName;
    }

    public String getTrainerId() {
        return trainerId;
    }

    public void setTrainerId(String trainerId) {
        this.trainerId = trainerId;
    }

    public String getReply() {
        return reply;
    }

    public void setReply(String reply) {
        this.reply = reply;
    }

    public String getReplyDate() {
        return replyDate;
    }

    public void setReplyDate(String replyDate) {
        this.replyDate = replyDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
        private String studentId;
        private String studentName;
        private String courseId;
        private String courseTitle;
        private String courseMode;
        private String batchId;
        private String moduleId;
        private String moduleTitle;
        private String question;
        private String trainerName;
        private String trainerId;
        private String reply;
        private String replyDate;
        private String status = "Pending";
        private LocalDateTime createdAt;

        public Builder id(String id) {
            this.id = id;
            return this;
        }
        public Builder studentId(String studentId) {
            this.studentId = studentId;
            return this;
        }
        public Builder studentName(String studentName) {
            this.studentName = studentName;
            return this;
        }
        public Builder courseId(String courseId) {
            this.courseId = courseId;
            return this;
        }
        public Builder courseTitle(String courseTitle) {
            this.courseTitle = courseTitle;
            return this;
        }
        public Builder courseMode(String courseMode) {
            this.courseMode = courseMode;
            return this;
        }
        public Builder batchId(String batchId) {
            this.batchId = batchId;
            return this;
        }
        public Builder moduleId(String moduleId) {
            this.moduleId = moduleId;
            return this;
        }
        public Builder moduleTitle(String moduleTitle) {
            this.moduleTitle = moduleTitle;
            return this;
        }
        public Builder question(String question) {
            this.question = question;
            return this;
        }
        public Builder trainerName(String trainerName) {
            this.trainerName = trainerName;
            return this;
        }
        public Builder trainerId(String trainerId) {
            this.trainerId = trainerId;
            return this;
        }
        public Builder reply(String reply) {
            this.reply = reply;
            return this;
        }
        public Builder replyDate(String replyDate) {
            this.replyDate = replyDate;
            return this;
        }
        public Builder status(String status) {
            this.status = status;
            return this;
        }
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Doubt build() {
            return new Doubt(id, studentId, studentName, courseId, courseTitle, courseMode, batchId, moduleId, moduleTitle, question, trainerName, trainerId, reply, replyDate, status, createdAt);
        }
    }

}
