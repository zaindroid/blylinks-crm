const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');
const { genUniqueId } = genId;
const { requireRole } = require('../middleware/auth');
const { dncCheckLimiter } = require('../middleware/security');
const { getAllowedCampaignIds } = require('../db/usersRepo');
const { phoneKey } = require('../utils/phone');

const router = express.Router();

// One request carries one chunk of an upload (the browser splits a file and sends it in parts), so this caps
// a single request rather than a file. A file of any size is imported by sending more of these -- there is
// deliberately no overall file size limit anywhere.
const MAX_NUMBERS_PER_REQUEST = 20000;
const MAX_LIST_PAGE = 200;
const MAX_FIELDS = 20;
const MAX_FIELD_LENGTH = 200;
const MAX_HEADER_LENGTH = 60;

// Keys that would do something unexpected if they reached an object or a JSON document.
const BLOCKED_FIELD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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
    // Whatever else the sheet said about this number (name, city, reference, remarks).
    fields: row.fields || {},
    addedBy: row.added_by_name || '',
    createdAt: row.created_at.toISOString()
  };
}

// Everything past the number itself is display data that came out of an uploaded file, so it is trimmed to a
// predictable size and shape before being stored -- the list has to stay renderable no matter what a sheet
// happened to contain (a 4KB "value", a thousand columns, a key called __proto__).
function sanitizeFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const fields = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(fields).length >= MAX_FIELDS) break;
    const name = String(key).trim().slice(0, MAX_HEADER_LENGTH);
    if (!name || BLOCKED_FIELD_KEYS.has(name)) continue;
    const text = String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH);
    if (!text) continue;
    fields[name] = text;
  }
  return fields;
}

// A text search is a LIKE, so the characters LIKE gives a meaning to have to be escaped or a search for
// "50%" would match every row on the list.
function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
}

// One entry of an upload, reduced to what actually gets stored. Both shapes the endpoint accepts end up
// here: an object from an upload (which carries the rest of the sheet row) or a bare number.
function bulkCandidate(item) {
  if (typeof item !== 'object' || item === null) {
    return { display: String(item).trim().slice(0, 32), note: null, fields: {} };
  }
  return {
    display: String(item.phone ?? '').trim().slice(0, 32),
    note: item.note ? String(item.note).trim().slice(0, MAX_FIELD_LENGTH) : null,
    fields: sanitizeFields(item.fields)
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
  const { campaignId } = req.query;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIST_PAGE);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const params = [campaignId];
  const clauses = [];
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (q) {
    // The digits are matched against phone_key, which is stored normalised (last 10 digits, no punctuation),
    // so the search does not care how either side was written: "1234567899", "(123) 455-7899" and
    // "+92 123 4567899" all find the same row. Everything else the sheet held -- a name, a city, a reference,
    // the note -- is matched against search_text, which the database keeps in step with the row.
    const digits = q.replace(/\D/g, '');
    if (digits) {
      params.push(likePattern(digits));
      clauses.push(`d.phone_key LIKE $${params.length} ESCAPE '\\'`);

      // A search typed as a full international number ("+92 300 1234567", "0092-300-1234567") carries more
      // digits than the key that is stored, so neither pattern above can match it. Normalising the query the
      // same way the stored number was normalised is what makes those formats find the row.
      if (digits.length > 10) {
        params.push(digits.slice(-10));
        clauses.push(`d.phone_key = $${params.length}`);
      }
    }
    params.push(likePattern(q.toLowerCase()));
    clauses.push(`d.search_text LIKE $${params.length} ESCAPE '\\'`);
  }

  const search = clauses.length ? `AND (${clauses.join(' OR ')})` : '';
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

  const id = genUniqueId('dnc');
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

// Import: the browser reads the uploaded file and sends the rows it found, in chunks. Every upload merges
// into the campaign's one master list -- nothing is overwritten, and a number that is already listed stays
// a single row. Anything that is not a plausible phone number is reported back rather than silently dropped
// or silently accepted.
router.post('/bulk', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId } = req.body;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  // `rows` is what an upload sends (each one carries the rest of its sheet row: { phone, note, fields });
  // the older `numbers` -- bare strings -- is still accepted.
  const items = Array.isArray(req.body.rows)
    ? req.body.rows
    : Array.isArray(req.body.numbers) ? req.body.numbers.map(phone => ({ phone })) : null;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'rows (or numbers) must be a non-empty list' });
  }
  if (items.length > MAX_NUMBERS_PER_REQUEST) {
    return res.status(413).json({
      error: `Too many numbers in one request (limit ${MAX_NUMBERS_PER_REQUEST.toLocaleString()}).`
    });
  }

  // Collapse repeats *within this request* first -- a file that lists the same number twice must not become
  // two rows. Repeats against what the list already holds are handled by the ON CONFLICT below, which is
  // the only place that can be authoritative: two imports running at the same moment would each otherwise
  // look at the list and see it empty.
  const unique = new Map(); // phone_key -> { display, note, fields }
  const invalid = [];
  let invalidCount = 0;

  for (const item of items) {
    const raw = typeof item === 'object' && item !== null ? item.phone : item;
    const key = phoneKey(raw);
    if (!key) {
      invalidCount += 1;
      if (invalid.length < 20) invalid.push(String(raw ?? '').slice(0, 40));
      continue;
    }
    const candidate = bulkCandidate(item);
    const seen = unique.get(key);
    // Same number twice in one file: keep whichever version carries more with it.
    if (!seen || Object.keys(candidate.fields).length > Object.keys(seen.fields).length) {
      unique.set(key, candidate);
    }
  }

  let added = 0;
  let enriched = 0;

  if (unique.size > 0) {
    const keys = [...unique.keys()];
    const { rows: affected } = await pool.query(
      `INSERT INTO dnc_numbers (id, campaign_id, phone_key, phone_display, note, fields, added_by)
       SELECT t.id, $1, t.key, t.display, t.note, t.fields::jsonb, $2
       FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
              AS t(id, key, display, note, fields)
       ON CONFLICT (campaign_id, phone_key) DO UPDATE
         SET fields = dnc_numbers.fields || EXCLUDED.fields,
             note   = COALESCE(NULLIF(dnc_numbers.note, ''), EXCLUDED.note)
       WHERE dnc_numbers.fields IS DISTINCT FROM (dnc_numbers.fields || EXCLUDED.fields)
          OR (COALESCE(dnc_numbers.note, '') = '' AND COALESCE(EXCLUDED.note, '') <> '')
       RETURNING (xmax = 0) AS inserted`,
      [
        campaignId,
        req.user.id,
        keys.map(() => genUniqueId('dnc')),
        keys,
        keys.map(k => unique.get(k).display),
        keys.map(k => unique.get(k).note),
        keys.map(k => JSON.stringify(unique.get(k).fields))
      ]
    );
    // xmax = 0 means the row was inserted; anything else was a conflict that the DO UPDATE clause actually
    // changed (a re-upload of the same file changes nothing and is not reported as an enrichment).
    added = affected.filter(row => row.inserted).length;
    enriched = affected.length - added;
  }

  res.status(201).json({
    received: items.length,
    added,
    // Valid numbers that did not become a new row: repeats within the file, and numbers the list already had
    // (whether or not this upload filled in more detail about them).
    duplicates: items.length - invalidCount - added,
    enriched,
    invalid: invalidCount,
    invalidSamples: invalid
  });
}));

// Editing an entry. Changing the number itself is the interesting case: it must not be possible to edit a
// number into one that is already listed, which would leave the same number on the list twice.
router.put('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { rows: [entry] } = await pool.query('SELECT id, campaign_id FROM dnc_numbers WHERE id = $1', [req.params.id]);
  if (!entry) return res.status(404).json({ error: 'DNC entry not found' });
  const access = await campaignAccess(req.user, entry.campaign_id);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { phone, note } = req.body;
  const key = phoneKey(phone);
  if (!key) return res.status(400).json({ error: 'Enter a valid phone number (7 to 15 digits).' });

  try {
    await pool.query(
      'UPDATE dnc_numbers SET phone_key = $1, phone_display = $2, note = $3 WHERE id = $4',
      [key, String(phone).trim().slice(0, 32), note ? String(note).trim().slice(0, MAX_FIELD_LENGTH) : null, entry.id]
    );
  } catch (err) {
    // 23505 is the UNIQUE (campaign_id, phone_key) constraint refusing to create a second row for a number
    // that is already on this campaign's list.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That number is already on this campaign\'s DNC list.' });
    }
    throw err;
  }

  const { rows: [updated] } = await pool.query(
    'SELECT d.*, u.name AS added_by_name FROM dnc_numbers d LEFT JOIN users u ON u.id = d.added_by WHERE d.id = $1',
    [entry.id]
  );
  res.json(reshapeEntry(updated));
}));

router.delete('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { rows: [entry] } = await pool.query('SELECT id, campaign_id FROM dnc_numbers WHERE id = $1', [req.params.id]);
  if (!entry) return res.status(404).json({ error: 'DNC entry not found' });
  const access = await campaignAccess(req.user, entry.campaign_id);
  if (access.error) return res.status(access.status).json({ error: access.error });
  await pool.query('DELETE FROM dnc_numbers WHERE id = $1', [entry.id]);
  res.json({ status: 'deleted', id: entry.id });
}));

// Delete a chosen set of entries in one request (a checked selection from the list). Scoped to
// campaignId on the query itself -- `id = ANY($2) AND campaign_id = $1` -- so an id that does not
// actually belong to this campaign is simply not matched, never deleted, whatever a caller sends.
router.post('/bulk-delete', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId, ids } = req.body;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty list' });
  }
  if (ids.length > MAX_NUMBERS_PER_REQUEST) {
    return res.status(413).json({ error: `Too many ids in one request (limit ${MAX_NUMBERS_PER_REQUEST.toLocaleString()}).` });
  }

  const { rowCount } = await pool.query(
    'DELETE FROM dnc_numbers WHERE campaign_id = $1 AND id = ANY($2)',
    [campaignId, ids]
  );
  res.json({ status: 'deleted', deleted: rowCount });
}));

// Clear an entire campaign's list. The single most destructive thing this router can do, so it is
// its own explicit action rather than a side effect of any other call -- the client is expected to
// confirm with the person before ever sending this.
router.delete('/', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { campaignId } = req.query;
  const access = await campaignAccess(req.user, campaignId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { rowCount } = await pool.query('DELETE FROM dnc_numbers WHERE campaign_id = $1', [campaignId]);
  res.json({ status: 'deleted', deleted: rowCount, campaignId });
}));

module.exports = router;
