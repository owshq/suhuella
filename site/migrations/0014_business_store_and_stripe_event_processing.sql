-- Business organisation state + durable Stripe webhook processing leases.
-- Apply after 0013_license_token_algorithm.sql.
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Does not alter license_grant or partner tables.

CREATE TABLE IF NOT EXISTS stripe_event_handler (
  event_id TEXT PRIMARY KEY,
  handler TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'retryable')),
  lease_expires_at TEXT,
  last_error TEXT,
  processed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_event_handler_status
  ON stripe_event_handler (status, lease_expires_at);

CREATE TABLE IF NOT EXISTS business_account (
  organisation_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_customer_id TEXT NOT NULL DEFAULT '',
  owner_email TEXT,
  plan TEXT NOT NULL DEFAULT 'business',
  seat_limit INTEGER NOT NULL DEFAULT 0,
  seat_price_cents INTEGER NOT NULL DEFAULT 200,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'active',
  trial_ends_at TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_status TEXT,
  current_period_end TEXT,
  recurring_amount_cents INTEGER,
  billing_interval TEXT,
  billing_needs_reconciliation INTEGER NOT NULL DEFAULT 0,
  last_stripe_event_id TEXT,
  last_stripe_event_created INTEGER,
  stripe_checkout_session_id TEXT,
  device_limit_per_seat INTEGER,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_account_stripe_subscription
  ON business_account (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_account_checkout_session
  ON business_account (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL AND stripe_checkout_session_id != '';

CREATE INDEX IF NOT EXISTS idx_business_account_owner_email
  ON business_account (owner_email);

CREATE INDEX IF NOT EXISTS idx_business_account_billing_customer
  ON business_account (billing_customer_id)
  WHERE billing_customer_id IS NOT NULL AND billing_customer_id != '';

CREATE TABLE IF NOT EXISTS business_seat (
  seat_id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  license_id TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  activated_at TEXT,
  last_seen_at TEXT,
  payload TEXT NOT NULL,
  FOREIGN KEY (organisation_id) REFERENCES business_account(organisation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_seat_org_email
  ON business_seat (organisation_id, normalized_email);

CREATE INDEX IF NOT EXISTS idx_business_seat_org
  ON business_seat (organisation_id);

CREATE TABLE IF NOT EXISTS business_seat_change (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_seat_change_org
  ON business_seat_change (organisation_id);

CREATE TABLE IF NOT EXISTS business_branding (
  organisation_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
