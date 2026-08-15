const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SELECT_ATTENDANCE = `
  SELECT a.*, u.name AS agent_name
  FROM attendance_logs a
  JOIN users u ON u.id = a.agent_id
`;

function reshape(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    date: row.log_date.toISOString().slice(0, 10),
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    status: row.status,
    totalHours: row.total_hours
  };
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_ATTENDANCE} ORDER BY a.log_date DESC, a.id DESC`);
  res.json(rows.map(reshape));
}));

router.post('/clock-in', asyncHandler(async (req, res) => {
  const id = `att_${Date.now()}`;
  await pool.query(
    `INSERT INTO attendance_logs (id, agent_id, log_date, clock_in, clock_out, status, total_hours)
     VALUES ($1,$2,CURRENT_DATE,$3,'--:--','Present','0h 01m (Active)')`,
    [id, req.user.id, nowTime()]
  );
  const { rows } = await pool.query(`${SELECT_ATTENDANCE} WHERE a.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

router.post('/clock-out', asyncHandler(async (req, res) => {
  const { rows: openLogs } = await pool.query(
    `SELECT id FROM attendance_logs WHERE agent_id = $1 AND clock_out = '--:--' ORDER BY log_date DESC LIMIT 1`,
    [req.user.id]
  );
  if (!openLogs[0]) {
    return res.status(400).json({ error: 'No open clock-in found for this user' });
  }
  await pool.query(
    `UPDATE attendance_logs SET clock_out = $2, status = 'Clocked Out' WHERE id = $1`,
    [openLogs[0].id, nowTime()]
  );
  const { rows } = await pool.query(`${SELECT_ATTENDANCE} WHERE a.id = $1`, [openLogs[0].id]);
  res.json(reshape(rows[0]));
}));

router.patch('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await pool.query('UPDATE attendance_logs SET status = $2 WHERE id = $1', [id, status]);
  const { rows } = await pool.query(`${SELECT_ATTENDANCE} WHERE a.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Attendance log not found' });
  res.json(reshape(rows[0]));
}));

module.exports = router;
