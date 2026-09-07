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
  // Salary/commission data -- an Agent may only ever see their own payroll
  // record, never a coworker's. Admin/Supervisor manage payroll for the
  // whole team, so they keep full visibility (matches their existing broad
  // trust level elsewhere -- creating/deactivating accounts, setting salaries).
  let sql = `${SELECT_PAYROLL}`;
  const params = [];
  if (req.user.role === 'Agent') {
    params.push(req.user.id);
    sql += ` WHERE p.agent_id = $1`;
  }
  sql += ` ORDER BY p.id DESC`;
  const { rows } = await pool.query(sql, params);
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

router.patch('/:id', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { bonusPkr, deductionsPkr } = req.body;
  const { rows: existing } = await pool.query('SELECT * FROM payroll WHERE id = $1', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Payroll record not found' });

  const bonus = bonusPkr !== undefined ? Number(bonusPkr) : Number(existing[0].bonus_pkr);
  const deductions = deductionsPkr !== undefined ? Number(deductionsPkr) : Number(existing[0].deductions_pkr);
  const netSalary = Number(existing[0].base_salary_pkr) + Number(existing[0].commission_pkr) + bonus - deductions;

  await pool.query(
    `UPDATE payroll SET bonus_pkr = $2, deductions_pkr = $3, net_salary_pkr = $4 WHERE id = $1`,
    [id, bonus, deductions, netSalary]
  );
  const { rows } = await pool.query(`${SELECT_PAYROLL} WHERE p.id = $1`, [id]);
  res.json(reshape(rows[0]));
}));

router.post('/generate', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month is required, in YYYY-MM format' });
  }

  const { rows: computed } = await pool.query(
    `SELECT
       u.id AS agent_id,
       u.base_salary_pkr,
       COALESCE(SUM(s.amount * c.commission_rate / 100), 0) AS commission_pkr
     FROM users u
     LEFT JOIN sales s
       ON s.agent_id = u.id
       AND s.status = 'Approved'
       AND to_char(s.sale_date, 'YYYY-MM') = $1
     LEFT JOIN campaigns c ON c.id = s.campaign_id
     WHERE u.role = 'Agent' AND u.status = 'Active'
     GROUP BY u.id, u.base_salary_pkr`,
    [month]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of computed) {
      const id = `pay_${row.agent_id}_${month}`;
      const baseSalary = Number(row.base_salary_pkr) || 0;
      const commission = Number(row.commission_pkr) || 0;
      await client.query(
        `INSERT INTO payroll (id, agent_id, month, base_salary_pkr, commission_pkr, bonus_pkr, deductions_pkr, net_salary_pkr, status)
         VALUES ($1,$2,$3,$4,$5,0,0,$4::numeric + $5::numeric,'Pending')
         ON CONFLICT (agent_id, month) DO UPDATE SET
           base_salary_pkr = EXCLUDED.base_salary_pkr,
           commission_pkr = EXCLUDED.commission_pkr,
           net_salary_pkr = EXCLUDED.base_salary_pkr + EXCLUDED.commission_pkr + payroll.bonus_pkr - payroll.deductions_pkr`,
        [id, row.agent_id, month, baseSalary, commission]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`${SELECT_PAYROLL} WHERE p.month = $1 ORDER BY p.id`, [month]);
  res.json(rows.map(reshape));
}));

module.exports = router;
