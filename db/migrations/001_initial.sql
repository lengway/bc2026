CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  display_name text, timezone text NOT NULL DEFAULT 'UTC', created_at timestamptz NOT NULL DEFAULT now(),
  is_guest boolean NOT NULL DEFAULT false
);
CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_created ON auth_tokens(user_id, created_at);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL CHECK(count >= 0));
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id), intake_text text NOT NULL DEFAULT '',
  field text NOT NULL CHECK(field IN ('sales','project_management','software')), subfield text NOT NULL,
  level text NOT NULL CHECK(level IN ('beginner','intermediate','advanced')), years integer CHECK(years >= 0),
  pains text[] NOT NULL DEFAULT '{}', goals text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscriptions (
  user_id uuid PRIMARY KEY REFERENCES users(id), status text NOT NULL DEFAULT 'free' CHECK(status IN ('free','pro')),
  stripe_customer_id text UNIQUE, stripe_subscription_id text UNIQUE, current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  field text NOT NULL CHECK(field IN ('sales','project_management','software')), subfield text NOT NULL,
  level text NOT NULL DEFAULT 'beginner' CHECK(level IN ('beginner','intermediate','advanced')), archetype_id text,
  type text NOT NULL CHECK(type IN ('onboarding','daily','weekly')),
  workspace text NOT NULL CHECK(workspace IN ('chat','board','ide')),
  status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','ready','in_progress','submitted','evaluated','failed')),
  brief jsonb, docs jsonb NOT NULL DEFAULT '[]', scoring_guide jsonb, time_limit_sec integer CHECK(time_limit_sec > 0),
  model text, prompt_version text, seed text, is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, submitted_at timestamptz,
  submitted_snapshot jsonb, last_event_seq integer NOT NULL DEFAULT 0 CHECK(last_event_seq >= 0),
  operation_token uuid, operation_kind text, operation_expires_at timestamptz,
  UNIQUE(id,user_id)
);
CREATE INDEX cases_user_created ON cases(user_id, created_at DESC);
CREATE TABLE personas (
  id text PRIMARY KEY, case_id uuid NOT NULL REFERENCES cases(id), public jsonb NOT NULL, hidden jsonb NOT NULL,
  UNIQUE(case_id,id)
);
CREATE TABLE persona_state (
  case_id uuid NOT NULL, persona_id text NOT NULL, turn integer NOT NULL DEFAULT 0 CHECK(turn >= 0),
  trust integer NOT NULL CHECK(trust BETWEEN 0 AND 100), patience integer NOT NULL CHECK(patience >= 0),
  mood text NOT NULL DEFAULT 'neutral', revealed text[] NOT NULL DEFAULT '{}',
  outcome text CHECK(outcome IN ('won','lost','left')), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(case_id,persona_id), FOREIGN KEY(case_id,persona_id) REFERENCES personas(case_id,id)
);
CREATE TABLE rubrics (
  case_id uuid PRIMARY KEY REFERENCES cases(id), version text NOT NULL,
  criteria jsonb NOT NULL, ai_use_checks jsonb NOT NULL, key_moments jsonb NOT NULL,
  traps jsonb NOT NULL, twists jsonb NOT NULL, success_criteria jsonb NOT NULL
);
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES cases(id), seq integer NOT NULL CHECK(seq > 0),
  actor text NOT NULL CHECK(actor IN ('user','persona','copilot','system')), persona_id text,
  type text NOT NULL CHECK(type IN ('message','copilot_prompt','copilot_reply','doc_open','twist','submit')),
  content text NOT NULL DEFAULT '', meta jsonb NOT NULL DEFAULT '{}', is_public boolean NOT NULL DEFAULT true,
  client_msg_id uuid UNIQUE, draft_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id,seq), FOREIGN KEY(case_id,persona_id) REFERENCES personas(case_id,id)
);
CREATE TABLE editor_drafts (
  id uuid PRIMARY KEY, case_id uuid NOT NULL, user_id uuid NOT NULL, message_event_id uuid UNIQUE REFERENCES events(id),
  created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
  observation_limitations text[] NOT NULL DEFAULT '{}',
  FOREIGN KEY(case_id,user_id) REFERENCES cases(id,user_id), UNIQUE(id,case_id,user_id)
);
ALTER TABLE events ADD CONSTRAINT events_draft_fk FOREIGN KEY(draft_id) REFERENCES editor_drafts(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE editor_events (
  id uuid PRIMARY KEY, case_id uuid NOT NULL, user_id uuid NOT NULL, draft_id uuid NOT NULL,
  seq integer NOT NULL CHECK(seq > 0), kind text NOT NULL, input_mode text NOT NULL, payload jsonb NOT NULL,
  client_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), UNIQUE(draft_id,seq),
  FOREIGN KEY(draft_id,case_id,user_id) REFERENCES editor_drafts(id,case_id,user_id)
);
CREATE TABLE interaction_windows (
  id uuid PRIMARY KEY, case_id uuid NOT NULL, user_id uuid NOT NULL, draft_id uuid NOT NULL,
  started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL, CHECK(ended_at >= started_at),
  FOREIGN KEY(draft_id,case_id,user_id) REFERENCES editor_drafts(id,case_id,user_id)
);
CREATE TABLE editor_batches (
  batch_id uuid PRIMARY KEY, draft_id uuid NOT NULL, case_id uuid NOT NULL, user_id uuid NOT NULL,
  payload_hash text NOT NULL, ack jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(draft_id,case_id,user_id) REFERENCES editor_drafts(id,case_id,user_id)
);
CREATE INDEX editor_batches_case_received ON editor_batches(case_id,received_at);
CREATE TABLE move_reviews (
  event_id uuid PRIMARY KEY REFERENCES events(id), case_id uuid NOT NULL REFERENCES cases(id),
  label text NOT NULL CHECK(label IN ('brilliant','best','good','inaccuracy','mistake','blunder')),
  why text NOT NULL, better_move text, inner_thought text NOT NULL DEFAULT '', rubric_ref text,
  trust_after integer NOT NULL CHECK(trust_after BETWEEN 0 AND 100), points integer CHECK(points BETWEEN 0 AND 100),
  evidence jsonb NOT NULL DEFAULT '[]', assessment_status text NOT NULL CHECK(assessment_status IN ('assessed','insufficient_evidence'))
);
CREATE TABLE evaluations (
  case_id uuid PRIMARY KEY REFERENCES cases(id), accuracy integer CHECK(accuracy BETWEEN 0 AND 100),
  label_counts jsonb NOT NULL, ai_dependency integer CHECK(ai_dependency BETWEEN 0 AND 100), trap_caught boolean NOT NULL,
  outcome text NOT NULL CHECK(outcome IN ('won','lost','left','incomplete')), top_move_ids uuid[] NOT NULL DEFAULT '{}',
  summary text NOT NULL, skills jsonb NOT NULL, assistance jsonb NOT NULL, ai_use_skill jsonb NOT NULL,
  trap_result text NOT NULL CHECK(trap_result IN ('caught','missed','not_presented','insufficient_evidence')),
  score_audit jsonb NOT NULL, process_observations jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL UNIQUE REFERENCES cases(id),
  user_id uuid NOT NULL REFERENCES users(id), slug text NOT NULL UNIQUE, skill text NOT NULL, issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE skill_progress (
  user_id uuid NOT NULL REFERENCES users(id), skill text NOT NULL, level integer NOT NULL DEFAULT 1 CHECK(level > 0),
  xp integer NOT NULL DEFAULT 0 CHECK(xp >= 0), PRIMARY KEY(user_id,skill)
);
CREATE TABLE progress_awards (
  case_id uuid NOT NULL REFERENCES cases(id), user_id uuid NOT NULL REFERENCES users(id), skill text NOT NULL,
  xp integer NOT NULL CHECK(xp >= 0), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,skill)
);
CREATE TABLE streaks (
  user_id uuid PRIMARY KEY REFERENCES users(id), current integer NOT NULL DEFAULT 0 CHECK(current >= 0),
  best integer NOT NULL DEFAULT 0 CHECK(best >= current), last_practice_date date
);
CREATE TABLE llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid REFERENCES cases(id), prompt_id text NOT NULL,
  model text NOT NULL, prompt_version text NOT NULL, input jsonb NOT NULL, output jsonb, ok boolean NOT NULL,
  latency_ms integer NOT NULL CHECK(latency_ms >= 0), tokens_in integer CHECK(tokens_in >= 0),
  tokens_out integer CHECK(tokens_out >= 0), error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_calls_case_created ON llm_calls(case_id,created_at);
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('case.generate','case.evaluate')),
  case_id uuid NOT NULL REFERENCES cases(id), dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz, locked_by text, lease_token uuid,
  last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_claim ON jobs(status,available_at,locked_until);
CREATE TABLE billing_webhook_events (
  id text PRIMARY KEY, type text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now()
);
