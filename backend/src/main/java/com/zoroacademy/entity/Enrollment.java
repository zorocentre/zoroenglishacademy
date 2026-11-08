package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "enrollments", uniqueConstraints = {
    @UniqueConstraint(name = "uk_enrollments_student_course", columnNames = {"student_id", "course_id"})
})
public class Enrollment {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "student_id", nullable = false, length = 64)
    private String studentId;

    @Column(name = "student_email", nullable = false)
    private String studentEmail;

    @Column(name = "course_id", nullable = false, length = 128)
    private String courseId;

    @Column(name = "course_title")
    private String courseTitle;

    @Column(name = "batch_name")
    private String batchName;

    @Column(name = "batch_id", length = 128)
    private String batchId;

    @Column(name = "enrolled_date", length = 50)
    private String enrolledDate;

    @Column(length = 50)
    private String status = "Active";

    @Column(name = "course_total_fee", precision = 12, scale = 2)
    private java.math.BigDecimal courseTotalFee;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Transient
    private String courseMode;

    @Transient
    private String trainerId;

    @Transient
    private String trainerName;

    @Transient
    private java.util.List<java.util.Map<String, String>> trainers;

    public Enrollment() {}

    public Enrollment(String id, String studentId, String studentEmail, String courseId, String courseTitle, String batchName, String batchId, String enrolledDate, String status, LocalDateTime createdAt) {
        this.id = id;
        this.studentId = studentId;
        this.studentEmail = studentEmail;
        this.courseId = courseId;
        this.courseTitle = courseTitle;
        this.batchName = batchName;
        this.batchId = batchId;
        this.enrolledDate = enrolledDate;
        this.status = status;
        this.createdAt = createdAt;
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

    public String getStudentEmail() {
        return studentEmail;
    }

    public void setStudentEmail(String studentEmail) {
        this.studentEmail = studentEmail;
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

    public String getBatchName() {
        return batchName;
    }

    public void setBatchName(String batchName) {
        this.batchName = batchName;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getEnrolledDate() {
        return enrolledDate;
    }

    public void setEnrolledDate(String enrolledDate) {
        this.enrolledDate = enrolledDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public java.math.BigDecimal getCourseTotalFee() {
        return courseTotalFee;
    }

    public void setCourseTotalFee(java.math.BigDecimal courseTotalFee) {
        this.courseTotalFee = courseTotalFee;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getCourseMode() {
        return courseMode;
    }

    public void setCourseMode(String courseMode) {
        this.courseMode = courseMode;
    }

    public String getTrainerId() {
        return trainerId;
    }

    public void setTrainerId(String trainerId) {
        this.trainerId = trainerId;
    }

    public String getTrainerName() {
        return trainerName;
    }

    public void setTrainerName(String trainerName) {
        this.trainerName = trainerName;
    }

    public java.util.List<java.util.Map<String, String>> getTrainers() {
        return trainers;
    }

    public void setTrainers(java.util.List<java.util.Map<String, String>> trainers) {
        this.trainers = trainers;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String studentId;
        private String studentEmail;
        private String courseId;
        private String courseTitle;
        private String batchName;
        private String batchId;
        private String enrolledDate;
        private String status = "Active";
        private LocalDateTime createdAt;

        public Builder id(String id) {
            this.id = id;
            return this;
        }
        public Builder studentId(String studentId) {
            this.studentId = studentId;
            return this;
        }
        public Builder studentEmail(String studentEmail) {
            this.studentEmail = studentEmail;
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
        public Builder batchName(String batchName) {
            this.batchName = batchName;
            return this;
        }
        public Builder batchId(String batchId) {
            this.batchId = batchId;
            return this;
        }
        public Builder enrolledDate(String enrolledDate) {
            this.enrolledDate = enrolledDate;
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

        public Enrollment build() {
            return new Enrollment(id, studentId, studentEmail, courseId, courseTitle, batchName, batchId, enrolledDate, status, createdAt);
        }
    }

}
