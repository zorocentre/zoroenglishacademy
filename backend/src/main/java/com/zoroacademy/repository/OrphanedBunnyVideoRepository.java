package com.zoroacademy.repository;

import com.zoroacademy.entity.OrphanedBunnyVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrphanedBunnyVideoRepository extends JpaRepository<OrphanedBunnyVideo, String> {
    Optional<OrphanedBunnyVideo> findByBunnyVideoId(String bunnyVideoId);
    boolean existsByBunnyVideoId(String bunnyVideoId);
    List<OrphanedBunnyVideo> findByOrphanedAtBefore(OffsetDateTime cutoff);
}
