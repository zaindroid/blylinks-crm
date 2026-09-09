-- Admin/Supervisor-mediated password reset: when someone resets a user's
-- password (they've forgotten it, and this app has no email to send a
-- reset link to), the account is flagged so the temp password only works
-- long enough to be replaced -- not indefinitely.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
