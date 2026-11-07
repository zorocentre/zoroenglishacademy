-- V59: Ensure indexes for competition registration student identity and safe duplicate lookups
CREATE INDEX IF NOT EXISTS idx_comp_reg_student_id ON competition_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_student_email ON competition_registrations(LOWER(student_email));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
