-- V58__trainer_working_hours_and_salary_management.sql
-- Schedule-based working hours credit and manual salary payments

-- 1. Schedules table: working hours credit columns
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS trainer_joined BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS credited_duration_minutes INT DEFAULT 0 NOT NULL;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS credited_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS salary_payment_id VARCHAR(128);

-- Foreign key from schedules.salary_payment_id to salary_records(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedules_salary_payment'
    ) THEN
        ALTER TABLE schedules
        ADD CONSTRAINT fk_schedules_salary_payment
        FOREIGN KEY (salary_payment_id) REFERENCES salary_records(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedules_salary_payment_id ON schedules(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_schedules_trainer_id_date ON schedules(trainer_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_trainer_joined ON schedules(trainer_joined);

-- 2. Salary records table: separate salary components, period, and audit
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS from_date VARCHAR(50);
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS to_date VARCHAR(50);
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS online_session_salary NUMERIC(12, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS recorded_session_salary NUMERIC(12, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_salary NUMERIC(12, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS session_count INT DEFAULT 0 NOT NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS credited_hours NUMERIC(8, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS created_by VARCHAR(128);

-- Backfill total_salary from amount for existing records
UPDATE salary_records
SET total_salary = amount
WHERE total_salary = 0.00 AND amount > 0.00;

CREATE INDEX IF NOT EXISTS idx_salary_records_payment_date ON salary_records(payment_date);

-- 3. Salary payment schedules junction table (prevents duplicate payment at DB constraint level)
CREATE TABLE IF NOT EXISTS salary_payment_schedules (
    id VARCHAR(128) PRIMARY KEY,
    salary_payment_id VARCHAR(128) NOT NULL,
    schedule_id VARCHAR(128) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sps_salary_payment FOREIGN KEY (salary_payment_id) REFERENCES salary_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_sps_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    CONSTRAINT uk_salary_payment_schedule UNIQUE (schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_sps_payment_id ON salary_payment_schedules(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_sps_schedule_id ON salary_payment_schedules(schedule_id);
