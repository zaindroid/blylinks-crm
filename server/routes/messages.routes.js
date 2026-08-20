const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');

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

// Direct-message channel ids use ':' and '|' -- characters that never appear in a user id --
// so a participant can be verified with plain prefix/suffix checks, no ambiguous parsing.
const DM_PREFIX = 'dm:';

function isDmChannel(channel) {
  return typeof channel === 'string' && channel.startsWith(DM_PREFIX);
}

function dmChannelId(userIdA, userIdB) {
  return `${DM_PREFIX}${[userIdA, userIdB].sort().join('|')}`;
}

function isDmParticipant(userId, channel) {
  return channel.startsWith(`${DM_PREFIX}${userId}|`) || channel.endsWith(`|${userId}`);
}

async function isMemberOfGroup(userId, groupId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM message_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return rows.length > 0;
}

async function allowedChannelsForUser(userId) {
  const { rows: groupRows } = await pool.query(
    'SELECT group_id FROM message_group_members WHERE user_id = $1',
    [userId]
  );
  const { rows: dmRows } = await pool.query(
    'SELECT DISTINCT channel FROM messages WHERE channel LIKE $1',
    [`${DM_PREFIX}%`]
  );
  const myDmChannels = dmRows.map(r => r.channel).filter(ch => isDmParticipant(userId, ch));
  return [...groupRows.map(r => r.group_id), ...myDmChannels];
}

router.get('/', asyncHandler(async (req, res) => {
  const { channel } = req.query;

  if (channel) {
    const authorized = isDmChannel(channel)
      ? isDmParticipant(req.user.id, channel)
      : await isMemberOfGroup(req.user.id, channel);
    if (!authorized) {
      return res.status(403).json({ error: 'You are not part of this conversation' });
    }
    const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.channel = $1 ORDER BY m.created_at ASC`, [channel]);
    return res.json(rows.map(reshape));
  }

  const allowed = await allowedChannelsForUser(req.user.id);
  if (allowed.length === 0) return res.json([]);
  const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.channel = ANY($1) ORDER BY m.created_at ASC`, [allowed]);
  res.json(rows.map(reshape));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { channel, text, recipientId } = req.body;
  if (!channel || !text) {
    return res.status(400).json({ error: 'channel and text are required' });
  }

  if (isDmChannel(channel)) {
    if (!recipientId || dmChannelId(req.user.id, recipientId) !== channel) {
      return res.status(403).json({ error: 'Invalid direct message channel' });
    }
  } else {
    const member = await isMemberOfGroup(req.user.id, channel);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
  }

  const id = genId('msg');
  await pool.query(
    `INSERT INTO messages (id, channel, sender_id, text) VALUES ($1,$2,$3,$4)`,
    [id, channel, req.user.id, text]
  );
  const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

module.exports = router;
