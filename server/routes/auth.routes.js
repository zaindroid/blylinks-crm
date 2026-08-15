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
  const token = issueToken(row);
  const user = await toPublicUser(row);
  res.json({ token, user });
}));

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, phone, cnic, shift } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ error: 'name, email, password and phone are required' });
  }

  const existing = await findUserRowByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  const isFirstUser = userCountRows[0].count === 0;
  const role = isFirstUser ? 'Admin' : 'Agent';
  const designation = isFirstUser ? 'Administrator' : 'Outbound Agent';

  const id = `${isFirstUser ? 'usr_admin' : 'usr_agent'}_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, designation, phone, cnic, status, avatar, shift)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',$9,$10)`,
    [
      id, name, email, passwordHash, role, designation, phone, cnic || 'N/A',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      shift || '08:00 AM - 04:00 PM'
    ]
  );

  const row = await findUserRowByEmail(email);
  const token = issueToken(row);
  const user = await toPublicUser(row);
  res.status(201).json({ token, user });
}));

module.exports = router;
