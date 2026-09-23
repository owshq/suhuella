-- Cloudflare for SaaS Custom Hostnames (multi-partner).
-- Apply after 0007_partners.sql:
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Additive only. Does not drop existing partner_domain rows.

ALTER TABLE partner_domain ADD COLUMN normalized_hostname TEXT;
ALTER TABLE partner_domain ADD COLUMN cloudflare_custom_hostname_id TEXT;
ALTER TABLE partner_domain ADD COLUMN dns_target TEXT;
ALTER TABLE partner_domain ADD COLUMN validation_errors TEXT;

-- Backfill normalized_hostname from hostname when missing.
UPDATE partner_domain
SET normalized_hostname = lower(hostname)
WHERE normalized_hostname IS NULL OR normalized_hostname = '';

-- Map legacy verification status to SaaS "active".
UPDATE partner_domain
SET status = 'active'
WHERE status = 'verified';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_domain_normalized
  ON partner_domain (normalized_hostname);

CREATE INDEX IF NOT EXISTS idx_partner_domain_cf_id
  ON partner_domain (cloudflare_custom_hostname_id);

CREATE INDEX IF NOT EXISTS idx_partner_domain_partner_status
  ON partner_domain (partner_id, status);
