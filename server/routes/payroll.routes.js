const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SELECT_PAYROLL = `
  SELECT p.*, u.name AS agent_name
  FROM payroll p
  JOIN users u ON u.id = p.agent_id
`;

function reshape(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    month: row.month,
    baseSalaryPkr: Number(row.base_salary_pkr),
    commissionPkr: Number(row.commission_pkr),
    bonusPkr: Number(row.bonus_pkr),
    deductionsPkr: Number(row.deductions_pkr),
    netSalaryPkr: Number(row.net_salary_pkr),
    status: row.status,
    paymentDate: row.payment_date
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_PAYROLL} ORDER BY p.id DESC`);
  res.json(rows.map(reshape));
}));

router.patch('/:id/toggle-payment', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT status FROM payroll WHERE id = $1', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Payroll record not found' });

  const nextStatus = existing[0].status === 'Paid' ? 'Pending' : 'Paid';
  const paymentDate = nextStatus === 'Paid' ? new Date().toISOString().slice(0, 10) : 'Pending Approval';

  await pool.query('UPDATE payroll SET status = $2, payment_date = $3 WHERE id = $1', [id, nextStatus, paymentDate]);
  const { rows } = await pool.query(`${SELECT_PAYROLL} WHERE p.id = $1`, [id]);
  res.json(reshape(rows[0]));
}));

module.exports = router;
