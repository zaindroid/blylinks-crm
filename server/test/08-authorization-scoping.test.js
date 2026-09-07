const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

// Row-level authorization audit: an Agent must never be able to see or touch
// another user's data, regardless of what the frontend currently displays.
// Each of these previously had no scoping at all -- any authenticated Agent
// could browse or mutate the whole team's records via the API directly.

describe('GET /api/users redacts sensitive fields for coworkers', () => {
  it('an Agent sees their own cnic/phone/baseSalaryPkr but not another Agent\'s', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 50000 });
    const agentB = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 60000 });
    await request(app).patch(`/api/users/${agentA.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignId] });

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${agentA.token}`);
    const self = list.body.find(u => u.id === agentA.id);
    const other = list.body.find(u => u.id === agentB.id);
    expect(self.baseSalaryPkr).toBe(50000);
    expect(other.baseSalaryPkr).toBe(0);
    expect(other.cnic).toBeNull();
    expect(other.phone).toBeNull();
    // Non-sensitive fields (needed for the directory/DM picker/leaderboard) stay visible.
    expect(other.name).toBeDefined();
    expect(other.role).toBe('Agent');
  });

  it('Admin sees everyone\'s full detail', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 45000 });

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.find(u => u.id === agent.id).baseSalaryPkr).toBe(45000);
  });

  it('a Supervisor sees full detail for an Agent within their own campaign scope', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('vis_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignId] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 42000 });

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${supToken}`);
    expect(list.body.find(u => u.id === agent.id).baseSalaryPkr).toBe(42000);
  });

  it('a Supervisor does NOT see full detail for an Agent outside their campaign scope', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('vis_sup2') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const outsideAgent = await createAgentViaApi(admin.token, [campaignB], { baseSalaryPkr: 42000 });

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${supToken}`);
    expect(list.body.find(u => u.id === outsideAgent.id).baseSalaryPkr).toBe(0);
  });
});

describe('GET /api/sales is scoped per role', () => {
  it('an Agent only sees their own sales, never another agent\'s customer data', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agentA.token}`)
      .send({ campaignId, customerName: 'A Customer', phone: '5551110000', amount: 100 });
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agentB.token}`)
      .send({ campaignId, customerName: 'B Customer', phone: '5552220000', amount: 200 });

    const res = await request(app).get('/api/sales').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(s => s.agentId === agentA.id)).toBe(true);
    expect(res.body.some(s => s.customerName === 'B Customer')).toBe(false);
  });

  it('Admin sees sales from every agent', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const res = await request(app).get('/api/sales').set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.some(s => s.agentId === agent.id)).toBe(true);
  });

  it('a Supervisor cannot approve a sale outside their own campaign scope', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('sale_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const outsideAgent = await createAgentViaApi(admin.token, [campaignB]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${outsideAgent.token}`)
      .send({ campaignId: campaignB, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const res = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${supToken}`).send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/payroll is scoped per role', () => {
  it('an Agent only sees their own payroll record', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 10 });
    const agentA = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 30000 });
    const agentB = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 40000 });
    const month = new Date().toISOString().slice(0, 7);
    await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });

    const res = await request(app).get('/api/payroll').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(p => p.agentId === agentA.id)).toBe(true);
    expect(res.body.some(p => p.agentId === agentB.id)).toBe(false);
  });
});

describe('GET /api/attendance and /api/targets are scoped per role', () => {
  it('an Agent only sees their own attendance history', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/attendance/clock-in').set('Authorization', `Bearer ${agentA.token}`);
    await request(app).post('/api/attendance/clock-in').set('Authorization', `Bearer ${agentB.token}`);

    const res = await request(app).get('/api/attendance').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(a => a.agentId === agentA.id)).toBe(true);
  });

  it('an Agent only sees their own targets', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).patch(`/api/targets/${agentA.id}`).set('Authorization', `Bearer ${admin.token}`).send({ dailyTargetPkr: 1000 });
    await request(app).patch(`/api/targets/${agentB.id}`).set('Authorization', `Bearer ${admin.token}`).send({ dailyTargetPkr: 2000 });

    const res = await request(app).get('/api/targets').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(t => t.agentId === agentA.id)).toBe(true);
  });
});

describe('callbacks: scoped visibility and ownership on completion', () => {
  it('an Agent only sees callbacks assigned to them', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/callbacks').set('Authorization', `Bearer ${agentA.token}`)
      .send({ campaignId, customerName: 'A Cust', phone: '5551110000' });
    await request(app).post('/api/callbacks').set('Authorization', `Bearer ${agentB.token}`)
      .send({ campaignId, customerName: 'B Cust', phone: '5552220000' });

    const res = await request(app).get('/api/callbacks').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(cb => cb.agentId === agentA.id)).toBe(true);
  });

  it('an Agent cannot complete a callback assigned to someone else', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    const cb = await request(app).post('/api/callbacks').set('Authorization', `Bearer ${agentA.token}`)
      .send({ campaignId, customerName: 'A Cust', phone: '5551110000' });

    const res = await request(app).patch(`/api/callbacks/${cb.body.id}/complete`).set('Authorization', `Bearer ${agentB.token}`);
    expect(res.status).toBe(403);

    const ownComplete = await request(app).patch(`/api/callbacks/${cb.body.id}/complete`).set('Authorization', `Bearer ${agentA.token}`);
    expect(ownComplete.status).toBe(200);
  });
});

describe('leads: scoped visibility and ownership on status updates', () => {
  it('an Agent only sees leads assigned to them', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/leads').set('Authorization', `Bearer ${admin.token}`)
      .send({ campaignId, name: 'Lead A', phone: '5551110000', assignedAgentId: agentA.id });
    await request(app).post('/api/leads').set('Authorization', `Bearer ${admin.token}`)
      .send({ campaignId, name: 'Lead B', phone: '5552220000', assignedAgentId: agentB.id });

    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(l => l.assignedAgentId === agentA.id)).toBe(true);
  });

  it('an Agent cannot update the status of a lead assigned to someone else', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    const lead = await request(app).post('/api/leads').set('Authorization', `Bearer ${admin.token}`)
      .send({ campaignId, name: 'Lead A', phone: '5551110000', assignedAgentId: agentA.id });

    const res = await request(app).patch(`/api/leads/${lead.body.id}/status`).set('Authorization', `Bearer ${agentB.token}`).send({ status: 'Contacted' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/tickets is scoped per role', () => {
  it('an Agent only sees their own submitted tickets', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${agentA.token}`).send({ subject: 'A issue' });
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${agentB.token}`).send({ subject: 'B issue' });

    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.body.every(t => t.agentId === agentA.id)).toBe(true);
  });
});

describe('GET /api/campaigns is scoped per role', () => {
  it('an Agent only sees campaigns they are assigned to', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token, { name: 'Visible Campaign' });
    const campaignB = await createCampaign(admin.token, { name: 'Hidden Campaign' });
    const agent = await createAgentViaApi(admin.token, [campaignA]);

    const res = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${agent.token}`);
    const ids = res.body.map(c => c.id);
    expect(ids).toContain(campaignA);
    expect(ids).not.toContain(campaignB);
  });

  it('Admin sees every campaign regardless of assignment', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);

    const res = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    const ids = res.body.map(c => c.id);
    expect(ids).toContain(campaignA);
    expect(ids).toContain(campaignB);
  });
});
