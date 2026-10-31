package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "competition_activity_logs")
public class CompetitionActivityLog {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "competition_id", nullable = false, length = 128)
    private String competitionId;

    @Column(name = "competition_title", length = 255)
    private String competitionTitle;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "actor_id", length = 128)
    private String actorId;

    @Column(name = "actor_name", length = 255)
    private String actorName;

    @Column(name = "actor_role", length = 64)
    private String actorRole;

    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public CompetitionActivityLog() {}

    public CompetitionActivityLog(String id, String competitionId, String competitionTitle, String eventType,
                                  String actorId, String actorName, String actorRole, String details, OffsetDateTime createdAt) {
        this.id = id;
        this.competitionId = competitionId;
        this.competitionTitle = competitionTitle;
        this.eventType = eventType;
        this.actorId = actorId;
        this.actorName = actorName;
        this.actorRole = actorRole;
        this.details = details;
        this.createdAt = createdAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String competitionId;
        private String competitionTitle;
        private String eventType;
        private String actorId;
        private String actorName;
        private String actorRole;
        private String details;
        private OffsetDateTime createdAt;

        public Builder id(String id) { this.id = id; return this; }
        public Builder competitionId(String competitionId) { this.competitionId = competitionId; return this; }
        public Builder competitionTitle(String competitionTitle) { this.competitionTitle = competitionTitle; return this; }
        public Builder eventType(String eventType) { this.eventType = eventType; return this; }
        public Builder actorId(String actorId) { this.actorId = actorId; return this; }
        public Builder actorName(String actorName) { this.actorName = actorName; return this; }
        public Builder actorRole(String actorRole) { this.actorRole = actorRole; return this; }
        public Builder details(String details) { this.details = details; return this; }
        public Builder createdAt(OffsetDateTime createdAt) { this.createdAt = createdAt; return this; }

        public CompetitionActivityLog build() {
            return new CompetitionActivityLog(id, competitionId, competitionTitle, eventType, actorId, actorName, actorRole, details, createdAt);
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCompetitionId() { return competitionId; }
    public void setCompetitionId(String competitionId) { this.competitionId = competitionId; }

    public String getCompetitionTitle() { return competitionTitle; }
    public void setCompetitionTitle(String competitionTitle) { this.competitionTitle = competitionTitle; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
