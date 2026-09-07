// Matches the ids seeded by migrations/006_message_groups.sql. Every new
// account -- the bootstrap admin and every user created via POST /api/users --
// joins these automatically, otherwise nobody can send or receive a single
// group message until an Admin remembers to add them by hand on the Message
// Groups screen. (The migration's own "grandfather in existing users" step
// only ever helps accounts that existed at the moment it ran -- everyone
// created afterward, which in practice is almost everyone, got nothing.)
const DEFAULT_GROUP_IDS = ['announcements', 'general-lounge', 'qa-support'];

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

module.exports = { DEFAULT_GROUP_IDS, joinDefaultGroups };
