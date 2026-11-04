package com.zoroacademy.repository;

import com.zoroacademy.entity.SalaryPaymentSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryPaymentScheduleRepository extends JpaRepository<SalaryPaymentSchedule, String> {

    List<SalaryPaymentSchedule> findBySalaryPaymentId(String salaryPaymentId);

    Optional<SalaryPaymentSchedule> findByScheduleId(String scheduleId);

    boolean existsByScheduleId(String scheduleId);

    void deleteBySalaryPaymentId(String salaryPaymentId);
}
