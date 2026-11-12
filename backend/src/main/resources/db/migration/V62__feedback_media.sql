-- V62__feedback_media.sql
-- Table for admin-managed public feedback gallery media (images & videos)

CREATE TABLE IF NOT EXISTS feedback_media (
    id VARCHAR(128) PRIMARY KEY,
    media_type VARCHAR(20) NOT NULL,
    stored_file_id VARCHAR(128),
    bunny_video_id VARCHAR(128),
    url TEXT,
    thumbnail_url TEXT,
    original_file_name VARCHAR(255),
    content_type VARCHAR(100),
    size_bytes BIGINT,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'READY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_feedback_media_sort_status ON feedback_media(status, sort_order, created_at);
