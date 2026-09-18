-- Knowledge-base documents can now be added and edited by Admins/Supervisors, so record who and when.
ALTER TABLE kb_articles
  ADD COLUMN created_by TEXT REFERENCES users(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
