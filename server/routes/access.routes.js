const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');
const { requireRole } = require('../middleware/auth');
const { getState, invalidate, isAllowedBy, normalizeIp, parseEntry, buildBlockList, overrideActive, SETTING_KEY, MAX_ENTRIES } = require('../utils/ipAccess');

const router = express.Router();

// Everything here is Admin-only: deciding who may open the portal is the most sensitive setting there is.
router.use(requireRole('Admin'));

function reshape(row) {
  return { id: row.id, cidr: row.cidr, label: row.label || '', createdAt: row.created_at.toISOString() };
}

async function status(req) {
  invalidate(); // an Admin looking at this screen should never see a stale list
  const state = await getState();
  return {
    enabled: state.enabled,
    // True when the server has been started with IP_RESTRICTION_DISABLED=true: the switch shows as on but nothing is enforced.
    overrideActive: overrideActive(),
    yourIp: normalizeIp(req.ip),
    yourIpAllowed: isAllowedBy(state, req.ip),
    entries: state.entries.map(reshape)
  };
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await status(req));
}));

router.post('/entries', asyncHandler(async (req, res) => {
  const parsed = parseEntry(req.body.cidr);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM ip_allowlist');
  if (count >= MAX_ENTRIES) return res.status(400).json({ error: `The list is full (limit ${MAX_ENTRIES} entries).` });

  const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 100) : '';
  const { rows } = await pool.query(
    `INSERT INTO ip_allowlist (id, cidr, label, created_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (cidr) DO NOTHING RETURNING id`,
    [genId('ip'), parsed.canonical, label || null, req.user.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: `${parsed.canonical} is already on the list.` });

  invalidate();
  res.status(201).json(await status(req));
}));

router.delete('/entries/:id', asyncHandler(async (req, res) => {
  const { rows: [entry] } = await pool.query('SELECT id FROM ip_allowlist WHERE id = $1', [req.params.id]);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  // While enforcement is on, refuse a removal that would cut off the very Admin making it.
  invalidate();
  const state = await getState();
  if (state.enabled && !overrideActive()) {
    const remaining = { blockList: buildBlockList(state.entries.filter(e => e.id !== entry.id)) };
    if (!isAllowedBy(remaining, req.ip)) {
      return res.status(409).json({ error: 'Removing this entry would block your own current IP address. Add another entry that covers you first, or turn the restriction off.' });
    }
  }

  await pool.query('DELETE FROM ip_allowlist WHERE id = $1', [entry.id]);
  invalidate();
  res.json(await status(req));
}));

router.put('/settings', asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be true or false' });

  if (enabled) {
    invalidate();
    const state = await getState();
    if (!isAllowedBy(state, req.ip)) {
      return res.status(409).json({
        error: `Your current IP address (${normalizeIp(req.ip) || 'unknown'}) is not on the list. Turning the restriction on now would lock you out, so add it first.`
      });
    }
  }

  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SETTING_KEY, String(enabled)]
  );
  invalidate();
  res.json(await status(req));
}));

module.exports = router;
