CREATE TABLE IF NOT EXISTS competition_activity_logs (
    id VARCHAR(128) PRIMARY KEY,
    competition_id VARCHAR(128) NOT NULL,
    competition_title VARCHAR(255),
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(128),
    actor_name VARCHAR(255),
    actor_role VARCHAR(64),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comp_act_log_comp_id ON competition_activity_logs(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_act_log_event_type ON competition_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_comp_act_log_created_at ON competition_activity_logs(created_at);

-- Backfill final assessment start_at and end_at from competitions table where null
UPDATE competition_assessments a
SET start_at = c.final_unlock_at,
    end_at = c.end_at
FROM competitions c
WHERE a.competition_id = c.id
  AND a.type = 'FINAL'
  AND a.start_at IS NULL
  AND c.final_unlock_at IS NOT NULL;
