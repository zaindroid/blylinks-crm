const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const LIMITS = { title: 200, category: 60, summary: 500, content: 50000 };

function reshape(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    summary: row.summary,
    content: row.content,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null
  };
}

// Trims and length-checks one text field. Returns { value } or { error }.
function cleanText(name, value, { required = false } = {}) {
  if (value === undefined || value === null) return required ? { error: `${name} is required` } : { value: undefined };
  if (typeof value !== 'string') return { error: `${name} must be text` };
  const trimmed = value.trim();
  if (!trimmed) return required ? { error: `${name} is required` } : { value: '' };
  if (trimmed.length > LIMITS[name]) return { error: `${name} is too long (limit ${LIMITS[name].toLocaleString()} characters)` };
  return { value: trimmed };
}

// A card summary is optional: when left blank, use the start of the document itself.
function deriveSummary(content) {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM kb_articles ORDER BY category ASC, title ASC');
  res.json(rows.map(reshape));
}));

router.post('/', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const title = cleanText('title', req.body.title, { required: true });
  const content = cleanText('content', req.body.content, { required: true });
  const category = cleanText('category', req.body.category);
  const summary = cleanText('summary', req.body.summary);
  const failed = [title, content, category, summary].find(f => f.error);
  if (failed) return res.status(400).json({ error: failed.error });

  const id = genId('kb');
  await pool.query(
    `INSERT INTO kb_articles (id, category, title, summary, content, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, category.value || 'General', title.value, summary.value || deriveSummary(content.value), content.value, req.user.id]
  );
  const { rows } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [id]);
  res.status(201).json(reshape(rows[0]));
}));

router.patch('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { rows: [existing] } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Document not found' });

  const title = cleanText('title', req.body.title);
  const content = cleanText('content', req.body.content);
  const category = cleanText('category', req.body.category);
  const summary = cleanText('summary', req.body.summary);
  const failed = [title, content, category, summary].find(f => f.error);
  if (failed) return res.status(400).json({ error: failed.error });
  if (title.value === '' || content.value === '') {
    return res.status(400).json({ error: 'title and content cannot be empty' });
  }

  const nextContent = content.value ?? existing.content;
  // If the summary was left blank, regenerate it from the (possibly new) content.
  const nextSummary = summary.value === undefined ? existing.summary : (summary.value || deriveSummary(nextContent));
  await pool.query(
    `UPDATE kb_articles SET title = $2, category = $3, summary = $4, content = $5, updated_at = now() WHERE id = $1`,
    [existing.id, title.value ?? existing.title, category.value || existing.category, nextSummary, nextContent]
  );
  const { rows } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [existing.id]);
  res.json(reshape(rows[0]));
}));

router.delete('/:id', requireRole('Admin', 'Supervisor'), asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM kb_articles WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Document not found' });
  res.json({ status: 'deleted', id: req.params.id });
}));

module.exports = router;
