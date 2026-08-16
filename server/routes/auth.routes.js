const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { findUserRowByUsername, toPublicUser } = require('../db/usersRepo');

const router = express.Router();

// Applies to /login and /register (the bootstrap admin-creation endpoint) --
// both are unauthenticated by design and were previously unthrottled, which
// meant unlimited password-guessing attempts against /login. 20 attempts per
// 15 minutes per IP is generous for a real user, punishing for a brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

function issueToken(row) {
  return jwt.sign({ sub: row.id, role: row.role }, config.jwtSecret, { expiresIn: '12h' });
}

router.get('/bootstrap-status', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  res.json({ needsBootstrap: rows[0].count === 0 });
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const row = await findUserRowByUsername(username);
  if (!row) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (row.status !== 'Active') {
    return res.status(403).json({ error: 'This account has been deactivated' });
  }
  const token = issueToken(row);
  const user = await toPublicUser(row);
  res.json({ token, user });
}));

// Bootstrap-only: there is no general self-signup. This endpoint creates the
// very first Admin account on an empty database and permanently locks itself
// the moment any user exists -- ongoing account creation happens through
// POST /api/users (Admin/Supervisor only), not here.
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCountRows[0].count > 0) {
    return res.status(403).json({ error: 'Registration is closed. Ask an administrator to create your account.' });
  }

  const { name, username, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }

  const id = `usr_admin_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (id, name, username, password_hash, role, designation, status, avatar)
     VALUES ($1,$2,$3,$4,'Admin','Administrator','Active',$5)`,
    [
      id, name, username, passwordHash,
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    ]
  );

  const row = await findUserRowByUsername(username);
  const token = issueToken(row);
  const user = await toPublicUser(row);
  res.status(201).json({ token, user });
}));

module.exports = router;
