const bcrypt = require('bcrypt');
const crypto = require('crypto');
const request = require('supertest');
const pool = require('../db/pool');
const buildApp = require('../app');
const { joinDefaultGroups } = require('../utils/defaultGroups');

const app = buildApp();

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// Bypasses the (deliberately one-shot) /api/auth/register bootstrap endpoint so every
// test file can create its own admin regardless of what other files have already done
// to the shared test database. Namespaced ids/usernames keep files collision-free even
// though the whole suite shares one Postgres instance.
async function insertUser({ role = 'Admin', name, username, password = 'testpass123', baseSalaryPkr = 0 } = {}) {
  const id = uid(`usr_${role.toLowerCase()}`);
  const finalUsername = username || uid('user');
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor: tests don't need production-grade hashing time
  await pool.query(
    `INSERT INTO users (id, name, username, password_hash, role, designation, status, avatar, base_salary_pkr)
     VALUES ($1,$2,$3,$4,$5,$6,'Active',$7,$8)`,
    [id, name || `Test ${role}`, finalUsername, passwordHash, role, role, 'https://example.com/a.png', baseSalaryPkr]
  );
  // Mirrors what the real POST /api/users and /api/auth/register handlers do,
  // so tests built on this helper see the same default-group membership real
  // accounts get -- this insert bypasses those routes, so it doesn't happen
  // automatically the way it would for a real request.
  await joinDefaultGroups(pool, id);
  return { id, username: finalUsername, password };
}

async function loginToken(username, password = 'testpass123') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function createAdmin(overrides) {
  const user = await insertUser({ role: 'Admin', ...overrides });
  const token = await loginToken(user.username, user.password);
  return { ...user, token };
}

async function createCampaign(adminToken, overrides = {}) {
  const id = overrides.id || uid('camp');
  const res = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: overrides.name || 'Test Campaign',
      client: overrides.client || 'Test Client',
      category: overrides.category || 'Energy',
      monthlyTargetPkr: overrides.monthlyTargetPkr ?? 1000000,
      commissionRate: overrides.commissionRate ?? 10,
      ...overrides,
      id
    });
  if (res.status !== 201) throw new Error(`campaign create failed: ${JSON.stringify(res.body)}`);
  return id;
}

async function createAgentViaApi(adminToken, campaignIds = [], overrides = {}) {
  const username = overrides.username || uid('agent');
  const password = overrides.password || 'testpass123';
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: overrides.name || 'Test Agent',
      username,
      password,
      role: 'Agent',
      campaignIds,
      baseSalaryPkr: overrides.baseSalaryPkr
    });
  if (res.status !== 201) throw new Error(`agent create failed: ${JSON.stringify(res.body)}`);
  const token = await loginToken(username, password);
  return { ...res.body, username, password, token };
}

module.exports = { app, pool, uid, insertUser, loginToken, createAdmin, createCampaign, createAgentViaApi };
