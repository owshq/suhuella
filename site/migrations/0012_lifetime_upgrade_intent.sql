-- Lifetime Upgrade checkout intents (local apply only until operator promotes).
-- Apply: npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
-- Does not open Upgrade sales or change commercial flags.

CREATE TABLE IF NOT EXISTS lifetime_upgrade_intent (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  source_generation_id TEXT NOT NULL,
  target_generation_id TEXT NOT NULL,
  checkout_session_id TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  incident_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lifetime_upgrade_intent_license
  ON lifetime_upgrade_intent (license_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifetime_upgrade_intent_idempotency_active
  ON lifetime_upgrade_intent (idempotency_key)
  WHERE status IN ('pending', 'checkout_created', 'paid_pending_fulfillment');

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifetime_upgrade_intent_session
  ON lifetime_upgrade_intent (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;
