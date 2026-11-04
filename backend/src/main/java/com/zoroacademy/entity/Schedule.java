package com.zoroacademy.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @Column(length = 128)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String course;

    @Column(name = "course_id", length = 128)
    private String courseId;

    @Column(name = "batch")
    private String batch;

    @Column(name = "batch_id", length = 128)
    private String batchId;

    @Column(name = "trainer")
    private String trainer;

    @Column(name = "trainer_id", length = 64)
    private String trainerId;

    @Column(nullable = false, length = 100)
    private String time;

    @Column(nullable = false, length = 50)
    private String date;

    @Column(name = "meet_link", columnDefinition = "TEXT")
    private String meetLink;

    @Column(name = "students_count")
    private Integer studentsCount = 25;

    @Column(length = 50)
    private String status = "Upcoming";

    @Column(name = "notes_file_url", columnDefinition = "TEXT")
    private String notesFileUrl;

    @Column(name = "notes_file_name")
    private String notesFileName;

    @Column(name = "worksheet_file_url", columnDefinition = "TEXT")
    private String worksheetFileUrl;

    @Column(name = "worksheet_file_name")
    private String worksheetFileName;

    @Column(name = "assignment_file_url", columnDefinition = "TEXT")
    private String assignmentFileUrl;

    @Column(name = "assignment_file_name")
    private String assignmentFileName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "start_time", length = 10)
    private String startTime;

    @Column(name = "end_time", length = 10)
    private String endTime;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(length = 20)
    private String audience = "STUDENT";

    @Column(name = "trainer_joined", nullable = false)
    private Boolean trainerJoined = false;

    @Column(name = "credited_duration_minutes", nullable = false)
    private Integer creditedDurationMinutes = 0;

    @Column(name = "credited_at")
    private LocalDateTime creditedAt;

    @Column(name = "salary_payment_id", length = 128)
    private String salaryPaymentId;

    @Transient
    private Boolean locked;

    @Transient
    private String unlockTimeLabel;

    @Transient
    private String serverNow;

    @JsonProperty("locked")
    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }

    @JsonProperty("unlockTimeLabel")
    public String getUnlockTimeLabel() {
        return unlockTimeLabel;
    }

    public void setUnlockTimeLabel(String unlockTimeLabel) {
        this.unlockTimeLabel = unlockTimeLabel;
    }

    @JsonProperty("serverNow")
    public String getServerNow() {
        return serverNow;
    }

    public void setServerNow(String serverNow) {
        this.serverNow = serverNow;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public LocalDateTime getStartAt() {
        return startAt;
    }

    public void setStartAt(LocalDateTime startAt) {
        this.startAt = startAt;
    }

    public LocalDateTime getEndAt() {
        return endAt;
    }

    public void setEndAt(LocalDateTime endAt) {
        this.endAt = endAt;
    }

    public String getAudience() {
        return audience != null ? audience : "STUDENT";
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    public Boolean getTrainerJoined() {
        return trainerJoined;
    }

    public void setTrainerJoined(Boolean trainerJoined) {
        this.trainerJoined = trainerJoined != null ? trainerJoined : false;
    }

    public Integer getCreditedDurationMinutes() {
        return creditedDurationMinutes;
    }

    public void setCreditedDurationMinutes(Integer creditedDurationMinutes) {
        this.creditedDurationMinutes = creditedDurationMinutes != null ? creditedDurationMinutes : 0;
    }

    public LocalDateTime getCreditedAt() {
        return creditedAt;
    }

    public void setCreditedAt(LocalDateTime creditedAt) {
        this.creditedAt = creditedAt;
    }

    public String getSalaryPaymentId() {
        return salaryPaymentId;
    }

    public void setSalaryPaymentId(String salaryPaymentId) {
        this.salaryPaymentId = salaryPaymentId;
    }

    public Schedule() {}

    public Schedule(String id, String title, String course, String courseId, String batch, String batchId,
                    String trainer, String trainerId, String time, String date, String meetLink,
                    Integer studentsCount, String status, String notesFileUrl, String notesFileName,
                    String worksheetFileUrl, String worksheetFileName, String assignmentFileUrl,
                    String assignmentFileName, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.title = title;
        this.course = course;
        this.courseId = courseId;
        this.batch = batch;
        this.batchId = batchId;
        this.trainer = trainer;
        this.trainerId = trainerId;
        this.time = time;
        this.date = date;
        this.meetLink = meetLink;
        this.studentsCount = studentsCount;
        this.status = status;
        this.notesFileUrl = notesFileUrl;
        this.notesFileName = notesFileName;
        this.worksheetFileUrl = worksheetFileUrl;
        this.worksheetFileName = worksheetFileName;
        this.assignmentFileUrl = assignmentFileUrl;
        this.assignmentFileName = assignmentFileName;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCourse() {
        return course;
    }

    public void setCourse(String course) {
        this.course = course;
    }

    public String getCourseId() {
        return courseId;
    }

    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getBatch() {
        return batch;
    }

    public void setBatch(String batch) {
        this.batch = batch;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getTrainer() {
        return trainer;
    }

    public void setTrainer(String trainer) {
        this.trainer = trainer;
    }

    public String getTrainerId() {
        return trainerId;
    }

    public void setTrainerId(String trainerId) {
        this.trainerId = trainerId;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public String getMeetLink() {
        return meetLink;
    }

    public void setMeetLink(String meetLink) {
        this.meetLink = meetLink;
    }

    public Integer getStudentsCount() {
        return studentsCount;
    }

    public void setStudentsCount(Integer studentsCount) {
        this.studentsCount = studentsCount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNotesFileUrl() {
        return notesFileUrl;
    }

    public void setNotesFileUrl(String notesFileUrl) {
        this.notesFileUrl = notesFileUrl;
    }

    public String getNotesFileName() {
        return notesFileName;
    }

    public void setNotesFileName(String notesFileName) {
        this.notesFileName = notesFileName;
    }

    @JsonProperty("notesFile")
    public Map<String, Object> getNotesFile() {
        if (notesFileUrl == null && notesFileName == null) return null;
        Map<String, Object> map = new HashMap<>();
        map.put("fileUrl", notesFileUrl);
        map.put("name", notesFileName != null ? notesFileName : "Notes");
        return map;
    }

    @JsonProperty("notesFile")
    public void setNotesFile(Object notesFile) {
        if (notesFile instanceof Map<?, ?> map) {
            Object url = map.get("fileUrl");
            if (url == null) url = map.get("url");
            if (url != null) this.notesFileUrl = url.toString().trim();
            Object name = map.get("name");
            if (name != null) this.notesFileName = name.toString().trim();
        } else if (notesFile instanceof String str && !str.isBlank()) {
            this.notesFileUrl = str.trim();
        }
    }

    public String getWorksheetFileUrl() {
        return worksheetFileUrl;
    }

    public void setWorksheetFileUrl(String worksheetFileUrl) {
        this.worksheetFileUrl = worksheetFileUrl;
    }

    public String getWorksheetFileName() {
        return worksheetFileName;
    }

    public void setWorksheetFileName(String worksheetFileName) {
        this.worksheetFileName = worksheetFileName;
    }

    @JsonProperty("worksheetFile")
    public Map<String, Object> getWorksheetFile() {
        if (worksheetFileUrl == null && worksheetFileName == null) return null;
        Map<String, Object> map = new HashMap<>();
        map.put("fileUrl", worksheetFileUrl);
        map.put("name", worksheetFileName != null ? worksheetFileName : "Worksheet");
        return map;
    }

    @JsonProperty("worksheetFile")
    public void setWorksheetFile(Object worksheetFile) {
        if (worksheetFile instanceof Map<?, ?> map) {
            Object url = map.get("fileUrl");
            if (url == null) url = map.get("url");
            if (url != null) this.worksheetFileUrl = url.toString().trim();
            Object name = map.get("name");
            if (name != null) this.worksheetFileName = name.toString().trim();
        } else if (worksheetFile instanceof String str && !str.isBlank()) {
            this.worksheetFileUrl = str.trim();
        }
    }

    public String getAssignmentFileUrl() {
        return assignmentFileUrl;
    }

    public void setAssignmentFileUrl(String assignmentFileUrl) {
        this.assignmentFileUrl = assignmentFileUrl;
    }

    public String getAssignmentFileName() {
        return assignmentFileName;
    }

    public void setAssignmentFileName(String assignmentFileName) {
        this.assignmentFileName = assignmentFileName;
    }

    @JsonProperty("assignmentFile")
    public Map<String, Object> getAssignmentFile() {
        if (assignmentFileUrl == null && assignmentFileName == null) return null;
        Map<String, Object> map = new HashMap<>();
        map.put("fileUrl", assignmentFileUrl);
        map.put("name", assignmentFileName != null ? assignmentFileName : "Assignment");
        return map;
    }

    @JsonProperty("assignmentFile")
    public void setAssignmentFile(Object assignmentFile) {
        if (assignmentFile instanceof Map<?, ?> map) {
            Object url = map.get("fileUrl");
            if (url == null) url = map.get("url");
            if (url != null) this.assignmentFileUrl = url.toString().trim();
            Object name = map.get("name");
            if (name != null) this.assignmentFileName = name.toString().trim();
        } else if (assignmentFile instanceof String str && !str.isBlank()) {
            this.assignmentFileUrl = str.trim();
        }
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

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String title;
        private String course;
        private String courseId;
        private String batch;
        private String batchId;
        private String trainer;
        private String trainerId;
        private String time;
        private String date;
        private String meetLink;
        private Integer studentsCount = 25;
        private String status = "Upcoming";
        private String notesFileUrl;
        private String notesFileName;
        private String worksheetFileUrl;
        private String worksheetFileName;
        private String assignmentFileUrl;
        private String assignmentFileName;
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
        public Builder course(String course) {
            this.course = course;
            return this;
        }
        public Builder courseId(String courseId) {
            this.courseId = courseId;
            return this;
        }
        public Builder batch(String batch) {
            this.batch = batch;
            return this;
        }
        public Builder batchId(String batchId) {
            this.batchId = batchId;
            return this;
        }
        public Builder trainer(String trainer) {
            this.trainer = trainer;
            return this;
        }
        public Builder trainerId(String trainerId) {
            this.trainerId = trainerId;
            return this;
        }
        public Builder time(String time) {
            this.time = time;
            return this;
        }
        public Builder date(String date) {
            this.date = date;
            return this;
        }
        public Builder meetLink(String meetLink) {
            this.meetLink = meetLink;
            return this;
        }
        public Builder studentsCount(Integer studentsCount) {
            this.studentsCount = studentsCount;
            return this;
        }
        public Builder status(String status) {
            this.status = status;
            return this;
        }
        public Builder notesFileUrl(String notesFileUrl) {
            this.notesFileUrl = notesFileUrl;
            return this;
        }
        public Builder notesFileName(String notesFileName) {
            this.notesFileName = notesFileName;
            return this;
        }
        public Builder worksheetFileUrl(String worksheetFileUrl) {
            this.worksheetFileUrl = worksheetFileUrl;
            return this;
        }
        public Builder worksheetFileName(String worksheetFileName) {
            this.worksheetFileName = worksheetFileName;
            return this;
        }
        public Builder assignmentFileUrl(String assignmentFileUrl) {
            this.assignmentFileUrl = assignmentFileUrl;
            return this;
        }
        public Builder assignmentFileName(String assignmentFileName) {
            this.assignmentFileName = assignmentFileName;
            return this;
        }
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public Schedule build() {
            return new Schedule(id, title, course, courseId, batch, batchId, trainer, trainerId, time, date,
                    meetLink, studentsCount, status, notesFileUrl, notesFileName, worksheetFileUrl,
                    worksheetFileName, assignmentFileUrl, assignmentFileName, createdAt, updatedAt);
        }
    }

}
