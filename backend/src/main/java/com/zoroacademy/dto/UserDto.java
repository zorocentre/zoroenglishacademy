package com.zoroacademy.dto;

import com.zoroacademy.entity.User;
import java.math.BigDecimal;

public class UserDto {
    private String id;
    private String email;
    private String username;
    private String name;
    private String role;
    private String phone;
    private String avatar;
    private String status;
    private String address;
    private String joinedOn;
    private String specialty;
    private String code;
    private BigDecimal salaryAmount;
    private String salaryCreditDate;
    private String course;
    private String batch;
    private String batchId;
    private String origin = "LEARNING";
    private Boolean hasCourseEnrollment;
    private Boolean hasCompetitionRegistration;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private String password;
    private Boolean mustChangePassword = false;
    private java.util.List<java.util.Map<String, Object>> courseBatches;
    private Boolean existingCompetitionAccount;
    private String candidateName;
    private java.util.List<String> competitions;
    private Boolean confirmExistingCompetitionAccount;

    public UserDto() {}

    public UserDto(String id, String email, String username, String name, String role, String phone,
                   String avatar, String status, String address, String joinedOn, String specialty,
                   String code, BigDecimal salaryAmount, String salaryCreditDate, String course) {
        this.id = id;
        this.email = email;
        this.username = username;
        this.name = name;
        this.role = role;
        this.phone = phone;
        this.avatar = avatar;
        this.status = status;
        this.address = address;
        this.joinedOn = joinedOn;
        this.specialty = specialty;
        this.code = code;
        this.salaryAmount = salaryAmount;
        this.salaryCreditDate = salaryCreditDate;
        this.course = course;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getJoinedOn() { return joinedOn; }
    public void setJoinedOn(String joinedOn) { this.joinedOn = joinedOn; }
    public String getSpecialty() { return specialty; }
    public void setSpecialty(String specialty) { this.specialty = specialty; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public BigDecimal getSalaryAmount() { return salaryAmount; }
    public void setSalaryAmount(BigDecimal salaryAmount) { this.salaryAmount = salaryAmount; }
    public String getSalaryCreditDate() { return salaryCreditDate; }
    public void setSalaryCreditDate(String salaryCreditDate) { this.salaryCreditDate = salaryCreditDate; }
    public String getCourse() { return course; }
    public void setCourse(String course) { this.course = course; }
    public String getBatch() { return batch; }
    public void setBatch(String batch) { this.batch = batch; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public Boolean getMustChangePassword() { return mustChangePassword != null ? mustChangePassword : false; }
    public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getOrigin() { return origin != null ? origin : "LEARNING"; }
    public void setOrigin(String origin) { this.origin = origin != null ? origin : "LEARNING"; }
    public Boolean getHasCourseEnrollment() { return hasCourseEnrollment; }
    public void setHasCourseEnrollment(Boolean hasCourseEnrollment) { this.hasCourseEnrollment = hasCourseEnrollment; }
    public Boolean getHasCompetitionRegistration() { return hasCompetitionRegistration; }
    public void setHasCompetitionRegistration(Boolean hasCompetitionRegistration) { this.hasCompetitionRegistration = hasCompetitionRegistration; }
    public java.util.List<java.util.Map<String, Object>> getCourseBatches() { return courseBatches; }
    public void setCourseBatches(java.util.List<java.util.Map<String, Object>> courseBatches) { this.courseBatches = courseBatches; }
    public Boolean getExistingCompetitionAccount() { return existingCompetitionAccount; }
    public void setExistingCompetitionAccount(Boolean existingCompetitionAccount) { this.existingCompetitionAccount = existingCompetitionAccount; }
    public String getCandidateName() { return candidateName; }
    public void setCandidateName(String candidateName) { this.candidateName = candidateName; }
    public java.util.List<String> getCompetitions() { return competitions; }
    public void setCompetitions(java.util.List<String> competitions) { this.competitions = competitions; }
    public Boolean getConfirmExistingCompetitionAccount() { return confirmExistingCompetitionAccount; }
    public void setConfirmExistingCompetitionAccount(Boolean confirmExistingCompetitionAccount) { this.confirmExistingCompetitionAccount = confirmExistingCompetitionAccount; }

    public static UserDto fromEntity(User user) {
        if (user == null) return null;
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .name(user.getName())
                .role(user.getRole())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .status(user.getStatus())
                .address(user.getAddress())
                .joinedOn(user.getJoinedOn())
                .specialty(user.getSpecialty())
                .code(user.getCode())
                .salaryAmount(user.getSalaryAmount())
                .salaryCreditDate(user.getSalaryCreditDate())
                .course(user.getCourse())
                .origin(user.getOrigin())
                .mustChangePassword(user.getMustChangePassword())
                .build();
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String id;
        private String email;
        private String username;
        private String name;
        private String role;
        private String phone;
        private String avatar;
        private String status;
        private String address;
        private String joinedOn;
        private String specialty;
        private String code;
        private BigDecimal salaryAmount;
        private String salaryCreditDate;
        private String course;
        private String origin = "LEARNING";
        private Boolean hasCourseEnrollment;
        private Boolean hasCompetitionRegistration;
        private Boolean mustChangePassword = false;
        private String password;

        public Builder id(String id) { this.id = id; return this; }
        public Builder email(String email) { this.email = email; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder role(String role) { this.role = role; return this; }
        public Builder phone(String phone) { this.phone = phone; return this; }
        public Builder avatar(String avatar) { this.avatar = avatar; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder address(String address) { this.address = address; return this; }
        public Builder joinedOn(String joinedOn) { this.joinedOn = joinedOn; return this; }
        public Builder specialty(String specialty) { this.specialty = specialty; return this; }
        public Builder code(String code) { this.code = code; return this; }
        public Builder salaryAmount(BigDecimal salaryAmount) { this.salaryAmount = salaryAmount; return this; }
        public Builder salaryCreditDate(String salaryCreditDate) { this.salaryCreditDate = salaryCreditDate; return this; }
        public Builder course(String course) { this.course = course; return this; }
        public Builder origin(String origin) { this.origin = origin != null ? origin : "LEARNING"; return this; }
        public Builder hasCourseEnrollment(Boolean hasCourseEnrollment) { this.hasCourseEnrollment = hasCourseEnrollment; return this; }
        public Builder hasCompetitionRegistration(Boolean hasCompetitionRegistration) { this.hasCompetitionRegistration = hasCompetitionRegistration; return this; }
        public Builder mustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; return this; }
        public Builder password(String password) { this.password = password; return this; }

        public UserDto build() {
            UserDto dto = new UserDto(id, email, username, name, role, phone, avatar, status, address, joinedOn, specialty, code, salaryAmount, salaryCreditDate, course);
            dto.setPassword(password);
            dto.setOrigin(origin);
            dto.setHasCourseEnrollment(hasCourseEnrollment);
            dto.setHasCompetitionRegistration(hasCompetitionRegistration);
            dto.setMustChangePassword(mustChangePassword);
            return dto;
        }

    }
}
