const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { findUserRowById, shareCampaignAccess, getScopedAgentIds } = require('../db/usersRepo');

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
    monthlyAchievedPkr: Number(row.monthly_achieved_pkr),
    monthlySalesTarget: Number(row.monthly_sales_target)
  };
}

router.get('/', asyncHandler(async (req, res) => {
  // An Agent sees only their own target/achievement figures. A Supervisor sees only the
  // agents they share campaign access with -- the same scope PATCH below already enforces
  // for setting a target, and the same scoping sales/DNC/campaigns already use. Admin sees
  // everyone.
  let sql = SELECT_TARGETS;
  const params = [];
  if (req.user.role === 'Agent') {
    params.push(req.user.id);
    sql += ` WHERE t.agent_id = $1`;
  } else if (req.user.role === 'Supervisor') {
    params.push(await getScopedAgentIds(req.user.id));
    sql += ` WHERE t.agent_id = ANY($1)`;
  }
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(reshape));
}));

const PKR_FIELDS = ['dailyTargetPkr', 'dailyAchievedPkr', 'weeklyTargetPkr', 'weeklyAchievedPkr', 'monthlyTargetPkr', 'monthlyAchievedPkr'];

// Admins can set every target figure for any agent. A Supervisor may set an individual sales-count
// target, but only for an Agent who shares a campaign with them -- the same scoping used for Team
// Management -- and never the PKR figures, which stay Admin-only.
router.patch('/:agentId', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  const { dailyTargetPkr, dailyAchievedPkr, weeklyTargetPkr, weeklyAchievedPkr, monthlyTargetPkr, monthlyAchievedPkr, monthlySalesTarget } = req.body;

  if (req.user.role === 'Supervisor' && PKR_FIELDS.some(f => req.body[f] !== undefined)) {
    return res.status(403).json({ error: 'Supervisors can only set the monthly sales target' });
  }

  let salesTarget = null;
  if (monthlySalesTarget !== undefined && monthlySalesTarget !== null && monthlySalesTarget !== '') {
    salesTarget = Number(monthlySalesTarget);
    if (!Number.isInteger(salesTarget) || salesTarget < 0) {
      return res.status(400).json({ error: 'monthlySalesTarget must be a whole number of sales (0 or more)' });
    }
  }

  const target = await findUserRowById(agentId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role !== 'Agent') return res.status(400).json({ error: 'Targets can only be set for Agents' });
  if (req.user.role === 'Supervisor' && !(await shareCampaignAccess(req.user.id, agentId))) {
    return res.status(403).json({ error: 'This agent is outside your campaign access' });
  }

  await pool.query(
    `INSERT INTO targets (agent_id, daily_target_pkr, daily_achieved_pkr, weekly_target_pkr, weekly_achieved_pkr, monthly_target_pkr, monthly_achieved_pkr, monthly_sales_target)
     VALUES ($1, COALESCE($2,0), COALESCE($3,0), COALESCE($4,0), COALESCE($5,0), COALESCE($6,0), COALESCE($7,0), COALESCE($8,0))
     ON CONFLICT (agent_id) DO UPDATE SET
       daily_target_pkr = COALESCE($2, targets.daily_target_pkr),
       daily_achieved_pkr = COALESCE($3, targets.daily_achieved_pkr),
       weekly_target_pkr = COALESCE($4, targets.weekly_target_pkr),
       weekly_achieved_pkr = COALESCE($5, targets.weekly_achieved_pkr),
       monthly_target_pkr = COALESCE($6, targets.monthly_target_pkr),
       monthly_achieved_pkr = COALESCE($7, targets.monthly_achieved_pkr),
       monthly_sales_target = COALESCE($8, targets.monthly_sales_target)`,
    [agentId, dailyTargetPkr, dailyAchievedPkr, weeklyTargetPkr, weeklyAchievedPkr, monthlyTargetPkr, monthlyAchievedPkr, salesTarget]
  );

  const { rows } = await pool.query(`${SELECT_TARGETS} WHERE t.agent_id = $1`, [agentId]);
  res.json(reshape(rows[0]));
}));

module.exports = router;
