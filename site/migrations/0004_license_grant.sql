-- Durable paid / gifted / manual / business grants.
-- Apply after 0002_license.sql.
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Does not alter activation, OTP, proof, attempt, or rate-limit tables.

CREATE TABLE IF NOT EXISTS license_grant (
  license_id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  edition TEXT NOT NULL,
  status TEXT NOT NULL,
  origin TEXT NOT NULL,
  valid_until TEXT,
  device_limit INTEGER,
  organisation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_license_grant_email
  ON license_grant (normalized_email);

CREATE INDEX IF NOT EXISTS idx_license_grant_stripe_customer
  ON license_grant (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_license_grant_stripe_subscription
  ON license_grant (stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_license_grant_status
  ON license_grant (status);
