const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const SELECT_MESSAGE = `
  SELECT m.*, u.name AS sender_name, u.role AS sender_role
  FROM messages m
  JOIN users u ON u.id = m.sender_id
`;

function reshape(row) {
  return {
    id: row.id,
    channel: row.channel,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    text: row.text,
    timestamp: row.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { channel, since } = req.query;
  const conditions = [];
  const params = [];
  if (channel) {
    params.push(channel);
    conditions.push(`m.channel = $${params.length}`);
  }
  if (since) {
    params.push(since);
    conditions.push(`m.created_at > $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`${SELECT_MESSAGE} ${where} ORDER BY m.created_at ASC`, params);
  res.json(rows.map(reshape));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { channel, text } = req.body;
  if (!channel || !text) {
    return res.status(400).json({ error: 'channel and text are required' });
  }
  const id = `msg_${Date.now()}`;
  await pool.query(
    `INSERT INTO messages (id, channel, sender_id, text) VALUES ($1,$2,$3,$4)`,
    [id, channel, req.user.id, text]
  );
  const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

module.exports = router;
