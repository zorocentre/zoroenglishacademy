package com.zoroacademy.repository;

import com.zoroacademy.entity.CompetitionRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompetitionRegistrationRepository extends JpaRepository<CompetitionRegistration, String> {
    @Query("SELECT r FROM CompetitionRegistration r WHERE r.competition.id = :competitionId")
    List<CompetitionRegistration> findByCompetitionId(@Param("competitionId") String competitionId);

    List<CompetitionRegistration> findByStudentId(String studentId);

    List<CompetitionRegistration> findByStudentEmailIgnoreCase(String studentEmail);

    @Query("SELECT r FROM CompetitionRegistration r WHERE r.competition.id = :competitionId AND r.studentId = :studentId")
    Optional<CompetitionRegistration> findByCompetitionIdAndStudentId(@Param("competitionId") String competitionId, @Param("studentId") String studentId);

    @Query("SELECT r FROM CompetitionRegistration r WHERE r.competition.id = :competitionId AND LOWER(r.studentEmail) = LOWER(:studentEmail)")
    Optional<CompetitionRegistration> findByCompetitionIdAndStudentEmailIgnoreCase(@Param("competitionId") String competitionId, @Param("studentEmail") String studentEmail);

    @Query("SELECT r FROM CompetitionRegistration r WHERE r.competition.id = :competitionId AND r.studentPhone = :studentPhone")
    Optional<CompetitionRegistration> findByCompetitionIdAndStudentPhone(@Param("competitionId") String competitionId, @Param("studentPhone") String studentPhone);

    Optional<CompetitionRegistration> findByRazorpayOrderId(String razorpayOrderId);

    List<CompetitionRegistration> findByPaymentStatusAndCreatedAtBefore(String paymentStatus, LocalDateTime cutoff);

    List<CompetitionRegistration> findByPaymentStatusInAndCreatedAtBefore(List<String> statuses, LocalDateTime cutoff);

    @Query("SELECT COALESCE(SUM(COALESCE(r.amount, c.registrationFee, 0)), 0) FROM CompetitionRegistration r JOIN r.competition c WHERE LOWER(r.paymentStatus) IN ('paid', 'success')")
    java.math.BigDecimal sumPaidCompetitionFees();
}
