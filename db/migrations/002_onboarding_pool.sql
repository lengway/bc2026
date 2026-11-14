CREATE TABLE onboarding_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field text NOT NULL CHECK(field IN ('sales','project_management','software')),
  subfield text NOT NULL,
  level text NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  archetype_id text NOT NULL,
  workspace text NOT NULL CHECK(workspace IN ('chat','board','ide')),
  seed text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  generated_case jsonb NOT NULL,
  rubric jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(field,subfield,level)
);
ALTER TABLE cases ADD COLUMN onboarding_pool_id uuid REFERENCES onboarding_pool(id);
CREATE UNIQUE INDEX cases_user_onboarding_pool ON cases(user_id,onboarding_pool_id) WHERE onboarding_pool_id IS NOT NULL;
