-- A message may carry one shared file alongside (or instead of) its text, stored inline as bytea.
-- No object storage is set up on this VPS and the app container has no persistent volume -- anything
-- written to local disk is wiped on every redeploy -- so Postgres (already durable, already backed up
-- the same way as every other table) is where it lives. file_data is kept out of the normal message
-- list query and only read when the file is actually downloaded, so listing a channel's history never
-- pulls attachment bytes over the wire.
ALTER TABLE messages
  ADD COLUMN file_name TEXT,
  ADD COLUMN file_type TEXT,
  ADD COLUMN file_size INTEGER,
  ADD COLUMN file_data BYTEA;

ALTER TABLE messages ALTER COLUMN text DROP NOT NULL;
