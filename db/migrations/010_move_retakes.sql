CREATE TABLE move_retakes (
  source_event_id uuid PRIMARY KEY REFERENCES move_reviews(event_id) ON DELETE CASCADE,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  answer text NOT NULL,
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb,
  completed_at timestamptz,
  FOREIGN KEY (case_id,user_id) REFERENCES cases(id,user_id) ON DELETE CASCADE,
  CHECK (
    (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND result IS NULL AND completed_at IS NULL)
    OR (lease_token IS NULL AND lease_expires_at IS NULL AND result IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX move_retakes_user_quota ON move_retakes(user_id,completed_at,lease_expires_at);
