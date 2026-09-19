-- License persistence for SuHuella (activations, OTP challenges, checkout attempts).
-- Apply after: wrangler d1 create suhuella-license
-- Bind LICENSE_DB in wrangler.jsonc, then:
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc

CREATE TABLE IF NOT EXISTS license_activation (
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'This computer',
  platform TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  activated_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (license_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_license_activation_device
  ON license_activation (device_id);

CREATE TABLE IF NOT EXISTS email_verification_challenge (
  id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  device_id TEXT,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  send_count INTEGER NOT NULL DEFAULT 1,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_challenge_email_purpose
  ON email_verification_challenge (normalized_email, purpose);

CREATE TABLE IF NOT EXISTS verified_email_proof (
  id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  device_id TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activation_attempt (
  id TEXT PRIMARY KEY,
  checkout_session_id TEXT,
  device_id TEXT NOT NULL,
  plan TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activation_attempt_session
  ON activation_attempt (checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_activation_attempt_device
  ON activation_attempt (device_id);

CREATE TABLE IF NOT EXISTS rate_limit_event (
  bucket_key TEXT NOT NULL,
  event_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time
  ON rate_limit_event (bucket_key, event_at);
