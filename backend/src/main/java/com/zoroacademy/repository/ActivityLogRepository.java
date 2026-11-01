package com.zoroacademy.repository;

import com.zoroacademy.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, String> {

    @Query("SELECT a FROM ActivityLog a WHERE " +
           "(:module IS NULL OR :module = '' OR :module = 'ALL' OR a.module = :module) AND " +
           "(:action IS NULL OR :action = '' OR :action = 'ALL' OR a.action = :action) AND " +
           "(:actor IS NULL OR :actor = '' OR :actor = 'ALL' OR LOWER(a.userName) LIKE LOWER(CONCAT('%', :actor, '%')) OR a.userId = :actor) AND " +
           "(CAST(:fromTime AS timestamp) IS NULL OR a.createdAt >= :fromTime) AND " +
           "(CAST(:toTime AS timestamp) IS NULL OR a.createdAt <= :toTime) " +
           "ORDER BY a.createdAt DESC")
    List<ActivityLog> filterLogs(
            @Param("module") String module,
            @Param("action") String action,
            @Param("actor") String actor,
            @Param("fromTime") LocalDateTime fromTime,
            @Param("toTime") LocalDateTime toTime);

    List<ActivityLog> findAllByOrderByCreatedAtDesc();
}
