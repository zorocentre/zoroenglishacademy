-- V63: Storage Protection and Orphan Prevention Query Performance Indexes
-- Adds non-blocking indexes to optimize reference resolution during cleanup, migration, and safeguard checks.

CREATE INDEX IF NOT EXISTS idx_stored_files_storage_path ON stored_files(storage_path);
CREATE INDEX IF NOT EXISTS idx_stored_files_created_at ON stored_files(created_at);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_media_ref ON assessment_questions(media_ref) WHERE media_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_answers_audio_file_id ON attempt_answers(audio_file_id) WHERE audio_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_answers_voice_file_id ON attempt_answers(voice_file_id) WHERE voice_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_study_materials_stored_file_id ON competition_study_materials(stored_file_id) WHERE stored_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_syllabus_stored_file_id ON competition_syllabus(stored_file_id) WHERE stored_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_guidance_videos_bunny_video_id ON competition_guidance_videos(bunny_video_id) WHERE bunny_video_id IS NOT NULL;
