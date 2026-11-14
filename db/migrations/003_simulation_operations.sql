CREATE TABLE simulation_operations (
  client_msg_id uuid PRIMARY KEY,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('move','copilot')),
  request jsonb NOT NULL,
  input_event_id uuid NOT NULL UNIQUE REFERENCES events(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','cancelled')),
  lease_token uuid,
  lease_expires_at timestamptz,
  checkpoint jsonb NOT NULL DEFAULT '{"twists":[]}',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(case_id,user_id) REFERENCES cases(id,user_id),
  CHECK((status='running') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK((status='completed') = (response IS NOT NULL))
);
CREATE UNIQUE INDEX simulation_one_unfinished_operation ON simulation_operations(case_id)
  WHERE status IN ('pending','running');
