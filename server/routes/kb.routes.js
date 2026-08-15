const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function reshape(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    summary: row.summary,
    content: row.content
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM kb_articles ORDER BY id ASC');
  res.json(rows.map(reshape));
}));

module.exports = router;
