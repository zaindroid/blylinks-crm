const pool = require('./pool');

function reshapeUser(row, allowedCampaignIds) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
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

async function getAllowedCampaignIds(agentId) {
  const { rows } = await pool.query('SELECT campaign_id FROM campaign_agents WHERE agent_id = $1', [agentId]);
  return rows.map(r => r.campaign_id);
}

async function findUserRowByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
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
  const { rows: links } = await pool.query('SELECT campaign_id, agent_id FROM campaign_agents');
  const byAgent = {};
  for (const l of links) {
    if (!byAgent[l.agent_id]) byAgent[l.agent_id] = [];
    byAgent[l.agent_id].push(l.campaign_id);
  }
  return rows.map(row => reshapeUser(row, byAgent[row.id] || []));
}

module.exports = { reshapeUser, getAllowedCampaignIds, findUserRowByEmail, findUserRowById, toPublicUser, listPublicUsers };
