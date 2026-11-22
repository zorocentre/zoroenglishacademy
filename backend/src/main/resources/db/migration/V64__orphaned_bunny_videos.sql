-- V64__orphaned_bunny_videos.sql
-- Table for tracking orphaned Bunny Stream video assets for 1-year retention policy (8760 hours)

CREATE TABLE IF NOT EXISTS orphaned_bunny_videos (
    id VARCHAR(128) PRIMARY KEY,
    bunny_video_id VARCHAR(128) NOT NULL UNIQUE,
    category VARCHAR(50),
    title VARCHAR(500),
    source_entity_id VARCHAR(128),
    orphaned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orphaned_bunny_videos_orphaned_at ON orphaned_bunny_videos(orphaned_at);
CREATE INDEX IF NOT EXISTS idx_orphaned_bunny_videos_bunny_video_id ON orphaned_bunny_videos(bunny_video_id);
