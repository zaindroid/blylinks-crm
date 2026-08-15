const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const RESETTABLE_TABLES = [
  'messages', 'tickets', 'payroll', 'leads', 'callbacks', 'targets',
  'attendance_logs', 'sales', 'campaign_access', 'campaigns', 'kb_articles', 'users'
];

router.post('/reset-data', requireRole('Admin'), asyncHandler(async (req, res) => {
  await pool.query(`TRUNCATE TABLE ${RESETTABLE_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  res.json({ status: 'reset', tables: RESETTABLE_TABLES });
}));

module.exports = router;
