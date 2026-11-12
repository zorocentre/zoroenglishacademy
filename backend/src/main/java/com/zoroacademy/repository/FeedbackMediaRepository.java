package com.zoroacademy.repository;

import com.zoroacademy.entity.FeedbackMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeedbackMediaRepository extends JpaRepository<FeedbackMedia, String> {

    List<FeedbackMedia> findAllByOrderBySortOrderAscCreatedAtAsc();

    List<FeedbackMedia> findByStatusOrderBySortOrderAscCreatedAtAsc(String status);

    Optional<FeedbackMedia> findTopByOrderBySortOrderDesc();

    Optional<FeedbackMedia> findByBunnyVideoId(String bunnyVideoId);

    Optional<FeedbackMedia> findByStoredFileId(String storedFileId);
}
