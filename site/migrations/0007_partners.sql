-- Multi-tenant partners (Phase 1).
-- Apply after 0006_cloud_integrations.sql:
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Customer payment accounts for partners are deferred (not created here).

CREATE TABLE IF NOT EXISTS partner (
  partner_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS partner_member (
  member_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE (partner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_partner_member_partner
  ON partner_member (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_member_email
  ON partner_member (email);

CREATE TABLE IF NOT EXISTS partner_brand (
  brand_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  accent TEXT,
  on_accent TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  canonical_domain TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_domain (
  domain_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  verification_token_hash TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_domain_partner
  ON partner_domain (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_domain_brand
  ON partner_domain (brand_id);

CREATE TABLE IF NOT EXISTS partner_entitlement (
  entitlement_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  origin TEXT NOT NULL,
  valid_until TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  revoked_at TEXT,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_entitlement_partner
  ON partner_entitlement (partner_id);

CREATE TABLE IF NOT EXISTS partner_onboarding_invite (
  invite_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_invite_partner
  ON partner_onboarding_invite (partner_id);
