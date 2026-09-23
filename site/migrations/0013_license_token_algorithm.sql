-- Track the signature algorithm clients present at check/activate time (Phase 2B HMAC retirement).
-- Apply: npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc

ALTER TABLE license_activation ADD COLUMN last_presented_token_algorithm TEXT;

CREATE INDEX IF NOT EXISTS idx_license_activation_token_algorithm
  ON license_activation (last_presented_token_algorithm, status);
