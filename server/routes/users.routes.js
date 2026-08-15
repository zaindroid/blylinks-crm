const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const {
  listPublicUsers, toPublicUser, findUserRowByUsername, findUserRowById,
  getAllowedCampaignIds, shareCampaignAccess
} = require('../db/usersRepo');

const router = express.Router();

const DESIGNATIONS = {
  Admin: 'Administrator',
  Supervisor: 'Team Supervisor',
  Agent: 'Outbound Agent'
};

router.get('/', asyncHandler(async (req, res) => {
  const users = await listPublicUsers();
  res.json(users);
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'Admin' && req.user.role !== 'Supervisor') {
    return res.status(403).json({ error: 'Only Admins and Supervisors can add users' });
  }

  const { name, username, password } = req.body;
  let { role, campaignIds = [] } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }

  if (req.user.role === 'Supervisor') {
    role = 'Agent'; // Supervisors can only ever create Agents, regardless of what's sent
    const ownCampaignIds = await getAllowedCampaignIds(req.user.id);
    const outOfScope = campaignIds.filter(id => !ownCampaignIds.includes(id));
    if (outOfScope.length > 0) {
      return res.status(403).json({ error: 'You can only grant access to campaigns you yourself have access to' });
    }
  } else {
    role = ['Admin', 'Supervisor', 'Agent'].includes(role) ? role : 'Agent';
  }

  const existing = await findUserRowByUsername(username);
  if (existing) {
    return res.status(409).json({ error: 'This username is already taken' });
  }

  const id = `usr_${role.toLowerCase()}_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, name, username, password_hash, role, designation, status, avatar)
       VALUES ($1,$2,$3,$4,$5,$6,'Active',$7)`,
      [
        id, name, username, passwordHash, role, DESIGNATIONS[role],
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
      ]
    );
    for (const campaignId of campaignIds) {
      await client.query('INSERT INTO campaign_access (campaign_id, user_id) VALUES ($1,$2)', [campaignId, id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const row = await findUserRowById(id);
  res.status(201).json(await toPublicUser(row));
}));

router.patch('/:id/campaigns', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { campaignIds = [] } = req.body;

  const target = await findUserRowById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM campaign_access WHERE user_id = $1', [id]);
    for (const campaignId of campaignIds) {
      await client.query('INSERT INTO campaign_access (campaign_id, user_id) VALUES ($1,$2)', [campaignId, id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await toPublicUser(target));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove your own account' });
  }

  const target = await findUserRowById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (req.user.role === 'Admin') {
    // no further restriction
  } else if (req.user.role === 'Supervisor') {
    if (target.role !== 'Agent') {
      return res.status(403).json({ error: 'Supervisors can only remove Agent accounts' });
    }
    const inScope = await shareCampaignAccess(req.user.id, id);
    if (!inScope) {
      return res.status(403).json({ error: 'This agent is outside your campaign access' });
    }
  } else {
    return res.status(403).json({ error: 'You do not have permission to remove users' });
  }

  await pool.query(`UPDATE users SET status = 'Inactive' WHERE id = $1`, [id]);
  res.json({ status: 'deactivated', id });
}));

module.exports = router;
