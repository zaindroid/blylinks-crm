const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const SELECT_LEAD = `
  SELECT l.*, c.name AS project_name, u.name AS assigned_agent_name
  FROM leads l
  JOIN campaigns c ON c.id = l.campaign_id
  LEFT JOIN users u ON u.id = l.assigned_agent_id
`;

function reshape(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    campaignId: row.campaign_id,
    projectName: row.project_name,
    source: row.source,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: row.assigned_agent_name,
    status: row.status,
    lastContact: row.last_contact ? row.last_contact.toISOString().slice(0, 10) : null,
    nextCallback: row.next_callback,
    notes: row.notes
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_LEAD} ORDER BY l.last_contact DESC NULLS LAST`);
  res.json(rows.map(reshape));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { campaignId, name, phone, email, address, assignedAgentId, notes } = req.body;
  if (!campaignId || !name || !phone) {
    return res.status(400).json({ error: 'campaignId, name and phone are required' });
  }
  const id = `lead_${Math.floor(Math.random() * 100000)}`;
  await pool.query(
    `INSERT INTO leads (id, name, phone, email, address, campaign_id, source, assigned_agent_id, status, last_contact, notes)
     VALUES ($1,$2,$3,$4,$5,$6,'Manager Lead Input',$7,'New',CURRENT_DATE,$8)`,
    [id, name, phone, email, address, campaignId, assignedAgentId || req.user.id, notes]
  );
  const { rows } = await pool.query(`${SELECT_LEAD} WHERE l.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await pool.query('UPDATE leads SET status = $2 WHERE id = $1', [id, status]);
  const { rows } = await pool.query(`${SELECT_LEAD} WHERE l.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
  res.json(reshape(rows[0]));
}));

module.exports = router;
