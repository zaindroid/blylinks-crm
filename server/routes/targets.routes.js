const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SELECT_TARGETS = `
  SELECT t.*, u.name AS agent_name
  FROM targets t
  JOIN users u ON u.id = t.agent_id
`;

function reshape(row) {
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    dailyTargetPkr: Number(row.daily_target_pkr),
    dailyAchievedPkr: Number(row.daily_achieved_pkr),
    weeklyTargetPkr: Number(row.weekly_target_pkr),
    weeklyAchievedPkr: Number(row.weekly_achieved_pkr),
    monthlyTargetPkr: Number(row.monthly_target_pkr),
    monthlyAchievedPkr: Number(row.monthly_achieved_pkr)
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(SELECT_TARGETS);
  res.json(rows.map(reshape));
}));

router.patch('/:agentId', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  const { dailyTargetPkr, dailyAchievedPkr, weeklyTargetPkr, weeklyAchievedPkr, monthlyTargetPkr, monthlyAchievedPkr } = req.body;

  await pool.query(
    `INSERT INTO targets (agent_id, daily_target_pkr, daily_achieved_pkr, weekly_target_pkr, weekly_achieved_pkr, monthly_target_pkr, monthly_achieved_pkr)
     VALUES ($1, COALESCE($2,0), COALESCE($3,0), COALESCE($4,0), COALESCE($5,0), COALESCE($6,0), COALESCE($7,0))
     ON CONFLICT (agent_id) DO UPDATE SET
       daily_target_pkr = COALESCE($2, targets.daily_target_pkr),
       daily_achieved_pkr = COALESCE($3, targets.daily_achieved_pkr),
       weekly_target_pkr = COALESCE($4, targets.weekly_target_pkr),
       weekly_achieved_pkr = COALESCE($5, targets.weekly_achieved_pkr),
       monthly_target_pkr = COALESCE($6, targets.monthly_target_pkr),
       monthly_achieved_pkr = COALESCE($7, targets.monthly_achieved_pkr)`,
    [agentId, dailyTargetPkr, dailyAchievedPkr, weeklyTargetPkr, weeklyAchievedPkr, monthlyTargetPkr, monthlyAchievedPkr]
  );

  const { rows } = await pool.query(`${SELECT_TARGETS} WHERE t.agent_id = $1`, [agentId]);
  res.json(reshape(rows[0]));
}));

module.exports = router;
