const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

const asUser = (token) => ({ Authorization: `Bearer ${token}` });
// POST /api/campaigns is Admin-only, so a 201 vs 403 is a clean probe of "is this session an Admin right now".
const tryAdminAction = (token) =>
  request(app).post('/api/campaigns').set(asUser(token)).send({ id: uid('camp'), name: 'Probe', client: 'C', category: 'Energy' });

describe('admin role changes', () => {
  it('promotes a user and the change applies to their existing session immediately (no re-login)', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    expect((await tryAdminAction(agent.token)).status).toBe(403);

    const res = await request(app).patch(`/api/users/${agent.id}/role`).set(asUser(admin.token)).send({ role: 'Admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('Admin');
    expect(res.body.designation).toBe('Administrator');

    expect((await tryAdminAction(agent.token)).status).toBe(201); // same token, new privileges
  });

  it('demotion strips privileges immediately from the still-valid session', async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    expect((await tryAdminAction(other.token)).status).toBe(201);

    const res = await request(app).patch(`/api/users/${other.id}/role`).set(asUser(admin.token)).send({ role: 'Agent' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('Agent');

    expect((await tryAdminAction(other.token)).status).toBe(403);
  });

  it('the new role is what the user list reports', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    await request(app).patch(`/api/users/${agent.id}/role`).set(asUser(admin.token)).send({ role: 'Supervisor' });

    const list = await request(app).get('/api/users').set(asUser(admin.token));
    expect(list.body.find(u => u.id === agent.id).role).toBe('Supervisor');
  });

  it('only Admins can change roles -- Supervisors and Agents get 403, and nothing changes', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const supervisorUser = await insertUser({ role: 'Supervisor' });
    const supervisorToken = await loginToken(supervisorUser.username);

    for (const token of [agent.token, supervisorToken]) {
      const res = await request(app).patch(`/api/users/${agent.id}/role`).set(asUser(token)).send({ role: 'Admin' });
      expect(res.status).toBe(403);
    }
    expect((await tryAdminAction(agent.token)).status).toBe(403);
  });

  it('an Admin cannot change their own role', async () => {
    const admin = await createAdmin();
    const res = await request(app).patch(`/api/users/${admin.id}/role`).set(asUser(admin.token)).send({ role: 'Agent' });
    expect(res.status).toBe(400);
    expect((await tryAdminAction(admin.token)).status).toBe(201); // still an Admin
  });

  it('rejects unknown roles (including prototype-key tricks) and unknown users', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    for (const role of ['Superuser', '', undefined, 'constructor', '__proto__', 'admin']) {
      const res = await request(app).patch(`/api/users/${agent.id}/role`).set(asUser(admin.token)).send({ role });
      expect(res.status).toBe(400);
    }
    const missing = await request(app).patch('/api/users/usr_does_not_exist/role').set(asUser(admin.token)).send({ role: 'Agent' });
    expect(missing.status).toBe(404);
  });
});
