const request = require('supertest');
const { app, pool, insertUser, loginToken } = require('./helpers');

describe('auth bootstrap flow', () => {
  it('bootstrap-status reports needsBootstrap=true against a genuinely empty users table', async () => {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(rows[0].n).toBe(0); // this test MUST run before any other file inserts a user
    const res = await request(app).get('/api/auth/bootstrap-status');
    expect(res.status).toBe(200);
    expect(res.body.needsBootstrap).toBe(true);
  });

  it('POST /api/auth/register creates the first Admin on an empty database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bootstrap Admin', username: 'bootstrap_admin', password: 'bootstrap123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('Admin');
    expect(res.body.user.username).toBe('bootstrap_admin');
  });

  it('bootstrap-status now reports needsBootstrap=false', async () => {
    const res = await request(app).get('/api/auth/bootstrap-status');
    expect(res.body.needsBootstrap).toBe(false);
  });

  it('a second call to /register is permanently rejected once any user exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Rogue Admin', username: 'rogue_admin', password: 'whatever123' });
    expect(res.status).toBe(403);
  });
});

describe('login', () => {
  it('succeeds with the correct username/password and returns a usable token', async () => {
    const user = await insertUser({ role: 'Agent', username: 'login_ok_agent' });
    const res = await request(app).post('/api/auth/login').send({ username: user.username, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(user.username);
  });

  it('is case-insensitive on username', async () => {
    const user = await insertUser({ role: 'Agent', username: 'CaseSensitiveName' });
    const res = await request(app).post('/api/auth/login').send({ username: 'casesensitivename', password: user.password });
    expect(res.status).toBe(200);
  });

  it('rejects the wrong password', async () => {
    const user = await insertUser({ role: 'Agent', username: 'wrong_pw_agent' });
    const res = await request(app).post('/api/auth/login').send({ username: user.username, password: 'not-the-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a login for a deactivated (Inactive) account', async () => {
    const user = await insertUser({ role: 'Agent', username: 'inactive_agent' });
    await pool.query(`UPDATE users SET status = 'Inactive' WHERE username = $1`, [user.username]);
    const res = await request(app).post('/api/auth/login').send({ username: user.username, password: user.password });
    expect(res.status).toBe(403);
  });

  it('never returns the password hash in any response body', async () => {
    const user = await insertUser({ role: 'Agent', username: 'no_hash_leak_agent' });
    const res = await request(app).post('/api/auth/login').send({ username: user.username, password: user.password });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/i);
  });
});

describe('registration/creation password strength', () => {
  it('POST /api/users rejects a password shorter than 8 characters', async () => {
    const admin = await insertUser({ role: 'Admin', username: 'pw_strength_admin' });
    const token = await loginToken(admin.username, admin.password);
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Weak', username: 'weak_pw_user', password: 'short', role: 'Agent', campaignIds: [] });
    expect(res.status).toBe(400);
  });
});

describe('self-service password change', () => {
  it('requires the correct current password', async () => {
    const user = await insertUser({ role: 'Agent', username: 'cp_wrong_current' });
    const token = await loginToken(user.username, user.password);
    const res = await request(app).patch('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'not-the-real-one', newPassword: 'brandnewpass123' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const user = await insertUser({ role: 'Agent', username: 'cp_short_new' });
    const token = await loginToken(user.username, user.password);
    const res = await request(app).patch('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: user.password, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('changes the password, after which the old password no longer works and the new one does', async () => {
    const user = await insertUser({ role: 'Agent', username: 'cp_success', password: 'originalpass123' });
    const token = await loginToken(user.username, user.password);

    const changeRes = await request(app).patch('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'originalpass123', newPassword: 'brandnewpass456' });
    expect(changeRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ username: user.username, password: 'originalpass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ username: user.username, password: 'brandnewpass456' });
    expect(newLogin.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app).patch('/api/auth/change-password').send({ currentPassword: 'a', newPassword: 'brandnewpass789' });
    expect(res.status).toBe(401);
  });
});
