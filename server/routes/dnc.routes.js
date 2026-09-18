const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');
const { requireRole } = require('../middleware/auth');
const { dncCheckLimiter } = require('../middleware/security');
const { getAllowedCampaignIds } = require('../db/usersRepo');
const { phoneKey } = require('../utils/phone');

const router = express.Router();

const MAX_BULK_NUMBERS = 20000;
const MAX_LIST_PAGE = 200;

// May this user work with this campaign's DNC list? Admins: any campaign. Everyone else: only campaigns
// they have been given access to -- an agent on Campaign A has no business probing Campaign B's list.
async function campaignAccess(user, campaignId) {
  if (!campaignId || typeof campaignId !== 'string') return { status: 400, error: 'campaignId is required' };
  const { rows } = await pool.query('SELECT id, name FROM campaigns WHERE id = $1', [campaignId]);
  if (!rows[0]) return { status: 404, error: 'Campaign not found' };
  if (user.role !== 'Admin') {
    const allowed = await getAllowedCampaignIds(user.id);
    if (!allowed.includes(campaignId)) return { status: 403, error: 'You do not have access to this campaign' };
  }
  return { campaign: rows[0] };
}

function reshapeEntry(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    phone: row.phone_display,
    note: row.note || '',
    addedBy: row.added_by_name || '',
    createdAt: row.created_at.toISOString()
  };
}

// ---- the agent-facing lookup ------------------------------------------------------------------
// Answers exactly one question -- "is this number on this campaign's list?" -- and nothing else: no
// entries, notes or who added them. Rate limited so the list can't be enumerated one number at a time.
router.post('/check', dncCheckLimiter, asyncHandler(async (req, res) => {
  const { campaignId, phone } = req.body;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const key = phoneKey(phone);
  if (!key) return res.status(400).json({ error: 'Enter a valid phone number (7 to 15 digits).' });

  const { rows } = await pool.query('SELECT 1 FROM dnc_numbers WHERE campaign_id = $1 AND phone_key = $2 LIMIT 1', [campaignId, key]);
  res.json({ found: rows.length > 0, campaignId, campaignName: access.campaign.name });
}));

// ---- list management: Admin and Supervisor only ------------------------------------------------

router.get('/summary', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const params = [];
  let filter = '';
  if (req.user.role !== 'Admin') {
    params.push(await getAllowedCampaignIds(req.user.id));
    filter = 'WHERE c.id = ANY($1)';
  }
  const { rows } = await pool.query(
    `SELECT c.id, c.name, COUNT(d.id)::int AS count
     FROM campaigns c LEFT JOIN dnc_numbers d ON d.campaign_id = c.id
     ${filter} GROUP BY c.id, c.name ORDER BY c.created_at ASC`,
    params
  );
  res.json(rows.map(r => ({ campaignId: r.id, campaignName: r.name, count: r.count })));
}));

router.get('/', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId, q } = req.query;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIST_PAGE);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const params = [campaignId];
  let search = '';
  const digits = typeof q === 'string' ? q.replace(/\D/g, '') : '';
  if (digits) {
    params.push(`%${digits}%`);
    search = 'AND d.phone_key LIKE $2';
  }
  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM dnc_numbers d WHERE d.campaign_id = $1 ${search}`, params
  );
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS added_by_name FROM dnc_numbers d LEFT JOIN users u ON u.id = d.added_by
     WHERE d.campaign_id = $1 ${search} ORDER BY d.created_at DESC, d.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ total, entries: rows.map(reshapeEntry) });
}));

router.post('/', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId, phone, note } = req.body;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const key = phoneKey(phone);
  if (!key) return res.status(400).json({ error: 'Enter a valid phone number (7 to 15 digits).' });

  const id = genId('dnc');
  const { rows } = await pool.query(
    `INSERT INTO dnc_numbers (id, campaign_id, phone_key, phone_display, note, added_by)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (campaign_id, phone_key) DO NOTHING RETURNING id`,
    [id, campaignId, key, String(phone).trim().slice(0, 32), note ? String(note).slice(0, 200) : null, req.user.id]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'That number is already on this campaign\'s DNC list.' });

  const { rows: [entry] } = await pool.query(
    'SELECT d.*, u.name AS added_by_name FROM dnc_numbers d LEFT JOIN users u ON u.id = d.added_by WHERE d.id = $1', [id]
  );
  res.status(201).json(reshapeEntry(entry));
}));

// Bulk import: the browser reads the uploaded file and sends the numbers it found. Anything that is
// not a plausible phone number is reported back rather than silently dropped or silently accepted.
router.post('/bulk', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId, numbers } = req.body;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'numbers must be a non-empty list' });
  }
  if (numbers.length > MAX_BULK_NUMBERS) {
    return res.status(413).json({ error: `Too many numbers in one upload (limit ${MAX_BULK_NUMBERS.toLocaleString()}). Split the file and upload it in parts.` });
  }

  const unique = new Map(); // phone_key -> display
  const invalid = [];
  let invalidCount = 0;
  for (const raw of numbers) {
    const key = phoneKey(raw);
    if (!key) {
      invalidCount += 1;
      if (invalid.length < 20) invalid.push(String(raw).slice(0, 40));
    } else if (!unique.has(key)) {
      unique.set(key, String(raw).trim().slice(0, 32));
    }
  }

  let added = 0;
  if (unique.size > 0) {
    const keys = [...unique.keys()];
    const { rows } = await pool.query(
      `INSERT INTO dnc_numbers (id, campaign_id, phone_key, phone_display, added_by)
       SELECT t.id, $1, t.key, t.display, $2
       FROM unnest($3::text[], $4::text[], $5::text[]) AS t(id, key, display)
       ON CONFLICT (campaign_id, phone_key) DO NOTHING RETURNING id`,
      [campaignId, req.user.id, keys.map(() => genId('dnc')), keys, keys.map(k => unique.get(k))]
    );
    added = rows.length;
  }

  res.status(201).json({
    received: numbers.length,
    added,
    // valid numbers that were not newly added: repeats within the file, or already on the list
    duplicates: numbers.length - invalidCount - added,
    invalid: invalidCount,
    invalidSamples: invalid
  });
}));

router.delete('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { rows: [entry] } = await pool.query('SELECT id, campaign_id FROM dnc_numbers WHERE id = $1', [req.params.id]);
  if (!entry) return res.status(404).json({ error: 'DNC entry not found' });
  const access = await campaignAccess(req.user, entry.campaign_id);
  if (access.error) return res.status(access.status).json({ error: access.error });
  await pool.query('DELETE FROM dnc_numbers WHERE id = $1', [entry.id]);
  res.json({ status: 'deleted', id: entry.id });
}));

module.exports = router;
