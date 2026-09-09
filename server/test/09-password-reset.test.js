const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

describe('admin/supervisor-mediated password reset', () => {
  it('Admin can reset any user\'s password; the temp password works and the account is flagged mustChangePassword', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).patch(`/api/users/${agent.id}/reset-password`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeDefined();
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(8);

    const oldLogin = await request(app).post('/api/auth/login').send({ username: agent.username, password: agent.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ username: agent.username, password: res.body.tempPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it('a flagged account is blocked from every other endpoint until the password is actually changed', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const reset = await request(app).patch(`/api/users/${agent.id}/reset-password`).set('Authorization', `Bearer ${admin.token}`);
    const tempToken = await loginToken(agent.username, reset.body.tempPassword);

    const blocked = await request(app).get('/api/sales').set('Authorization', `Bearer ${tempToken}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.mustChangePassword).toBe(true);

    const changeRes = await request(app).patch('/api/auth/change-password').set('Authorization', `Bearer ${tempToken}`)
      .send({ currentPassword: reset.body.tempPassword, newPassword: 'brandnewpass123' });
    expect(changeRes.status).toBe(200);

    const unblocked = await request(app).get('/api/sales').set('Authorization', `Bearer ${tempToken}`);
    expect(unblocked.status).toBe(200);
  });

  it('a Supervisor can reset an Agent within their campaign scope, but not one outside it', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('reset_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const inScopeAgent = await createAgentViaApi(admin.token, [campaignA]);
    const outsideAgent = await createAgentViaApi(admin.token, [campaignB]);

    const ok = await request(app).patch(`/api/users/${inScopeAgent.id}/reset-password`).set('Authorization', `Bearer ${supToken}`);
    expect(ok.status).toBe(200);

    const denied = await request(app).patch(`/api/users/${outsideAgent.id}/reset-password`).set('Authorization', `Bearer ${supToken}`);
    expect(denied.status).toBe(403);
  });

  it('a Supervisor cannot reset another Supervisor or an Admin', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('reset_sup2') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const otherSup = await insertUser({ role: 'Supervisor', username: uid('other_reset_sup') });

    const res = await request(app).patch(`/api/users/${otherSup.id}/reset-password`).set('Authorization', `Bearer ${supToken}`);
    expect(res.status).toBe(403);
  });

  it('an Agent cannot reset anyone\'s password', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).patch(`/api/users/${agentB.id}/reset-password`).set('Authorization', `Bearer ${agentA.token}`);
    expect(res.status).toBe(403);
  });

  it('cannot reset your own password through this endpoint', async () => {
    const admin = await createAdmin();
    const res = await request(app).patch(`/api/users/${admin.id}/reset-password`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });
});
