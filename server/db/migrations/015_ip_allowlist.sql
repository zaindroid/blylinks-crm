-- Which network addresses may open the portal. Enforcement is OFF by default (a fresh deploy must never
-- lock anyone out) and is switched on by an Admin from the Access Control screen.
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE ip_allowlist (
  id         TEXT PRIMARY KEY,
  cidr       TEXT NOT NULL UNIQUE,   -- a single address ("203.0.113.5") or a range ("203.0.113.0/24"), IPv4 or IPv6
  label      TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
