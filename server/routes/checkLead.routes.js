const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { phoneKey } = require('../utils/phone');

const router = express.Router();

// Matches by last-10-digits, the same normalization DNC already uses, so formatting/country-code
// prefixes never let a duplicate slip past. Deliberately not scoped by campaign or role: the whole
// point of this check is "has this number already been worked ANYWHERE in the org", so an Agent on
// Campaign A must be able to see activity on Campaign B too, same as Admin/Supervisor.
const LAST10 = (col) => `right(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), 10)`;

router.get('/', asyncHandler(async (req, res) => {
  const key = phoneKey(req.query.phone);
  if (!key) {
    return res.status(400).json({ error: 'phone is required and must look like a real phone number' });
  }
  const last10 = key.length > 10 ? key.slice(-10) : key;

  const [salesRes, leadsRes, callbacksRes] = await Promise.all([
    pool.query(
      `SELECT s.id, s.customer_name, s.phone, s.phone2, s.campaign_id, c.name AS project_name,
              s.agent_id, u.name AS agent_name, s.status, s.amount, s.sale_date
       FROM sales s
       JOIN campaigns c ON c.id = s.campaign_id
       JOIN users u ON u.id = s.agent_id
       WHERE ${LAST10('s.phone')} = $1 OR ${LAST10('s.phone2')} = $1
       ORDER BY s.sale_date DESC`,
      [last10]
    ),
    pool.query(
      `SELECT l.id, l.name, l.phone, l.campaign_id, c.name AS project_name,
              l.assigned_agent_id, u.name AS assigned_agent_name, l.status,
              to_char(l.last_contact, 'YYYY-MM-DD') AS last_contact_text
       FROM leads l
       JOIN campaigns c ON c.id = l.campaign_id
       LEFT JOIN users u ON u.id = l.assigned_agent_id
       WHERE ${LAST10('l.phone')} = $1
       ORDER BY l.last_contact DESC NULLS LAST`,
      [last10]
    ),
    pool.query(
      `SELECT cb.id, cb.customer_name, cb.phone, cb.campaign_id, c.name AS project_name,
              cb.agent_id, u.name AS agent_name, cb.status, cb.due_date
       FROM callbacks cb
       JOIN campaigns c ON c.id = cb.campaign_id
       JOIN users u ON u.id = cb.agent_id
       WHERE ${LAST10('cb.phone')} = $1
       ORDER BY cb.due_date DESC`,
      [last10]
    )
  ]);

  res.json({
    sales: salesRes.rows.map(r => ({
      id: r.id,
      customerName: r.customer_name,
      phone: r.phone,
      phone2: r.phone2,
      campaignId: r.campaign_id,
      projectName: r.project_name,
      agentId: r.agent_id,
      agentName: r.agent_name,
      status: r.status,
      amount: Number(r.amount),
      date: r.sale_date.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
    })),
    leads: leadsRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      campaignId: r.campaign_id,
      projectName: r.project_name,
      assignedAgentId: r.assigned_agent_id,
      assignedAgentName: r.assigned_agent_name,
      status: r.status,
      lastContact: r.last_contact_text
    })),
    callbacks: callbacksRes.rows.map(r => ({
      id: r.id,
      customerName: r.customer_name,
      phone: r.phone,
      campaignId: r.campaign_id,
      projectName: r.project_name,
      agentId: r.agent_id,
      agentName: r.agent_name,
      status: r.status,
      dueDate: r.due_date
    }))
  });
}));

module.exports = router;
