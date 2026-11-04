package com.zoroacademy.repository;

import com.zoroacademy.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, String> {
    List<Schedule> findByBatchIgnoreCase(String batch);
    List<Schedule> findByCourseIgnoreCase(String course);
    List<Schedule> findByTrainerIgnoreCase(String trainer);
    List<Schedule> findByTrainerId(String trainerId);
    List<Schedule> findByCourseId(String courseId);
    List<Schedule> findByBatchId(String batchId);
    List<Schedule> findByTrainerIdOrderByDateAsc(String trainerId);
    List<Schedule> findByTrainerIdOrTrainerIgnoreCaseOrderByDateAsc(String trainerId, String trainer);
    List<Schedule> findByDate(String date);
    List<Schedule> findAllByOrderByDateAsc();

    List<Schedule> findByAudienceIgnoreCase(String audience);

    List<Schedule> findBySalaryPaymentId(String salaryPaymentId);

    List<Schedule> findByIdIn(List<String> ids);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Schedule s WHERE " +
            "(:trainerId IS NULL OR :trainerId = '' OR s.trainerId = :trainerId OR LOWER(s.trainer) = LOWER(:trainerId)) AND " +
            "(:fromDate IS NULL OR :fromDate = '' OR s.date >= :fromDate) AND " +
            "(:toDate IS NULL OR :toDate = '' OR s.date <= :toDate) " +
            "ORDER BY s.date DESC, s.time DESC")
    List<Schedule> findOnlineSessionHistory(
            @org.springframework.data.repository.query.Param("trainerId") String trainerId,
            @org.springframework.data.repository.query.Param("fromDate") String fromDate,
            @org.springframework.data.repository.query.Param("toDate") String toDate);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Schedule s WHERE " +
            "(s.trainerId = :trainerId OR (s.trainer IS NOT NULL AND LOWER(s.trainer) = LOWER(:trainerName))) AND " +
            "s.date >= :fromDate AND s.date <= :toDate AND " +
            "s.trainerJoined = true AND s.salaryPaymentId IS NULL AND " +
            "(s.status IS NULL OR LOWER(s.status) <> 'cancelled') " +
            "ORDER BY s.date ASC, s.time ASC")
    List<Schedule> findUnpaidCreditedSessions(
            @org.springframework.data.repository.query.Param("trainerId") String trainerId,
            @org.springframework.data.repository.query.Param("trainerName") String trainerName,
            @org.springframework.data.repository.query.Param("fromDate") String fromDate,
            @org.springframework.data.repository.query.Param("toDate") String toDate);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Schedule s WHERE s.notesFileUrl LIKE %:fileId% OR s.worksheetFileUrl LIKE %:fileId% OR s.assignmentFileUrl LIKE %:fileId%")
    List<Schedule> findByAnyFileUrlContaining(@org.springframework.data.repository.query.Param("fileId") String fileId);
}
