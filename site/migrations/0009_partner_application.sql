-- Public partner program applications (interest capture — not entitlements).
-- Apply after 0008_partner_domain.sql:
--   npx wrangler d1 migrations apply suhuella-license --local
--   npx wrangler d1 migrations apply suhuella-license --remote

CREATE TABLE IF NOT EXISTS partner_application (
  application_id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  partner_id TEXT,
  approval_attempt_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_application_status
  ON partner_application (status);

CREATE INDEX IF NOT EXISTS idx_partner_application_partner
  ON partner_application (partner_id);
