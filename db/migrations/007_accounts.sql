ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
-- A successful historical magic-link session proves control of that mailbox.
UPDATE users u SET email_verified_at=(SELECT min(s.created_at) FROM sessions s WHERE s.user_id=u.id)
WHERE u.is_guest=false AND EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id);
CREATE UNIQUE INDEX users_email_lower ON users(lower(email));

ALTER TABLE auth_tokens ADD COLUMN purpose text NOT NULL DEFAULT 'magic_link'
  CHECK(purpose IN ('magic_link','verify_email','reset_password','change_email'));
ALTER TABLE auth_tokens ADD COLUMN meta jsonb NOT NULL DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN authenticated_at timestamptz;
UPDATE sessions SET authenticated_at=created_at;
ALTER TABLE sessions ALTER COLUMN authenticated_at SET DEFAULT now();
ALTER TABLE sessions ALTER COLUMN authenticated_at SET NOT NULL;

ALTER TABLE llm_calls ADD COLUMN user_id uuid REFERENCES users(id);
UPDATE llm_calls l SET user_id=k.user_id FROM cases k WHERE k.id=l.case_id;
-- Legacy intake logs have no reliable owner. Remove personal payloads, retain cost/latency metadata.
UPDATE llm_calls SET input='{"redacted":"legacy intake without ownership"}',output=NULL
WHERE case_id IS NULL AND prompt_id='intake.parse';
CREATE INDEX llm_calls_user ON llm_calls(user_id);
