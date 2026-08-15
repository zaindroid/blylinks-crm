const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { findUserRowByEmail, toPublicUser } = require('../db/usersRepo');

const router = express.Router();

function issueToken(row) {
  return jwt.sign({ sub: row.id, role: row.role }, config.jwtSecret, { expiresIn: '12h' });
}

router.get('/bootstrap-status', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  res.json({ needsBootstrap: rows[0].count === 0 });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const row = await findUserRowByEmail(email);
  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
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
router.post('/register', asyncHandler(async (req, res) => {
  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCountRows[0].count > 0) {
    return res.status(403).json({ error: 'Registration is closed. Ask an administrator to create your account.' });
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const id = `usr_admin_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, designation, status, avatar)
     VALUES ($1,$2,$3,$4,'Admin','Administrator','Active',$5)`,
    [
      id, name, email, passwordHash,
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    ]
  );

  const row = await findUserRowByEmail(email);
  const token = issueToken(row);
  const user = await toPublicUser(row);
  res.status(201).json({ token, user });
}));

module.exports = router;
