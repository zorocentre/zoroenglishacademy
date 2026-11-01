-- Migration V57: Make competitions.status nullable (derived from timestamps) and add module column to activity_logs
ALTER TABLE competitions ALTER COLUMN status DROP NOT NULL;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS module VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
