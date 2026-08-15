const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SELECT_SALE = `
  SELECT s.*, u.name AS agent_name, c.name AS project_name
  FROM sales s
  JOIN users u ON u.id = s.agent_id
  JOIN campaigns c ON c.id = s.campaign_id
`;

function reshapeSale(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    campaignId: row.campaign_id,
    projectName: row.project_name,
    agentId: row.agent_id,
    agentName: row.agent_name,
    amount: Number(row.amount),
    status: row.status,
    date: row.sale_date.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
    agentNotes: row.agent_notes,
    qaNotes: row.qa_notes,
    verifiedBy: row.verified_by
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { campaignId } = req.query;
  const params = [];
  let sql = SELECT_SALE;
  if (campaignId) {
    params.push(campaignId);
    sql += ` WHERE s.campaign_id = $1`;
  }
  sql += ` ORDER BY s.created_at DESC`;
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(reshapeSale));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { campaignId, customerName, phone, email, amount, agentNotes } = req.body;
  if (!campaignId || !customerName || !phone || !amount) {
    return res.status(400).json({ error: 'campaignId, customerName, phone and amount are required' });
  }
  const id = `SALE-${Math.floor(1000 + Math.random() * 9000)}`;
  await pool.query(
    `INSERT INTO sales (id, customer_name, phone, email, campaign_id, agent_id, amount, status, agent_notes, qa_notes, verified_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8,'','')`,
    [id, customerName, phone, email || 'N/A', campaignId, req.user.id, amount, agentNotes || 'No notes provided.']
  );
  const { rows } = await pool.query(`${SELECT_SALE} WHERE s.id = $1`, [id]);
  res.status(201).json(reshapeSale(rows[0]));
}));

async function verifierName(userId) {
  const { rows } = await pool.query('SELECT name, role FROM users WHERE id = $1', [userId]);
  return rows[0] ? `${rows[0].name} (${rows[0].role})` : '';
}

router.patch('/:id/approve', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { qaNote } = req.body;
  const verifiedBy = await verifierName(req.user.id);
  await pool.query(
    `UPDATE sales SET status = 'Approved', qa_notes = $2, verified_by = $3 WHERE id = $1`,
    [id, qaNote || '', verifiedBy]
  );
  const { rows } = await pool.query(`${SELECT_SALE} WHERE s.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sale not found' });
  res.json(reshapeSale(rows[0]));
}));

router.patch('/:id/reject', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { qaNote } = req.body;
  const verifiedBy = await verifierName(req.user.id);
  await pool.query(
    `UPDATE sales SET status = 'Rejected', qa_notes = $2, verified_by = $3 WHERE id = $1`,
    [id, qaNote || '', verifiedBy]
  );
  const { rows } = await pool.query(`${SELECT_SALE} WHERE s.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sale not found' });
  res.json(reshapeSale(rows[0]));
}));

module.exports = router;
