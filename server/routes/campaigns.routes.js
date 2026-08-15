const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

async function listCampaigns() {
  const { rows } = await pool.query(`
    SELECT
      c.*,
      COALESCE(s.total_sales_count, 0) AS total_sales_count,
      COALESCE(s.total_revenue_pkr, 0) AS total_revenue_pkr
    FROM campaigns c
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) AS total_sales_count, SUM(amount) AS total_revenue_pkr
      FROM sales
      WHERE status = 'Approved'
      GROUP BY campaign_id
    ) s ON s.campaign_id = c.id
    ORDER BY c.created_at ASC
  `);
  const { rows: links } = await pool.query('SELECT campaign_id, user_id FROM campaign_access');
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
    monthlyTargetPkr: Number(row.monthly_target_pkr),
    commissionRate: Number(row.commission_rate),
    status: row.status,
    assignedAgentIds: byCampaign[row.id] || [],
    totalSalesCount: Number(row.total_sales_count),
    totalRevenuePkr: Number(row.total_revenue_pkr)
  }));
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listCampaigns());
}));

router.post('/', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id, name, client, category, monthlyTargetPkr, commissionRate, assignedAgentIds = [] } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query(
      `INSERT INTO campaigns (id, name, client, category, monthly_target_pkr, commission_rate, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Active')`,
      [id, name, client, category, monthlyTargetPkr || 0, commissionRate || 0]
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

router.patch('/:id', requireRole('Admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, client, category, monthlyTargetPkr, commissionRate, assignedAgentIds } = req.body;

  await pool.query(
    `UPDATE campaigns SET
       name = COALESCE($2, name),
       client = COALESCE($3, client),
       category = COALESCE($4, category),
       monthly_target_pkr = COALESCE($5, monthly_target_pkr),
       commission_rate = COALESCE($6, commission_rate)
     WHERE id = $1`,
    [id, name, client, category, monthlyTargetPkr, commissionRate]
  );

  if (Array.isArray(assignedAgentIds)) {
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      await dbClient.query('DELETE FROM campaign_access WHERE campaign_id = $1', [id]);
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
