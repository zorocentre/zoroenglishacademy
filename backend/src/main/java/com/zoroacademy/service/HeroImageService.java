package com.zoroacademy.service;

import com.zoroacademy.dto.HeroImageOrderDto;
import com.zoroacademy.dto.HeroImageRequest;
import com.zoroacademy.entity.HeroImage;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.HeroImageRepository;
import com.zoroacademy.service.storage.StorageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class HeroImageService {

    private static final Logger log = LoggerFactory.getLogger(HeroImageService.class);

    private final HeroImageRepository heroImageRepository;
    private final FileStorageService fileStorageService;
    private final StorageProvider storageProvider;

    @Autowired
    public HeroImageService(
            HeroImageRepository heroImageRepository,
            FileStorageService fileStorageService,
            @Autowired(required = false) StorageProvider storageProvider
    ) {
        this.heroImageRepository = heroImageRepository;
        this.fileStorageService = fileStorageService;
        this.storageProvider = storageProvider;
    }

    public List<HeroImage> getActiveHeroImages() {
        return heroImageRepository.findByActiveTrueOrderBySortOrderAscCreatedAtAsc();
    }

    public List<HeroImage> getAllHeroImages() {
        return heroImageRepository.findAllByOrderBySortOrderAscCreatedAtAsc();
    }

    private String normalizeHostFreeUrl(String url) {
        if (url == null || url.isBlank()) return url;
        String trimmed = url.trim();
        if (trimmed.contains("/api/files/")) {
            return trimmed.substring(trimmed.indexOf("/api/files/"));
        }
        return trimmed;
    }

    @Transactional
    public HeroImage createHeroImage(HeroImageRequest request) {
        if (request == null || request.getUrl() == null || request.getUrl().isBlank()) {
            throw new BadRequestException("Hero image URL is required");
        }

        Integer sortOrder = request.getSortOrder();
        if (sortOrder == null) {
            sortOrder = heroImageRepository.findTopByOrderBySortOrderDesc()
                    .map(h -> (h.getSortOrder() != null ? h.getSortOrder() : 0) + 1)
                    .orElse(0);
        }

        String id = "hero_" + UUID.randomUUID().toString();
        String effectiveUrl = normalizeHostFreeUrl(request.getUrl());
        HeroImage heroImage = new HeroImage(
                id,
                effectiveUrl,
                request.getStorageKey(),
                sortOrder,
                request.getAltText(),
                request.getActive() != null ? request.getActive() : true
        );

        return heroImageRepository.save(heroImage);
    }

    @Transactional
    public HeroImage updateHeroImage(String id, HeroImageRequest request) {
        HeroImage heroImage = heroImageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hero image not found with id: " + id));

        if (request.getUrl() != null && !request.getUrl().isBlank()) {
            heroImage.setUrl(normalizeHostFreeUrl(request.getUrl()));
        }
        if (request.getStorageKey() != null) {
            heroImage.setStorageKey(request.getStorageKey());
        }
        if (request.getAltText() != null) {
            heroImage.setAltText(request.getAltText());
        }
        if (request.getActive() != null) {
            heroImage.setActive(request.getActive());
        }
        if (request.getSortOrder() != null) {
            heroImage.setSortOrder(request.getSortOrder());
        }

        return heroImageRepository.save(heroImage);
    }

    @Transactional
    public List<HeroImage> updateOrders(List<HeroImageOrderDto> orders) {
        if (orders != null) {
            for (HeroImageOrderDto orderDto : orders) {
                if (orderDto.getId() != null && orderDto.getSortOrder() != null) {
                    heroImageRepository.findById(orderDto.getId()).ifPresent(image -> {
                        image.setSortOrder(orderDto.getSortOrder());
                        heroImageRepository.save(image);
                    });
                }
            }
        }
        return getAllHeroImages();
    }

    @Transactional
    public void deleteHeroImage(String id) {
        HeroImage heroImage = heroImageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hero image not found with id: " + id));

        String storageKey = heroImage.getStorageKey();
        if (storageKey != null && !storageKey.isBlank()) {
            try {
                // If it corresponds to a stored_files record, delete via fileStorageService
                fileStorageService.deleteFile(storageKey);
            } catch (Exception e) {
                log.warn("Failed to delete stored file with id {}: {}", storageKey, e.getMessage());
            }

            if (storageProvider != null && storageKey.contains("/")) {
                try {
                    storageProvider.delete(storageKey);
                } catch (Exception e) {
                    log.warn("Failed to delete storage path {}: {}", storageKey, e.getMessage());
                }
            }
        }

        heroImageRepository.delete(heroImage);
        log.info("Deleted hero image {} and purged associated storage", id);
    }
}
