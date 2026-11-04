package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "salary_payment_schedules",
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_salary_payment_schedule", columnNames = {"schedule_id"})
       })
public class SalaryPaymentSchedule {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "salary_payment_id", nullable = false, length = 128)
    private String salaryPaymentId;

    @Column(name = "schedule_id", nullable = false, length = 128)
    private String scheduleId;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public SalaryPaymentSchedule() {}

    public SalaryPaymentSchedule(String id, String salaryPaymentId, String scheduleId, Integer durationMinutes) {
        this.id = id;
        this.salaryPaymentId = salaryPaymentId;
        this.scheduleId = scheduleId;
        this.durationMinutes = durationMinutes != null ? durationMinutes : 0;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSalaryPaymentId() {
        return salaryPaymentId;
    }

    public void setSalaryPaymentId(String salaryPaymentId) {
        this.salaryPaymentId = salaryPaymentId;
    }

    public String getScheduleId() {
        return scheduleId;
    }

    public void setScheduleId(String scheduleId) {
        this.scheduleId = scheduleId;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes != null ? durationMinutes : 0;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
