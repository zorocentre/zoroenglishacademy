package com.zoroacademy.event;

import com.zoroacademy.entity.StoredFile;

public class StorageFilePurgeEvent {
    private final String fileId;
    private final String storagePath;
    private final StoredFile storedFileSnapshot;

    public StorageFilePurgeEvent(String storagePath) {
        this(null, storagePath, null);
    }

    public StorageFilePurgeEvent(String fileId, String storagePath) {
        this(fileId, storagePath, null);
    }

    public StorageFilePurgeEvent(String fileId, String storagePath, StoredFile storedFileSnapshot) {
        this.fileId = fileId;
        this.storagePath = storagePath;
        this.storedFileSnapshot = storedFileSnapshot;
    }

    public String getFileId() {
        return fileId;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public StoredFile getStoredFileSnapshot() {
        return storedFileSnapshot;
    }
}
