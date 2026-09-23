-- Commercial generation foundation (local apply only until operator promotes).
-- Apply: npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
-- Does not alter existing license_grant rows or retroactively assign generations.

CREATE TABLE IF NOT EXISTS commercial_generation (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  required_capabilities TEXT NOT NULL,
  effective_from TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_generation_price (
  price_id TEXT PRIMARY KEY,
  commercial_generation_id TEXT NOT NULL,
  product TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_generation_binding (
  checkout_session_id TEXT PRIMARY KEY,
  commercial_generation_id TEXT,
  price_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  bound_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS license_acquisition (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  commercial_generation_id TEXT,
  checkout_session_id TEXT,
  stripe_event_id TEXT,
  edition TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_license_acquisition_license
  ON license_acquisition (license_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_license_acquisition_checkout_kind
  ON license_acquisition (checkout_session_id, kind)
  WHERE checkout_session_id IS NOT NULL;
