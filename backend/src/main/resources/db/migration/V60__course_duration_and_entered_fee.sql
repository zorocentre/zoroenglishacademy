-- V60__course_duration_and_entered_fee.sql
-- Store both entered fee and calculated total course fee, with duration value and unit.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS entered_fee numeric(12,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_value integer;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_unit varchar(20);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_total_fee numeric(12,2);

-- Populate course_total_fee on existing enrollments from student_fees or course price
UPDATE enrollments e
SET course_total_fee = COALESCE(
    (SELECT sf.total_fee FROM student_fees sf WHERE sf.student_id = e.student_id AND sf.course_id = e.course_id LIMIT 1),
    (SELECT c.price FROM courses c WHERE c.id = e.course_id),
    0
)
WHERE e.course_total_fee IS NULL;

-- Conservative default backfill for courses:
-- 1. Default entered_fee to current price
UPDATE courses SET entered_fee = price WHERE entered_fee IS NULL;

-- 2. Populate duration_value and duration_unit by parsing duration column
UPDATE courses 
SET duration_value = CASE
    WHEN duration ~ '^[0-9]+' THEN substring(duration from '^[0-9]+')::integer
    ELSE 1
END,
duration_unit = CASE
    WHEN duration ILIKE '%year%' THEN 'Years'
    WHEN duration ILIKE '%month%' THEN 'Months'
    WHEN duration ILIKE '%day%' THEN 'Days'
    WHEN duration ILIKE '%hour%' THEN 'Hours'
    ELSE 'Months'
END
WHERE duration_value IS NULL OR duration_unit IS NULL;

-- 3. Derive entered_fee for clean divisions without changing existing total price
UPDATE courses
SET entered_fee = round(price / duration_value, 2)
WHERE duration_unit = 'Months'
  AND duration_value > 0
  AND mod((price * 100)::bigint, duration_value::bigint) = 0
  AND (price / duration_value) < price;
