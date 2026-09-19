-- Single-row operational state. Must not live only in Worker process memory.
-- Apply after 0002_license.sql on suhuella-license (LICENSE_DB).

CREATE TABLE IF NOT EXISTS service_health (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  service_state TEXT NOT NULL DEFAULT 'NORMAL',
  affected_capabilities TEXT NOT NULL DEFAULT '[]',
  retry_after INTEGER,
  updated_at TEXT,
  updated_by TEXT
);

INSERT OR IGNORE INTO service_health (id, service_state, affected_capabilities)
VALUES (1, 'NORMAL', '[]');
