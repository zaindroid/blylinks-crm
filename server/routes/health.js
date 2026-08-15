const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/ready', asyncHandler(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
}));

router.get('/version', (req, res) => {
  const versionFile = path.join(__dirname, '..', '..', 'VERSION');
  let sha = process.env.GIT_SHA || 'unknown';
  let built = process.env.BUILD_TIME || 'unknown';
  if (fs.existsSync(versionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      sha = data.sha || sha;
      built = data.built || built;
    } catch {
      // ignore malformed VERSION file, fall back to env/defaults
    }
  }
  res.json({ sha, built });
});

module.exports = router;
