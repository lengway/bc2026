ALTER TABLE subscriptions ADD COLUMN last_event_created bigint NOT NULL DEFAULT -1;

CREATE TABLE billing_checkout_sessions (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  price_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_subscription_bindings (
  subscription_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  customer_id text NOT NULL,
  checkout_session_id text NOT NULL REFERENCES billing_checkout_sessions(session_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_webhook_events ADD COLUMN event_created bigint NOT NULL DEFAULT 0;
