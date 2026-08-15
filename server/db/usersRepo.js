const pool = require('./pool');

function reshapeUser(row, allowedCampaignIds) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    designation: row.designation,
    phone: row.phone,
    cnic: row.cnic,
    allowedCampaignIds,
    status: row.status,
    avatar: row.avatar,
    shift: row.shift
  };
}

async function getAllowedCampaignIds(userId) {
  const { rows } = await pool.query('SELECT campaign_id FROM campaign_access WHERE user_id = $1', [userId]);
  return rows.map(r => r.campaign_id);
}

// True if userA and userB share at least one campaign -- used to scope what a
// Supervisor is allowed to manage (their own campaign_access rows define reach).
async function shareCampaignAccess(userIdA, userIdB) {
  const { rows } = await pool.query(
    `SELECT 1 FROM campaign_access a
     JOIN campaign_access b ON a.campaign_id = b.campaign_id
     WHERE a.user_id = $1 AND b.user_id = $2 LIMIT 1`,
    [userIdA, userIdB]
  );
  return rows.length > 0;
}

async function findUserRowByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  return rows[0] || null;
}

async function findUserRowById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function toPublicUser(row) {
  const allowedCampaignIds = await getAllowedCampaignIds(row.id);
  return reshapeUser(row, allowedCampaignIds);
}

async function listPublicUsers() {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
  const { rows: links } = await pool.query('SELECT campaign_id, user_id FROM campaign_access');
  const byUser = {};
  for (const l of links) {
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    byUser[l.user_id].push(l.campaign_id);
  }
  return rows.map(row => reshapeUser(row, byUser[row.id] || []));
}

module.exports = {
  reshapeUser, getAllowedCampaignIds, shareCampaignAccess,
  findUserRowByUsername, findUserRowById, toPublicUser, listPublicUsers
};
