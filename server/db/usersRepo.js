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
    shift: row.shift,
    baseSalaryPkr: row.base_salary_pkr !== undefined ? Number(row.base_salary_pkr) : 0,
    mustChangePassword: row.must_change_password === true
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

// Minimal, fast lookup for the auth middleware -- runs on every authenticated
// request, so it only selects what that check actually needs rather than the
// full row (password hash included) that findUserRowById returns.
async function findAuthInfoById(id) {
  const { rows } = await pool.query('SELECT id, role, status, must_change_password FROM users WHERE id = $1', [id]);
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

// cnic, phone and baseSalaryPkr are personal/compensation data -- fine for
// Admin to see about anyone, and for a Supervisor to see about the Agents in
// their own campaign scope (they set salaries and manage those accounts),
// but nobody's business to see about a coworker otherwise. This runs after
// listPublicUsers()/toPublicUser() to redact those three fields per-viewer;
// everything else (name, role, avatar, status, allowedCampaignIds, ...) stays
// visible to any authenticated teammate, since the app's directory, DM
// contact list and message-group membership pickers all depend on that.
function sanitizeUsersForViewer(users, viewer) {
  if (viewer.role === 'Admin') return users;

  const viewerCampaignIds = new Set(
    (users.find(u => u.id === viewer.id)?.allowedCampaignIds) || []
  );

  return users.map(u => {
    if (u.id === viewer.id) return u;
    const sharesScope = viewer.role === 'Supervisor' &&
      u.role === 'Agent' &&
      u.allowedCampaignIds.some(id => viewerCampaignIds.has(id));
    if (sharesScope) return u;
    return { ...u, cnic: null, phone: null, baseSalaryPkr: 0 };
  });
}

module.exports = {
  reshapeUser, getAllowedCampaignIds, shareCampaignAccess,
  findUserRowByUsername, findUserRowById, findAuthInfoById, toPublicUser, listPublicUsers,
  sanitizeUsersForViewer
};
