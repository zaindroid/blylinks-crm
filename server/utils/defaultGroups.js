// The ids and names here match what migrations/006_message_groups.sql seeds.
// Every new account -- the bootstrap admin and every user created via
// POST /api/users -- joins these automatically, otherwise nobody can send or
// receive a single group message until an Admin remembers to add them by hand
// on the Message Groups screen. (The migration's own "grandfather in existing
// users" step only ever helps accounts that existed at the moment it ran --
// everyone created afterward, which in practice is almost everyone, got nothing.)
const DEFAULT_GROUPS = [
  { id: 'announcements', name: 'Announcements' },
  { id: 'general-lounge', name: 'Sales Lounge' },
  { id: 'qa-support', name: 'QA Review' }
];
const DEFAULT_GROUP_IDS = DEFAULT_GROUPS.map(g => g.id);

async function joinDefaultGroups(client, userId) {
  for (const groupId of DEFAULT_GROUP_IDS) {
    await client.query(
      `INSERT INTO message_group_members (group_id, user_id)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM message_groups WHERE id = $1)
       ON CONFLICT DO NOTHING`,
      [groupId, userId]
    );
  }
}

// The default groups are only ever created by migration 006, which runs once.
// Anything that removes them afterward -- notably a `TRUNCATE ... users CASCADE`
// (message_groups.created_by references users, so CASCADE takes the groups
// with it) -- leaves joinDefaultGroups above with nothing to join, and group
// messaging silently dies while direct messages keep working. Re-create any
// missing default group on every startup so that state can't persist.
//
// Only a group that was actually missing gets its membership backfilled (with
// all Active users). A group that still exists is left completely alone, so an
// Admin who deliberately removed someone from it isn't overruled on redeploy.
async function ensureDefaultGroups(db) {
  const recreated = [];
  for (const { id, name } of DEFAULT_GROUPS) {
    const { rows } = await db.query(
      `INSERT INTO message_groups (id, name, created_by) VALUES ($1, $2, NULL)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, name]
    );
    if (rows.length === 0) continue;
    await db.query(
      `INSERT INTO message_group_members (group_id, user_id)
       SELECT $1, u.id FROM users u WHERE u.status = 'Active'
       ON CONFLICT DO NOTHING`,
      [id]
    );
    recreated.push(id);
  }
  return recreated;
}

module.exports = { DEFAULT_GROUPS, DEFAULT_GROUP_IDS, joinDefaultGroups, ensureDefaultGroups };
