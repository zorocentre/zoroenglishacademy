-- =============================================================================
-- SAFE DATA REPAIR & AUDIT SCRIPT FOR COURSE MODULES
-- Purpose: Inspect and safely repair course modules whose videoStorageRef
--          or attachments may have been cleared or corrupted by prior edits.
-- =============================================================================

-- Step 1: Audit query - Identify modules with missing videoStorageRef
-- where title/description indicates recorded video content
SELECT id, course_id, title, module_order, video_storage_ref, notes_file_url, worksheet_file_url, assignment_file_url, updated_at
FROM course_modules
WHERE (video_storage_ref IS NULL OR TRIM(video_storage_ref) = '')
ORDER BY course_id, module_order;

-- Step 2: Audit query - Check audit log / history if present
-- SELECT * FROM audit_logs WHERE entity_name = 'CourseModule' ORDER BY timestamp DESC LIMIT 50;

-- Step 3: Targeted repair template (Replace '<module-id>' and '<bunny-video-id>' with actual values verified from Bunny Stream dashboard)
-- Example:
-- UPDATE course_modules
-- SET video_storage_ref = '<bunny-video-id>',
--     updated_at = NOW()
-- WHERE id = '<module-id>' AND (video_storage_ref IS NULL OR TRIM(video_storage_ref) = '');
