const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { getAllowedCampaignIds, shareCampaignAccess } = require('../db/usersRepo');

const router = express.Router();

async function listCampaigns() {
  const { rows } = await pool.query(`
    SELECT
      c.*,
      COALESCE(s.total_sales_count, 0) AS total_sales_count,
      COALESCE(s.total_revenue_pkr, 0) AS total_revenue_pkr,
      COALESCE(m.month_sales_count, 0) AS month_sales_count
    FROM campaigns c
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) AS total_sales_count, SUM(amount) AS total_revenue_pkr
      FROM sales
      WHERE status = 'Approved'
      GROUP BY campaign_id
    ) s ON s.campaign_id = c.id
    LEFT JOIN (
      -- Sales logged this calendar month (Pakistan time), excluding rejected ones: this is what a
      -- "monthly sales goal" is measured against. totalSalesCount above is all-time and Approved-only.
      SELECT campaign_id, COUNT(*) AS month_sales_count
      FROM sales
      WHERE status <> 'Rejected'
        AND date_trunc('month', sale_date AT TIME ZONE 'Asia/Karachi') = date_trunc('month', now() AT TIME ZONE 'Asia/Karachi')
      GROUP BY campaign_id
    ) m ON m.campaign_id = c.id
    ORDER BY c.created_at ASC
  `);
  // campaign_access also carries a Supervisor's own management access to the campaign (it's what
  // getAllowedCampaignIds scopes their view by), which is a different thing from "which agents are
  // assigned to work it" -- assignedAgentIds below must mean only the latter, matching both its
  // name and the write side (the PATCH handler only ever deletes/inserts Agent-role rows).
  const { rows: links } = await pool.query(
    `SELECT ca.campaign_id, ca.user_id FROM campaign_access ca JOIN users u ON u.id = ca.user_id WHERE u.role = 'Agent'`
  );
  const byCampaign = {};
  for (const l of links) {
    if (!byCampaign[l.campaign_id]) byCampaign[l.campaign_id] = [];
    byCampaign[l.campaign_id].push(l.user_id);
  }
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    client: row.client,
    category: row.category,
    monthlySalesGoal: Number(row.monthly_sales_goal),
    monthlyTargetPkr: Number(row.monthly_target_pkr),
    commissionRate: Number(row.commission_rate),
    status: row.status,
    assignedAgentIds: byCampaign[row.id] || [],
    totalSalesCount: Number(row.total_sales_count),
    monthSalesCount: Number(row.month_sales_count),
    totalRevenuePkr: Number(row.total_revenue_pkr)
  }));
}

// A Supervisor may only ever assign agents they themselves already share campaign access with --
// mirrors the same check used for Team Management and Message Groups. Admin is unrestricted.
async function assertAgentsInScope(req, agentIds) {
  if (req.user.role !== 'Supervisor') return;
  const checks = await Promise.all(agentIds.map(uid => shareCampaignAccess(req.user.id, uid)));
  const outOfScope = agentIds.filter((_, i) => !checks[i]);
  if (outOfScope.length > 0) {
    const err = new Error('You can only assign agents within your own campaign scope');
    err.status = 403;
    throw err;
  }
}

// undefined/null/'' means "not provided"; anything else must be a whole number >= 0.
function parseSalesGoal(value) {
  if (value === undefined || value === null || value === '') return { provided: false };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return { provided: true, error: 'monthlySalesGoal must be a whole number of sales (0 or more)' };
  return { provided: true, value: n };
}

router.get('/', asyncHandler(async (req, res) => {
  const campaigns = await listCampaigns();
  if (req.user.role === 'Admin') {
    return res.json(campaigns);
  }
  // Agent/Supervisor only see campaigns they're actually assigned to -- each
  // one's revenue/target figures are business-sensitive, and there's no
  // reason a rep on Campaign A should see Campaign B's numbers.
  const allowedCampaignIds = await getAllowedCampaignIds(req.user.id);
  res.json(campaigns.filter(c => allowedCampaignIds.includes(c.id)));
}));

router.post('/', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id, name, client, category, monthlyTargetPkr, commissionRate, monthlySalesGoal, assignedAgentIds = [] } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }
  const goal = parseSalesGoal(monthlySalesGoal);
  if (goal.error) return res.status(400).json({ error: goal.error });
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query(
      `INSERT INTO campaigns (id, name, client, category, monthly_target_pkr, commission_rate, monthly_sales_goal, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Active')`,
      [id, name, client, category, monthlyTargetPkr || 0, commissionRate || 0, goal.value ?? 0]
    );
    for (const userId of assignedAgentIds) {
      await dbClient.query('INSERT INTO campaign_access (campaign_id, user_id) VALUES ($1,$2)', [id, userId]);
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
  res.status(201).json(await listCampaigns());
}));

// A Supervisor may edit a campaign's own details and reassign its agents -- but only for a
// campaign they already have access to, and only to agents they themselves share campaign
// access with (assertAgentsInScope). Creating a campaign and toggling Active/Inactive stay
// Admin-only below: those are organisation-wide decisions, not day-to-day campaign upkeep.
router.patch('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, client, category, monthlyTargetPkr, commissionRate, monthlySalesGoal, assignedAgentIds } = req.body;
  const goal = parseSalesGoal(monthlySalesGoal);
  if (goal.error) return res.status(400).json({ error: goal.error });

  if (req.user.role === 'Supervisor') {
    const allowedCampaignIds = await getAllowedCampaignIds(req.user.id);
    if (!allowedCampaignIds.includes(id)) {
      return res.status(403).json({ error: 'This campaign is outside your campaign access' });
    }
  }

  if (Array.isArray(assignedAgentIds)) {
    try {
      await assertAgentsInScope(req, assignedAgentIds);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  }

  await pool.query(
    `UPDATE campaigns SET
       name = COALESCE($2, name),
       client = COALESCE($3, client),
       category = COALESCE($4, category),
       monthly_target_pkr = COALESCE($5, monthly_target_pkr),
       commission_rate = COALESCE($6, commission_rate),
       monthly_sales_goal = COALESCE($7, monthly_sales_goal)
     WHERE id = $1`,
    [id, name, client, category, monthlyTargetPkr, commissionRate, goal.value ?? null]
  );

  if (Array.isArray(assignedAgentIds)) {
    // Only ever touches Agent-role rows. campaign_access also carries a Supervisor's own
    // visibility into the campaign (getAllowedCampaignIds scopes their GET by the same rows) --
    // a blanket "delete everything for this campaign" here would wipe that out from under the
    // very Supervisor submitting the edit and lock them out of the campaign they just changed.
    // Restricting both the delete and the re-insert to real Agents keeps management access
    // (who can see/edit the campaign) and work assignment (who is assigned to it) independent.
    const { rows: agentRows } = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1) AND role = 'Agent'`,
      [assignedAgentIds]
    );
    const agentIds = agentRows.map(r => r.id);

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      await dbClient.query(
        `DELETE FROM campaign_access WHERE campaign_id = $1 AND user_id IN (SELECT id FROM users WHERE role = 'Agent')`,
        [id]
      );
      for (const userId of agentIds) {
        await dbClient.query('INSERT INTO campaign_access (campaign_id, user_id) VALUES ($1,$2)', [id, userId]);
      }
      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }
  }

  res.json(await listCampaigns());
}));

router.patch('/:id/toggle-status', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  await pool.query(
    `UPDATE campaigns SET status = CASE WHEN status = 'Active' THEN 'Inactive' ELSE 'Active' END WHERE id = $1`,
    [id]
  );
  res.json(await listCampaigns());
}));

module.exports = router;
