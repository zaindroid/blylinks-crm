const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { getAllowedCampaignIds } = require('../db/usersRepo');

const router = express.Router();

const SELECT_CALLBACK = `
  SELECT cb.*, c.name AS project_name
  FROM callbacks cb
  JOIN campaigns c ON c.id = cb.campaign_id
`;

function reshape(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    campaignId: row.campaign_id,
    projectName: row.project_name,
    agentId: row.agent_id,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    notes: row.notes
  };
}

router.get('/', asyncHandler(async (req, res) => {
  // A callback carries customer PII (name, phone) -- an Agent only sees the
  // ones assigned to them, not every colleague's. Supervisor is scoped to
  // their own campaigns; Admin sees everything.
  const conditions = [];
  const params = [];
  if (req.user.role === 'Agent') {
    params.push(req.user.id);
    conditions.push(`cb.agent_id = $${params.length}`);
  } else if (req.user.role === 'Supervisor') {
    const allowedCampaignIds = await getAllowedCampaignIds(req.user.id);
    params.push(allowedCampaignIds);
    conditions.push(`cb.campaign_id = ANY($${params.length})`);
  }
  let sql = SELECT_CALLBACK;
  if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` ORDER BY cb.due_date ASC`;
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(reshape));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { campaignId, customerName, phone, dueDate, priority, notes } = req.body;
  if (!campaignId || !customerName || !phone) {
    return res.status(400).json({ error: 'campaignId, customerName and phone are required' });
  }
  const id = `cb_${Math.floor(Math.random() * 100000)}`;
  await pool.query(
    `INSERT INTO callbacks (id, customer_name, phone, campaign_id, agent_id, due_date, priority, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8)`,
    [id, customerName, phone, campaignId, req.user.id, dueDate || new Date(), priority || 'Medium', notes]
  );
  const { rows } = await pool.query(`${SELECT_CALLBACK} WHERE cb.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT agent_id FROM callbacks WHERE id = $1', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Callback not found' });

  // Only the agent it's assigned to, or a manager, can mark it complete --
  // previously this had no check at all, so any authenticated agent could
  // complete anyone else's callback.
  if (req.user.role === 'Agent' && existing[0].agent_id !== req.user.id) {
    return res.status(403).json({ error: 'This callback is not assigned to you' });
  }

  await pool.query(`UPDATE callbacks SET status = 'Completed' WHERE id = $1`, [id]);
  const { rows } = await pool.query(`${SELECT_CALLBACK} WHERE cb.id = $1`, [id]);
  res.json(reshape(rows[0]));
}));

module.exports = router;
