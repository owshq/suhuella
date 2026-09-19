-- OPERATIONS persistence for suhuella.com/admin.
-- Apply after: wrangler d1 create suhuella-operations
-- Then bind OPERATIONS_DB in wrangler.jsonc and run:
--   npx wrangler d1 migrations apply suhuella-operations --config wrangler.jsonc

CREATE TABLE IF NOT EXISTS operations_document (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);
