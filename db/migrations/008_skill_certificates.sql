CREATE TABLE skill_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (skill IN ('discovery','objection_handling','value_articulation','critical_ai_use','closing')),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 3),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]{10}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  average_accuracy double precision NOT NULL CHECK (average_accuracy BETWEEN 70 AND 100),
  is_demo boolean NOT NULL DEFAULT false,
  is_seeded_demo boolean NOT NULL DEFAULT false,
  superseded_by uuid REFERENCES skill_certificates(id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (user_id, skill, level),
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX skill_certificates_current ON skill_certificates(user_id,skill) WHERE superseded_by IS NULL;

CREATE TABLE skill_certificate_cases (
  certificate_id uuid NOT NULL,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  PRIMARY KEY (certificate_id,position),
  UNIQUE (certificate_id,case_id),
  FOREIGN KEY (certificate_id,user_id) REFERENCES skill_certificates(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (case_id,user_id) REFERENCES cases(id,user_id) ON DELETE CASCADE
);
CREATE INDEX skill_certificate_cases_case ON skill_certificate_cases(case_id);
