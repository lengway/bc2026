ALTER TABLE profiles ADD COLUMN daily_goal integer NOT NULL DEFAULT 1 CHECK (daily_goal BETWEEN 1 AND 3);
ALTER TABLE certificates ADD COLUMN revoked_at timestamptz;
ALTER TABLE skill_certificates ADD COLUMN revoked_at timestamptz;
