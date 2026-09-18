const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const genId = require('../utils/genId');
const { computePayroll, allocateRecovery, TARDIES_PER_PENALTY_WEEK } = require('../utils/payrollMath');

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
    workingDays: Number(row.working_days),
    perDayPkr: Number(row.per_day_pkr),
    commissionPkr: Number(row.commission_pkr),
    bonusPkr: Number(row.bonus_pkr),
    tardyWeeks: Number(row.tardy_weeks),
    tardyDeductionPkr: Number(row.tardy_deduction_pkr),
    advanceDeductionPkr: Number(row.advance_deduction_pkr),
    deductionsPkr: Number(row.deductions_pkr),
    netSalaryPkr: Number(row.net_salary_pkr),
    status: row.status,
    paymentDate: row.payment_date
  };
}

// A whole-or-fractional, finite, non-negative money amount. Returns the number, or null if invalid.
function parseMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? n : NaN;
}

// ---- facts derived from attendance and advances ------------------------------------------------

// Days actually worked = distinct days with a clock-in. A "penalty week" is a Monday-Sunday week
// (Pakistan calendar dates) with 3+ distinct tardy days; a week straddling two months only counts
// the tardy days that fall inside the month being paid.
async function attendanceFacts(db, agentId, month) {
  const { rows: [days] } = await db.query(
    `SELECT COUNT(DISTINCT log_date)::int AS n FROM attendance_logs
     WHERE agent_id = $1 AND to_char(log_date, 'YYYY-MM') = $2`,
    [agentId, month]
  );
  const { rows: [weeks] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT 1 FROM attendance_logs
       WHERE agent_id = $1 AND tardy AND to_char(log_date, 'YYYY-MM') = $2
       GROUP BY date_trunc('week', log_date)
       HAVING COUNT(DISTINCT log_date) >= $3
     ) w`,
    [agentId, month, TARDIES_PER_PENALTY_WEEK]
  );
  return { workingDays: days.n, tardyWeeks: weeks.n };
}

// Advances given on or before the end of the month that still have an unrecovered balance,
// oldest first. Recoveries only exist for payrolls already marked Paid.
async function outstandingAdvances(db, agentId, month) {
  const { rows } = await db.query(
    `SELECT a.id, a.amount - COALESCE(SUM(r.amount), 0) AS outstanding
     FROM salary_advances a
     LEFT JOIN salary_advance_recoveries r ON r.advance_id = a.id
     WHERE a.agent_id = $1
       AND a.given_on <= (date_trunc('month', ($2 || '-01')::date) + interval '1 month' - interval '1 day')::date
     GROUP BY a.id, a.amount, a.given_on, a.created_at
     HAVING a.amount - COALESCE(SUM(r.amount), 0) > 0
     ORDER BY a.given_on ASC, a.created_at ASC`,
    [agentId, month]
  );
  return rows.map(r => ({ id: r.id, outstanding: Number(r.outstanding) }));
}

// Recomputes and stores one payroll row. `manual` are the Admin-entered figures; `workingDays` and
// the tardy count come from attendance unless the Admin explicitly overrides working days.
async function calculateAndStore(db, { agentId, month, baseSalary, manual, workingDaysOverride }) {
  const facts = await attendanceFacts(db, agentId, month);
  const advances = await outstandingAdvances(db, agentId, month);
  const workingDays = workingDaysOverride ?? facts.workingDays;

  const result = computePayroll({
    baseSalary,
    workingDays,
    commission: manual.commission,
    bonus: manual.bonus,
    otherDeductions: manual.deductions,
    tardyWeeks: facts.tardyWeeks,
    outstandingAdvances: advances.reduce((s, a) => s + a.outstanding, 0)
  });

  const id = `pay_${agentId}_${month}`;
  await db.query(
    `INSERT INTO payroll (id, agent_id, month, base_salary_pkr, working_days, per_day_pkr, commission_pkr, bonus_pkr,
                          tardy_weeks, tardy_deduction_pkr, advance_deduction_pkr, deductions_pkr, net_salary_pkr, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending')
     ON CONFLICT (agent_id, month) DO UPDATE SET
       base_salary_pkr = EXCLUDED.base_salary_pkr, working_days = EXCLUDED.working_days, per_day_pkr = EXCLUDED.per_day_pkr,
       commission_pkr = EXCLUDED.commission_pkr, bonus_pkr = EXCLUDED.bonus_pkr, tardy_weeks = EXCLUDED.tardy_weeks,
       tardy_deduction_pkr = EXCLUDED.tardy_deduction_pkr, advance_deduction_pkr = EXCLUDED.advance_deduction_pkr,
       deductions_pkr = EXCLUDED.deductions_pkr, net_salary_pkr = EXCLUDED.net_salary_pkr`,
    [id, agentId, month, baseSalary, workingDays, result.perDay, manual.commission, manual.bonus,
      facts.tardyWeeks, result.tardyDeduction, result.advanceDeduction, manual.deductions, result.net]
  );
  return { id, advances, result };
}

// ---- payroll -----------------------------------------------------------------------------------

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

router.post('/generate', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'month is required, in YYYY-MM format' });
  }

  const { rows: agents } = await pool.query(
    `SELECT id, base_salary_pkr FROM users WHERE role = 'Agent' AND status = 'Active'`
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const agent of agents) {
      const { rows: [existing] } = await client.query(
        'SELECT status, commission_pkr, bonus_pkr, deductions_pkr FROM payroll WHERE agent_id = $1 AND month = $2 FOR UPDATE',
        [agent.id, month]
      );
      // A Paid record is final -- its advance recoveries are already booked. Revert it to Pending first to change it.
      if (existing?.status === 'Paid') continue;
      await calculateAndStore(client, {
        agentId: agent.id,
        month,
        baseSalary: Number(agent.base_salary_pkr) || 0,
        // Commission/bonus/other deductions are the Admin's own entries; regenerating never wipes them.
        manual: {
          commission: Number(existing?.commission_pkr) || 0,
          bonus: Number(existing?.bonus_pkr) || 0,
          deductions: Number(existing?.deductions_pkr) || 0
        }
      });
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

router.patch('/:id', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { commissionPkr, bonusPkr, deductionsPkr, workingDays } = req.body;

  const fields = { commissionPkr, bonusPkr, deductionsPkr };
  for (const [name, value] of Object.entries(fields)) {
    if (parseMoney(value) !== null && Number.isNaN(parseMoney(value))) {
      return res.status(400).json({ error: `${name} must be a non-negative number` });
    }
  }
  let daysOverride = null;
  if (workingDays !== undefined && workingDays !== null && workingDays !== '') {
    daysOverride = Number(workingDays);
    if (!Number.isInteger(daysOverride) || daysOverride < 0 || daysOverride > 31) {
      return res.status(400).json({ error: 'workingDays must be a whole number from 0 to 31' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query('SELECT * FROM payroll WHERE id = $1 FOR UPDATE', [id]);
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    if (existing.status === 'Paid') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This payroll is already paid. Revert it to Pending before changing it.' });
    }
    const pick = (incoming, current) => (parseMoney(incoming) === null ? Number(current) : parseMoney(incoming));
    await calculateAndStore(client, {
      agentId: existing.agent_id,
      month: existing.month,
      baseSalary: Number(existing.base_salary_pkr),
      manual: {
        commission: pick(commissionPkr, existing.commission_pkr),
        bonus: pick(bonusPkr, existing.bonus_pkr),
        deductions: pick(deductionsPkr, existing.deductions_pkr)
      },
      // Without an explicit override, keep whatever working-days figure is already on the record.
      workingDaysOverride: daysOverride ?? Number(existing.working_days)
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`${SELECT_PAYROLL} WHERE p.id = $1`, [id]);
  res.json(reshape(rows[0]));
}));

router.patch('/:id/toggle-payment', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query('SELECT * FROM payroll WHERE id = $1 FOR UPDATE', [id]);
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (existing.status === 'Paid') {
      // Reverting a payment gives the recovered advance money back to the outstanding balance.
      await client.query('DELETE FROM salary_advance_recoveries WHERE payroll_id = $1', [id]);
      await client.query(`UPDATE payroll SET status = 'Pending', payment_date = 'Pending Approval' WHERE id = $1`, [id]);
    } else {
      // Recalculate at the moment of payment so the final figure reflects any advance recorded since
      // the payroll was generated, then book the recovery against the oldest advances first.
      const { advances, result } = await calculateAndStore(client, {
        agentId: existing.agent_id,
        month: existing.month,
        baseSalary: Number(existing.base_salary_pkr),
        manual: {
          commission: Number(existing.commission_pkr),
          bonus: Number(existing.bonus_pkr),
          deductions: Number(existing.deductions_pkr)
        },
        workingDaysOverride: Number(existing.working_days)
      });
      for (const { advanceId, amount } of allocateRecovery(advances, result.advanceDeduction)) {
        await client.query(
          'INSERT INTO salary_advance_recoveries (advance_id, payroll_id, amount) VALUES ($1,$2,$3)',
          [advanceId, id, amount]
        );
      }
      await client.query(
        `UPDATE payroll SET status = 'Paid', payment_date = $2 WHERE id = $1`,
        [id, new Date().toISOString().slice(0, 10)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`${SELECT_PAYROLL} WHERE p.id = $1`, [id]);
  res.json(reshape(rows[0]));
}));

// ---- salary advances (Admin only) --------------------------------------------------------------

const SELECT_ADVANCES = `
  SELECT a.*, u.name AS agent_name,
         COALESCE((SELECT SUM(r.amount) FROM salary_advance_recoveries r WHERE r.advance_id = a.id), 0) AS recovered,
         to_char(a.given_on, 'YYYY-MM-DD') AS given_on_text
  FROM salary_advances a
  JOIN users u ON u.id = a.agent_id
`;

function reshapeAdvance(row) {
  const amount = Number(row.amount);
  const recovered = Number(row.recovered);
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    amountPkr: amount,
    recoveredPkr: recovered,
    outstandingPkr: Math.round((amount - recovered) * 100) / 100,
    givenOn: row.given_on_text,
    note: row.note || ''
  };
}

router.get('/advances', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_ADVANCES} ORDER BY a.given_on DESC, a.created_at DESC`);
  res.json(rows.map(reshapeAdvance));
}));

router.post('/advances', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { agentId, amountPkr, givenOn, note } = req.body;
  const amount = Number(amountPkr);
  if (!agentId || !Number.isFinite(amount) || amount <= 0 || amount >= 1e10) {
    return res.status(400).json({ error: 'agentId and a positive amountPkr are required' });
  }
  if (givenOn !== undefined && givenOn !== null && givenOn !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(givenOn)) {
    return res.status(400).json({ error: 'givenOn must be a date in YYYY-MM-DD format' });
  }

  const { rows: [agent] } = await pool.query('SELECT id, role FROM users WHERE id = $1', [agentId]);
  if (!agent) return res.status(404).json({ error: 'User not found' });
  if (agent.role !== 'Agent') return res.status(400).json({ error: 'Advances can only be recorded for Agents' });

  const id = genId('adv');
  try {
    await pool.query(
      `INSERT INTO salary_advances (id, agent_id, amount, given_on, note, created_by)
       VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6)`,
      [id, agentId, amount, givenOn || null, note ? String(note).slice(0, 300) : null, req.user.id]
    );
  } catch (err) {
    if (err.code === '22008' || err.code === '22007') return res.status(400).json({ error: 'givenOn is not a valid date' });
    throw err;
  }
  const { rows } = await pool.query(`${SELECT_ADVANCES} WHERE a.id = $1`, [id]);
  res.status(201).json(reshapeAdvance(rows[0]));
}));

router.delete('/advances/:id', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: [advance] } = await pool.query('SELECT id FROM salary_advances WHERE id = $1', [id]);
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  const { rows: recoveries } = await pool.query('SELECT 1 FROM salary_advance_recoveries WHERE advance_id = $1 LIMIT 1', [id]);
  if (recoveries.length > 0) {
    return res.status(409).json({ error: 'Part of this advance has already been recovered from a paid payroll, so it cannot be deleted.' });
  }
  await pool.query('DELETE FROM salary_advances WHERE id = $1', [id]);
  res.json({ status: 'deleted', id });
}));

module.exports = router;
