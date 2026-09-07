const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

describe('user creation RBAC', () => {
  let admin, campaignA, campaignB;

  beforeAll(async () => {
    admin = await createAdmin();
    campaignA = await createCampaign(admin.token, { name: 'Campaign A' });
    campaignB = await createCampaign(admin.token, { name: 'Campaign B' });
  });

  it('Admin can create a user of any role, in any campaign', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'New Supervisor', username: uid('sup'), password: 'pass12345', role: 'Supervisor', campaignIds: [campaignA] });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('Supervisor');
    expect(res.body.allowedCampaignIds).toEqual([campaignA]);
  });

  it('a duplicate username is rejected with 409', async () => {
    const username = uid('dupe');
    await request(app).post('/api/users').set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'First', username, password: 'pass12345', role: 'Agent', campaignIds: [] });
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Second', username, password: 'pass12345', role: 'Agent', campaignIds: [] });
    expect(res.status).toBe(409);
  });

  it('an Agent cannot create any user', async () => {
    const agent = await createAgentViaApi(admin.token, [campaignA]);
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${agent.token}`)
      .send({ name: 'Sneaky', username: uid('sneaky'), password: 'pass12345', role: 'Agent', campaignIds: [] });
    expect(res.status).toBe(403);
  });

  describe('Supervisor scoping', () => {
    let supervisor;

    beforeAll(async () => {
      const supUser = await insertUser({ role: 'Supervisor', username: uid('sup_scope') });
      await request(app).patch(`/api/users/${supUser.id}/campaigns`)
        .set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
      supervisor = { ...supUser, token: await loginToken(supUser.username, supUser.password) };
    });

    it('is forced to Agent role even if it tries to request Admin', async () => {
      const res = await request(app).post('/api/users').set('Authorization', `Bearer ${supervisor.token}`)
        .send({ name: 'Escalation Attempt', username: uid('esc'), password: 'pass12345', role: 'Admin', campaignIds: [campaignA] });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('Agent');
    });

    it('can grant access to a campaign it has itself', async () => {
      const res = await request(app).post('/api/users').set('Authorization', `Bearer ${supervisor.token}`)
        .send({ name: 'In Scope Agent', username: uid('inscope'), password: 'pass12345', role: 'Agent', campaignIds: [campaignA] });
      expect(res.status).toBe(201);
      expect(res.body.allowedCampaignIds).toEqual([campaignA]);
    });

    it('is rejected when trying to grant access to a campaign it does not have', async () => {
      const res = await request(app).post('/api/users').set('Authorization', `Bearer ${supervisor.token}`)
        .send({ name: 'Out Of Scope', username: uid('outscope'), password: 'pass12345', role: 'Agent', campaignIds: [campaignB] });
      expect(res.status).toBe(403);
    });
  });
});

describe('user deletion (soft-delete) RBAC', () => {
  let admin, campaignA, campaignB;

  beforeAll(async () => {
    admin = await createAdmin();
    campaignA = await createCampaign(admin.token, { name: 'Del Campaign A' });
    campaignB = await createCampaign(admin.token, { name: 'Del Campaign B' });
  });

  it('Admin cannot remove their own account', async () => {
    const res = await request(app).delete(`/api/users/${admin.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('Admin can deactivate anyone, which soft-deletes (status flips, row is not destroyed)', async () => {
    const agent = await createAgentViaApi(admin.token, [campaignA]);
    const res = await request(app).delete(`/api/users/${agent.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${admin.token}`);
    const found = list.body.find(u => u.id === agent.id);
    expect(found).toBeDefined(); // still present, not hard-deleted
    expect(found.status).toBe('Inactive');
  });

  it('security: deactivating a user immediately revokes their still-unexpired token -- not just at next login', async () => {
    const agent = await createAgentViaApi(admin.token, [campaignA]);
    // Prove the token genuinely works before deactivation.
    const before = await request(app).get('/api/users').set('Authorization', `Bearer ${agent.token}`);
    expect(before.status).toBe(200);

    await request(app).delete(`/api/users/${agent.id}`).set('Authorization', `Bearer ${admin.token}`);

    // Same token, never re-issued, still cryptographically valid and unexpired --
    // must be rejected purely because the account is no longer Active.
    const after = await request(app).get('/api/users').set('Authorization', `Bearer ${agent.token}`);
    expect(after.status).toBe(401);
  });

  it('Supervisor can remove an Agent that shares their campaign access', async () => {
    const supUser = await insertUser({ role: 'Supervisor', username: uid('del_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const agent = await createAgentViaApi(admin.token, [campaignA]);

    const res = await request(app).delete(`/api/users/${agent.id}`).set('Authorization', `Bearer ${supToken}`);
    expect(res.status).toBe(200);
  });

  it('Supervisor cannot remove an Agent outside their campaign scope', async () => {
    const supUser = await insertUser({ role: 'Supervisor', username: uid('del_sup2') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const outsideAgent = await createAgentViaApi(admin.token, [campaignB]);

    const res = await request(app).delete(`/api/users/${outsideAgent.id}`).set('Authorization', `Bearer ${supToken}`);
    expect(res.status).toBe(403);
  });

  it('Supervisor cannot remove another Supervisor or an Admin', async () => {
    const supUser = await insertUser({ role: 'Supervisor', username: uid('del_sup3') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const otherSup = await insertUser({ role: 'Supervisor', username: uid('other_sup') });

    const res = await request(app).delete(`/api/users/${otherSup.id}`).set('Authorization', `Bearer ${supToken}`);
    expect(res.status).toBe(403);
  });
});

describe('base salary (Admin only)', () => {
  it('Admin can set a base salary at creation time and edit it later', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaign], { baseSalaryPkr: 40000 });
    expect(agent.baseSalaryPkr).toBe(40000);

    const patchRes = await request(app).patch(`/api/users/${agent.id}/base-salary`)
      .set('Authorization', `Bearer ${admin.token}`).send({ baseSalaryPkr: 55000 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.baseSalaryPkr).toBe(55000);
  });

  it('a Supervisor cannot set base salary', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('sal_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaign] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const agent = await createAgentViaApi(admin.token, [campaign]);

    const res = await request(app).patch(`/api/users/${agent.id}/base-salary`)
      .set('Authorization', `Bearer ${supToken}`).send({ baseSalaryPkr: 99999 });
    expect(res.status).toBe(403);
  });

  it('rejects a non-numeric baseSalaryPkr', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaign]);
    const res = await request(app).patch(`/api/users/${agent.id}/base-salary`)
      .set('Authorization', `Bearer ${admin.token}`).send({ baseSalaryPkr: 'not a number' });
    expect(res.status).toBe(400);
  });
});
