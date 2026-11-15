ALTER TABLE cases DROP CONSTRAINT cases_type_check;
ALTER TABLE cases ADD CONSTRAINT cases_type_check CHECK (type IN ('onboarding', 'daily', 'weekly', 'prep'));
