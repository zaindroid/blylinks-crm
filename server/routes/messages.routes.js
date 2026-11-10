const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/genId');

const router = express.Router();

// file_data (the actual attachment bytes) is deliberately left out here -- a channel's message
// list is read constantly, and pulling every attachment's bytes along with it would make that
// query enormous. It's only ever fetched by the dedicated /:id/attachment download route below.
const SELECT_MESSAGE = `
  SELECT m.id, m.channel, m.sender_id, m.text, m.created_at,
         m.file_name, m.file_type, m.file_size,
         u.name AS sender_name, u.role AS sender_role
  FROM messages m
  JOIN users u ON u.id = m.sender_id
`;

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

function reshape(row) {
  return {
    id: row.id,
    channel: row.channel,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    text: row.text,
    hasAttachment: !!row.file_name,
    fileName: row.file_name || null,
    fileType: row.file_type || null,
    fileSize: row.file_size !== null && row.file_size !== undefined ? Number(row.file_size) : null,
    timestamp: row.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    // Machine-readable and timezone-unambiguous -- the client uses it to work out
    // which messages are newer than what the user last read in each conversation.
    createdAt: row.created_at.toISOString()
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

async function isChannelAuthorized(userId, channel) {
  return isDmChannel(channel) ? isDmParticipant(userId, channel) : isMemberOfGroup(userId, channel);
}

router.get('/', asyncHandler(async (req, res) => {
  const { channel } = req.query;

  if (channel) {
    if (!(await isChannelAuthorized(req.user.id, channel))) {
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

// Streams one message's attachment bytes back. Same authorization as reading the message itself --
// not a separate, forgettable check -- since the file is exactly as sensitive as the conversation
// it was shared in.
router.get('/:id/attachment', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'SELECT channel, file_name, file_type, file_data FROM messages WHERE id = $1',
    [id]
  );
  const row = rows[0];
  if (!row || !row.file_data) return res.status(404).json({ error: 'Attachment not found' });
  if (!(await isChannelAuthorized(req.user.id, row.channel))) {
    return res.status(403).json({ error: 'You are not part of this conversation' });
  }
  res.set('Content-Type', row.file_type || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`);
  res.send(row.file_data);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { channel, text, recipientId, fileName, fileType, fileData } = req.body;
  if (!channel) {
    return res.status(400).json({ error: 'channel is required' });
  }
  if (!text && !fileData) {
    return res.status(400).json({ error: 'A message needs text, a file, or both' });
  }

  let fileBuffer = null;
  if (fileData) {
    if (!fileName) return res.status(400).json({ error: 'fileName is required when sharing a file' });
    try {
      fileBuffer = Buffer.from(fileData, 'base64');
    } catch {
      return res.status(400).json({ error: 'fileData must be base64-encoded' });
    }
    if (fileBuffer.length === 0) return res.status(400).json({ error: 'The file is empty' });
    if (fileBuffer.length > MAX_ATTACHMENT_BYTES) {
      return res.status(400).json({ error: `Files are limited to ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB` });
    }
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
    `INSERT INTO messages (id, channel, sender_id, text, file_name, file_type, file_size, file_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, channel, req.user.id, text || null, fileBuffer ? fileName : null, fileBuffer ? (fileType || 'application/octet-stream') : null,
      fileBuffer ? fileBuffer.length : null, fileBuffer]
  );
  const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.id = $1`, [id]);
  res.status(201).json(reshape(rows[0]));
}));

module.exports = router;
