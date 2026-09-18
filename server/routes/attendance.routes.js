const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const genId = require('../utils/genId');

const router = express.Router();

const SELECT_ATTENDANCE = `
  SELECT a.*, to_char(a.log_date, 'YYYY-MM-DD') AS log_date_text, u.name AS agent_name
  FROM attendance_logs a
  JOIN users u ON u.id = a.agent_id
`;

function reshape(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    // Read as text: a DATE column comes back from pg as a JS Date at *server-local* midnight,
    // which toISOString() can shift by a day depending on the server's timezone.
    date: row.log_date_text,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    status: row.status,
    totalHours: row.total_hours
  };
}

// Everything about a shift is measured in Pakistan Standard Time (Asia/Karachi, UTC+5, no DST),
// regardless of where the server or the agent's browser happens to be. The timestamp comes from
// the server's own clock (NTP-synced), never from the client, so an agent can't backdate a
// clock-in by changing their PC's clock.
const PKT = 'Asia/Karachi';
const SHIFT_START_HOUR_PKT = 20; // 8:00 PM
const TARDY_GRACE_MINUTES = 15; // Tardy after 8:15 PM
const EARLY_ARRIVAL_HOUR_PKT = 18; // Clock-ins from 6:00 PM are treated as (early) on-time, not tardy

// One instant, three views of it (display time, shift date, minutes into the PKT day), all in PKT
// so a single clock-in can never disagree with itself.
function pktMoment(now = new Date()) {
  // Newer ICU builds put a narrow no-break space before AM/PM; \s matches it, so normalise to a plain space.
  const time = new Intl.DateTimeFormat('en-US', { timeZone: PKT, hour: '2-digit', minute: '2-digit', hour12: true })
    .format(now).replace(/\s/g, ' ');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: PKT, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  return { time, date, minutesIntoDay: hour * 60 + minute };
}

function clockInStatus(minutesIntoDay) {
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
  const moment = pktMoment();
  await pool.query(
    `INSERT INTO attendance_logs (id, agent_id, log_date, clock_in, clock_out, status, total_hours)
     VALUES ($1,$2,$3,$4,'--:--',$5,'0h 01m (Active)')`,
    [id, req.user.id, moment.date, moment.time, clockInStatus(moment.minutesIntoDay)]
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
    [openLogs[0].id, pktMoment().time]
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
