CREATE TABLE practice_completions (
  case_id uuid PRIMARY KEY REFERENCES cases(id),
  user_id uuid NOT NULL REFERENCES users(id),
  practice_date date NOT NULL,
  counts_as_practice boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_completions_user_date ON practice_completions(user_id,practice_date);
