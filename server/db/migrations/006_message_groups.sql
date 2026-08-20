CREATE TABLE message_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_group_members (
  group_id TEXT NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_message_group_members_user ON message_group_members(user_id);

-- Carry the 3 previously-hardcoded broadcast channels forward as real, admin-manageable
-- groups so existing message history stays attached to a valid group. Every currently
-- active user is grandfathered in as a member; new users must be added deliberately.
INSERT INTO message_groups (id, name, created_by) VALUES
  ('announcements', 'Announcements', NULL),
  ('general-lounge', 'Sales Lounge', NULL),
  ('qa-support', 'Administrative Review', NULL);

INSERT INTO message_group_members (group_id, user_id)
SELECT g.id, u.id FROM message_groups g CROSS JOIN users u WHERE u.status = 'Active';
