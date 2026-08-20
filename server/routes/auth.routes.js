const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');
const { passwordError } = require('../utils/validatePassword');
const { requireAuth } = require('../middleware/auth');
const { findUserRowByUsername, findUserRowById, toPublicUser } = require('../db/usersRepo');

const router = express.Router();

function issueToken(row) {
  return jwt.sign({ sub: row.id, role: row.role }, config.jwtSecret, { expiresIn: '12h' });
}

router.get('/bootstrap-status', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  res.json({ needsBootstrap: rows[0].count === 0 });
}));

router.post('/login', asyncHandler(async (req, res) => {
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
router.post('/register', asyncHandler(async (req, res) => {
  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCountRows[0].count > 0) {
    return res.status(403).json({ error: 'Registration is closed. Ask an administrator to create your account.' });
  }

  const { name, username, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }
  const pwError = passwordError(password);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  const id = genId('usr_admin');
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

// Self-service only -- an Admin/Supervisor sets someone's initial password via
// POST /api/users, but from then on only the account owner can change it, and
// only by proving they already know the current one.
router.patch('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  const pwError = passwordError(newPassword);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  const row = await findUserRowById(req.user.id);
  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
  res.json({ status: 'password updated' });
}));

module.exports = router;
