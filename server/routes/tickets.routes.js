const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SELECT_TICKET = `
  SELECT t.*, u.name AS agent_name
  FROM tickets t
  JOIN users u ON u.id = t.agent_id
`;

function reshape(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    date: row.ticket_date.toISOString().slice(0, 10),
    description: row.description
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_TICKET} ORDER BY t.ticket_date DESC`);
  res.json(rows.map(reshape));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { subject, category, priority, description } = req.body;
  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }
  const id = `TICK-${Math.floor(1000 + Math.random() * 9000)}`;
  await pool.query(
    `INSERT INTO tickets (id, agent_id, subject, category, priority, status, description)
     VALUES ($1,$2,$3,$4,$5,'Open',$6)`,
    [id, req.user.id, subject, category, priority || 'Medium', description]
  );
  const { rows } = await pool.query(`${SELECT_TICKET} WHERE t.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

router.patch('/:id/resolve', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE tickets SET status = 'Resolved' WHERE id = $1`, [id]);
  const { rows } = await pool.query(`${SELECT_TICKET} WHERE t.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' });
  res.json(reshape(rows[0]));
}));

module.exports = router;
