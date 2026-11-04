package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.entity.SalaryRecord;
import com.zoroacademy.entity.Schedule;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.SalaryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/salary-records")
public class SalaryController {

    private final SalaryService salaryService;

    public SalaryController(SalaryService salaryService) {
        this.salaryService = salaryService;
    }

    @GetMapping
    public ApiResponse<List<SalaryRecord>> getAllSalaryRecords() {
        return ApiResponse.ok(salaryService.getAllSalaryRecords());
    }

    @GetMapping("/trainer/{trainerId}")
    public ApiResponse<List<SalaryRecord>> getTrainerSalaryRecords(@PathVariable String trainerId) {
        return ApiResponse.ok(salaryService.getTrainerSalaryRecords(trainerId));
    }

    @GetMapping("/{id}/sessions")
    public ApiResponse<List<Schedule>> getPaymentSessions(@PathVariable String id) {
        return ApiResponse.ok(salaryService.getPaymentSessions(id));
    }

    @PostMapping
    public ApiResponse<SalaryRecord> createSalaryRecord(
            @RequestBody SalaryRecord record,
            @AuthenticationPrincipal UserPrincipal principal) {
        String adminUser = principal != null ? (principal.getName() != null ? principal.getName() : principal.getUsername()) : "Admin";
        return ApiResponse.ok(salaryService.createSalaryRecord(record, adminUser), "Salary record created");
    }

    @PutMapping("/{id}")
    public ApiResponse<SalaryRecord> updateSalaryRecord(@PathVariable String id, @RequestBody SalaryRecord record) {
        return ApiResponse.ok(salaryService.updateSalaryRecord(id, record), "Salary record updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteSalaryRecord(@PathVariable String id) {
        salaryService.deleteSalaryRecord(id);
        return ApiResponse.ok(true, "Salary record deleted successfully");
    }
}
