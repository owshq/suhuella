-- Receipts for handled Stripe events. Apply after 0004_license_grant.sql.
--   npx wrangler d1 migrations apply suhuella-license --config wrangler.jsonc
-- Does not alter license_grant. A missing table must not be treated as a paid grant.

CREATE TABLE IF NOT EXISTS stripe_event (
  event_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);
