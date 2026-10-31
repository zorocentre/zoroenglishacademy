package com.zoroacademy.repository;

import com.zoroacademy.entity.CompetitionActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface CompetitionActivityLogRepository extends JpaRepository<CompetitionActivityLog, String> {

    @Query("SELECT c FROM CompetitionActivityLog c WHERE " +
           "(:compId IS NULL OR :compId = '' OR c.competitionId = :compId) AND " +
           "(:eventType IS NULL OR :eventType = '' OR c.eventType = :eventType) AND " +
           "(CAST(:fromTime AS timestamp) IS NULL OR c.createdAt >= :fromTime) AND " +
           "(CAST(:toTime AS timestamp) IS NULL OR c.createdAt <= :toTime) " +
           "ORDER BY c.createdAt DESC")
    List<CompetitionActivityLog> filterLogs(
            @Param("compId") String compId,
            @Param("eventType") String eventType,
            @Param("fromTime") OffsetDateTime fromTime,
            @Param("toTime") OffsetDateTime toTime);

    List<CompetitionActivityLog> findAllByOrderByCreatedAtDesc();
}
