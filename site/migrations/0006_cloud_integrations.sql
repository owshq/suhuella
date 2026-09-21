-- Cloud account connections (OAuth). Apply after 0005_stripe_event.sql.
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Does not alter license_*, stripe_event, or operations tables.
-- Tokens are stored only as ciphertext; never plaintext.

CREATE TABLE IF NOT EXISTS cloud_provider (
  provider TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  supports_webhooks INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  brand_allowlist_json TEXT NOT NULL DEFAULT '["suhuella"]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_oauth_pending (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  return_path TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_oauth_pending_expires
  ON cloud_oauth_pending (expires_at);

CREATE TABLE IF NOT EXISTS cloud_connection (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_external_id TEXT,
  account_email TEXT,
  account_display_name TEXT,
  status TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  token_expires_at TEXT,
  revoked_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (brand_id, owner_kind, owner_id, provider, account_external_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_connection_owner
  ON cloud_connection (brand_id, owner_kind, owner_id);

CREATE TABLE IF NOT EXISTS cloud_credential (
  connection_id TEXT PRIMARY KEY,
  encryption_version INTEGER NOT NULL,
  ciphertext BLOB NOT NULL,
  iv BLOB NOT NULL,
  key_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT,
  FOREIGN KEY (connection_id) REFERENCES cloud_connection(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cloud_webhook_subscription (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_subscription_id TEXT,
  topic TEXT,
  channel_token_hash TEXT,
  expires_at TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (connection_id) REFERENCES cloud_connection(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cloud_webhook_receipt (
  receipt_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  connection_id TEXT,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_sync_job (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  status TEXT NOT NULL,
  cursor_json TEXT,
  checkpoint_json TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  next_attempt_at TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  progress_files INTEGER NOT NULL DEFAULT 0,
  progress_bytes INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (connection_id) REFERENCES cloud_connection(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_job_status
  ON cloud_sync_job (status, next_attempt_at);
