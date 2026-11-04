package com.zoroacademy.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "salary_records")
public class SalaryRecord {

    @Id
    @Column(length = 128)
    private String id;

    @Column(name = "trainer_id", nullable = false, length = 64)
    private String trainerId;

    @Column(name = "trainer_name", nullable = false)
    private String trainerName;

    @Column(nullable = false, length = 50)
    private String month;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 50)
    private String status = "Paid";

    @Column(name = "payment_date", length = 50)
    private String paymentDate;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "transaction_id", length = 100)
    private String transactionId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "from_date", length = 50)
    private String fromDate;

    @Column(name = "to_date", length = 50)
    private String toDate;

    @Column(name = "online_session_salary", precision = 12, scale = 2)
    private BigDecimal onlineSessionSalary = BigDecimal.ZERO;

    @Column(name = "recorded_session_salary", precision = 12, scale = 2)
    private BigDecimal recordedSessionSalary = BigDecimal.ZERO;

    @Column(name = "total_salary", precision = 12, scale = 2)
    private BigDecimal totalSalary = BigDecimal.ZERO;

    @Column(name = "session_count")
    private Integer sessionCount = 0;

    @Column(name = "credited_hours", precision = 8, scale = 2)
    private BigDecimal creditedHours = BigDecimal.ZERO;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public SalaryRecord() {}

    public SalaryRecord(String id, String trainerId, String trainerName, String month, BigDecimal amount, String status, String paymentDate, String notes, LocalDateTime createdAt) {
        this.id = id;
        this.trainerId = trainerId;
        this.trainerName = trainerName;
        this.month = month;
        this.amount = amount;
        this.status = status;
        this.paymentDate = paymentDate;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public SalaryRecord(String id, String trainerId, String trainerName, String month, BigDecimal amount, String status, String paymentDate, String paymentMethod, String transactionId, String notes, LocalDateTime createdAt) {
        this.id = id;
        this.trainerId = trainerId;
        this.trainerName = trainerName;
        this.month = month;
        this.amount = amount;
        this.status = status;
        this.paymentDate = paymentDate;
        this.paymentMethod = paymentMethod;
        this.transactionId = transactionId;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public String getMonth() {
        return month;
    }

    public void setMonth(String month) {
        this.month = month;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(String paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getFromDate() {
        return fromDate;
    }

    public void setFromDate(String fromDate) {
        this.fromDate = fromDate;
    }

    public String getToDate() {
        return toDate;
    }

    public void setToDate(String toDate) {
        this.toDate = toDate;
    }

    public BigDecimal getOnlineSessionSalary() {
        return onlineSessionSalary;
    }

    public void setOnlineSessionSalary(BigDecimal onlineSessionSalary) {
        this.onlineSessionSalary = onlineSessionSalary != null ? onlineSessionSalary : BigDecimal.ZERO;
    }

    public BigDecimal getRecordedSessionSalary() {
        return recordedSessionSalary;
    }

    public void setRecordedSessionSalary(BigDecimal recordedSessionSalary) {
        this.recordedSessionSalary = recordedSessionSalary != null ? recordedSessionSalary : BigDecimal.ZERO;
    }

    public BigDecimal getTotalSalary() {
        return totalSalary != null && totalSalary.compareTo(BigDecimal.ZERO) > 0 ? totalSalary : amount;
    }

    public void setTotalSalary(BigDecimal totalSalary) {
        this.totalSalary = totalSalary != null ? totalSalary : BigDecimal.ZERO;
    }

    public Integer getSessionCount() {
        return sessionCount;
    }

    public void setSessionCount(Integer sessionCount) {
        this.sessionCount = sessionCount != null ? sessionCount : 0;
    }

    public BigDecimal getCreditedHours() {
        return creditedHours;
    }

    public void setCreditedHours(BigDecimal creditedHours) {
        this.creditedHours = creditedHours != null ? creditedHours : BigDecimal.ZERO;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String trainerId;
        private String trainerName;
        private String month;
        private BigDecimal amount;
        private String status = "Paid";
        private String paymentDate;
        private String paymentMethod;
        private String transactionId;
        private String notes;
        private LocalDateTime createdAt;

        public Builder id(String id) {
            this.id = id;
            return this;
        }
        public Builder trainerId(String trainerId) {
            this.trainerId = trainerId;
            return this;
        }
        public Builder trainerName(String trainerName) {
            this.trainerName = trainerName;
            return this;
        }
        public Builder month(String month) {
            this.month = month;
            return this;
        }
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }
        public Builder status(String status) {
            this.status = status;
            return this;
        }
        public Builder paymentDate(String paymentDate) {
            this.paymentDate = paymentDate;
            return this;
        }
        public Builder paymentMethod(String paymentMethod) {
            this.paymentMethod = paymentMethod;
            return this;
        }
        public Builder transactionId(String transactionId) {
            this.transactionId = transactionId;
            return this;
        }
        public Builder notes(String notes) {
            this.notes = notes;
            return this;
        }
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public SalaryRecord build() {
            return new SalaryRecord(id, trainerId, trainerName, month, amount, status, paymentDate, paymentMethod, transactionId, notes, createdAt);
        }
    }

}
