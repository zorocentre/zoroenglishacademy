package com.zoroacademy.listener;

import com.zoroacademy.event.StorageFilePurgeEvent;
import com.zoroacademy.event.StorageVideoPurgeEvent;
import com.zoroacademy.service.BunnyStreamService;
import com.zoroacademy.service.storage.StorageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class StoragePurgeListener {

    private static final Logger log = LoggerFactory.getLogger(StoragePurgeListener.class);

    private final StorageProvider storageProvider;
    private final BunnyStreamService bunnyStreamService;
    private final com.zoroacademy.repository.StoredFileRepository storedFileRepository;
    private final com.zoroacademy.repository.SystemSettingRepository systemSettingRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public StoragePurgeListener(StorageProvider storageProvider,
                                BunnyStreamService bunnyStreamService,
                                @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.StoredFileRepository storedFileRepository,
                                @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.SystemSettingRepository systemSettingRepository) {
        this.storageProvider = storageProvider;
        this.bunnyStreamService = bunnyStreamService;
        this.storedFileRepository = storedFileRepository;
        this.systemSettingRepository = systemSettingRepository;
    }

    public StoragePurgeListener(StorageProvider storageProvider, BunnyStreamService bunnyStreamService) {
        this(storageProvider, bunnyStreamService, null, null);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onFilePurge(StorageFilePurgeEvent event) {
        if (event == null || event.getStoragePath() == null || event.getStoragePath().isBlank()) {
            return;
        }
        String fileId = event.getFileId();
        String storagePath = event.getStoragePath();
        try {
            log.info("Executing post-commit Bunny/storage file purge for fileId={} path={}", fileId, storagePath);
            storageProvider.delete(storagePath);
            if (fileId != null && systemSettingRepository != null) {
                String key = "cleanup.failed." + fileId;
                if (systemSettingRepository.existsById(key)) {
                    systemSettingRepository.deleteById(key);
                }
            }
        } catch (Exception e) {
            log.error("Failed to delete storage file from provider after transaction commit for fileId={} path={}: {}",
                    fileId, storagePath, e.getMessage());
            // Section 1: Physical deletion recoverability
            // 1. Record durable failure in SystemSetting
            if (fileId != null && systemSettingRepository != null) {
                try {
                    String key = "cleanup.failed." + fileId;
                    String val = storagePath + "|" + e.getMessage() + "|" + java.time.OffsetDateTime.now();
                    systemSettingRepository.save(new com.zoroacademy.entity.SystemSetting(key, val));
                } catch (Exception recordEx) {
                    log.error("Failed to record durable failure for file {}: {}", fileId, recordEx.getMessage());
                }
            }
            // 2. Restore StoredFile metadata record if snapshot exists and record was deleted
            if (event.getStoredFileSnapshot() != null && storedFileRepository != null) {
                try {
                    if (fileId != null && !storedFileRepository.existsById(fileId)) {
                        storedFileRepository.save(event.getStoredFileSnapshot());
                        log.info("Restored StoredFile metadata record for fileId={} after Bunny deletion failure", fileId);
                    }
                } catch (Exception restoreEx) {
                    log.error("Failed to restore StoredFile metadata for file {}: {}", fileId, restoreEx.getMessage());
                }
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onVideoPurge(StorageVideoPurgeEvent event) {
        if (event == null || event.getVideoId() == null || event.getVideoId().isBlank()) {
            return;
        }
        try {
            log.info("Immediate Bunny video physical deletion disabled by 1-year retention policy. Recording orphan tracking for: {}", event.getVideoId());
            if (bunnyStreamService != null) {
                bunnyStreamService.recordOrphan(event.getVideoId(), "COURSE_MODULE", "Event-tracked video", null);
            }
        } catch (Exception e) {
            log.error("Failed to record video orphan tracking after transaction commit for videoId={}: {}",
                    event.getVideoId(), e.getMessage(), e);
            if (systemSettingRepository != null) {
                try {
                    String key = "cleanup.failed.video." + event.getVideoId();
                    String val = "EVENT_ORPHAN_FAILED|" + e.getMessage() + "|" + java.time.OffsetDateTime.now();
                    systemSettingRepository.save(new com.zoroacademy.entity.SystemSetting(key, val));
                } catch (Exception recEx) {
                    log.error("Failed to record durable failure for video orphan tracking {}: {}", event.getVideoId(), recEx.getMessage());
                }
            }
        }
    }
}
