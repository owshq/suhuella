-- Partner Checkout attempts and Stripe fulfillment claims.
-- Interest rows stay in partner_application. This ledger is payment-only.
-- Apply locally:
--   npx wrangler d1 migrations apply suhuella-license --local
-- Remote apply is a separate authorized step. Do not run it from this track.

CREATE TABLE IF NOT EXISTS partner_checkout_attempt (
  attempt_id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  price_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_checkout_open_email
  ON partner_checkout_attempt (normalized_email)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS partner_stripe_fulfillment (
  stripe_subscription_id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_checkout_session_id TEXT,
  partner_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
