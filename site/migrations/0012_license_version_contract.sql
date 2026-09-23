-- LICENSE-VERSION-CONTRACT-CLOSURE-005 (local apply only)
-- Apply: npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc

ALTER TABLE checkout_generation_binding ADD COLUMN version_model_active_at_bind INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS license_version_model_state (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  activated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_reconciliation_pending (
  id TEXT PRIMARY KEY,
  checkout_session_id TEXT NOT NULL UNIQUE,
  normalized_email TEXT NOT NULL,
  price_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  reason TEXT NOT NULL,
  stripe_event_id TEXT,
  recorded_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_checkout_reconciliation_pending_status
  ON checkout_reconciliation_pending (status);
