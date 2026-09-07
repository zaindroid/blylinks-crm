const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const genId = require('../utils/genId');

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

const SHIFT_START_HOUR_PKT = 20; // 8:00 PM
const TARDY_GRACE_MINUTES = 15; // Tardy after 8:15 PM
const EARLY_ARRIVAL_HOUR_PKT = 18; // Clock-ins from 6:00 PM are treated as (early) on-time, not tardy

function clockInStatusPKT() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  const minutesIntoDay = hour * 60 + minute;
  const windowStart = EARLY_ARRIVAL_HOUR_PKT * 60;
  const windowEnd = SHIFT_START_HOUR_PKT * 60 + TARDY_GRACE_MINUTES;
  const isOnTime = minutesIntoDay >= windowStart && minutesIntoDay <= windowEnd;
  return isOnTime ? 'Present' : 'Tardy';
}

router.get('/', asyncHandler(async (req, res) => {
  // An Agent may only see their own clock-in/out history, not the whole
  // team's. Admin/Supervisor keep full visibility -- they already manage
  // attendance status overrides for everyone.
  let sql = `${SELECT_ATTENDANCE}`;
  const params = [];
  if (req.user.role === 'Agent') {
    params.push(req.user.id);
    sql += ` WHERE a.agent_id = $1`;
  }
  sql += ` ORDER BY a.log_date DESC, a.id DESC`;
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(reshape));
}));

router.post('/clock-in', asyncHandler(async (req, res) => {
  const id = genId('att');
  const status = clockInStatusPKT();
  await pool.query(
    `INSERT INTO attendance_logs (id, agent_id, log_date, clock_in, clock_out, status, total_hours)
     VALUES ($1,$2,CURRENT_DATE,$3,'--:--',$4,'0h 01m (Active)')`,
    [id, req.user.id, nowTime(), status]
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
