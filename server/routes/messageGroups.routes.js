const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { shareCampaignAccess } = require('../db/usersRepo');

const router = express.Router();

async function reshapeGroup(row) {
  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.role FROM message_group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = $1 ORDER BY u.name ASC`,
    [row.id]
  );
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    memberIds: members.map(m => m.id),
    members
  };
}

// A Supervisor may only ever include themselves or Agents that share campaign access with them --
// mirrors the scoping already used for Team Management.
async function assertMembersInScope(req, memberIds) {
  if (req.user.role !== 'Supervisor') return memberIds;
  const checks = await Promise.all(memberIds.map(async uid => {
    if (uid === req.user.id) return true;
    return shareCampaignAccess(req.user.id, uid);
  }));
  const outOfScope = memberIds.filter((_, i) => !checks[i]);
  if (outOfScope.length > 0) {
    const err = new Error('You can only add agents within your own campaign scope');
    err.status = 403;
    throw err;
  }
  return Array.from(new Set([...memberIds, req.user.id]));
}

router.get('/', asyncHandler(async (req, res) => {
  const wantAll = req.query.all === 'true' && req.user.role === 'Admin';
  const { rows } = wantAll
    ? await pool.query('SELECT * FROM message_groups ORDER BY created_at ASC')
    : await pool.query(
        `SELECT g.* FROM message_groups g
         JOIN message_group_members m ON m.group_id = g.id
         WHERE m.user_id = $1 ORDER BY g.created_at ASC`,
        [req.user.id]
      );
  res.json(await Promise.all(rows.map(reshapeGroup)));
}));

router.post('/', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id, name } = req.body;
  let { memberIds = [] } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }

  try {
    memberIds = await assertMembersInScope(req, memberIds);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO message_groups (id, name, created_by) VALUES ($1,$2,$3)', [id, name, req.user.id]);
    for (const uid of memberIds) {
      await client.query('INSERT INTO message_group_members (group_id, user_id) VALUES ($1,$2)', [id, uid]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query('SELECT * FROM message_groups WHERE id = $1', [id]);
  res.status(201).json(await reshapeGroup(rows[0]));
}));

router.patch('/:id/members', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { memberIds = [] } = req.body;

  const { rows: groupRows } = await pool.query('SELECT * FROM message_groups WHERE id = $1', [id]);
  if (!groupRows[0]) return res.status(404).json({ error: 'Group not found' });

  if (req.user.role === 'Supervisor') {
    const isMember = await pool.query(
      'SELECT 1 FROM message_group_members WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!isMember.rows[0]) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
  }

  try {
    memberIds = await assertMembersInScope(req, memberIds);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM message_group_members WHERE group_id = $1', [id]);
    for (const uid of memberIds) {
      await client.query('INSERT INTO message_group_members (group_id, user_id) VALUES ($1,$2)', [id, uid]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query('SELECT * FROM message_groups WHERE id = $1', [id]);
  res.json(await reshapeGroup(rows[0]));
}));

router.delete('/:id', requireRole('Admin'), asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM message_groups WHERE id = $1', [req.params.id]);
  res.json({ status: 'deleted', id: req.params.id });
}));

module.exports = router;
