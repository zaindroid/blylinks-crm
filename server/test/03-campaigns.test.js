const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

async function createSupervisor(admin, campaignIds) {
  const user = await insertUser({ role: 'Supervisor' });
  await request(app).patch(`/api/users/${user.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds });
  return { ...user, token: await loginToken(user.username) };
}

describe('campaigns', () => {
  it('non-Admin cannot create a campaign', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaign]);
    const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${agent.token}`)
      .send({ id: uid('camp'), name: 'Should Fail' });
    expect(res.status).toBe(403);
  });

  it('a campaign is created with a sales-count goal and no commission rate', async () => {
    const admin = await createAdmin();
    const id = uid('camp');
    const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${admin.token}`)
      .send({ id, name: 'Goal Campaign', client: 'C', category: 'Energy', monthlySalesGoal: 150 });
    expect(res.status).toBe(201);
    const created = res.body.find(c => c.id === id);
    expect(created.monthlySalesGoal).toBe(150);
    expect(created.commissionRate).toBe(0);
  });

  it('the sales goal defaults to 0 when omitted, and can be updated later without touching other fields', async () => {
    const admin = await createAdmin();
    const id = uid('camp');
    await request(app).post('/api/campaigns').set('Authorization', `Bearer ${admin.token}`)
      .send({ id, name: 'No Goal Yet', client: 'C', category: 'Energy' });

    const res = await request(app).patch(`/api/campaigns/${id}`).set('Authorization', `Bearer ${admin.token}`)
      .send({ monthlySalesGoal: 40 });
    expect(res.status).toBe(200);
    const updated = res.body.find(c => c.id === id);
    expect(updated.monthlySalesGoal).toBe(40);
    expect(updated.name).toBe('No Goal Yet');
  });

  it('rejects a sales goal that is negative, fractional or not a number', async () => {
    const admin = await createAdmin();
    for (const bad of [-1, 2.5, 'lots']) {
      const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${admin.token}`)
        .send({ id: uid('camp'), name: 'Bad Goal', monthlySalesGoal: bad });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a campaign with no id/name', async () => {
    const admin = await createAdmin();
    const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${admin.token}`).send({});
    expect(res.status).toBe(400);
  });

  it('revenue and sales count are computed from Approved sales only, never from Pending/Rejected', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 10 });
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    async function submitSale(amount) {
      const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
        .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount });
      return res.body.id;
    }

    const approvedId = await submitSale(1000);
    await submitSale(500); // left Pending
    const rejectedId = await submitSale(2000);

    await request(app).patch(`/api/sales/${approvedId}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});
    await request(app).patch(`/api/sales/${rejectedId}/reject`).set('Authorization', `Bearer ${admin.token}`).send({});

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    const found = list.body.find(c => c.id === campaignId);
    expect(found.totalSalesCount).toBe(1);
    expect(found.totalRevenuePkr).toBe(1000);
  });

  it('toggle-status flips Active/Inactive and back', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const first = await request(app).patch(`/api/campaigns/${campaignId}/toggle-status`).set('Authorization', `Bearer ${admin.token}`);
    expect(first.body.find(c => c.id === campaignId).status).toBe('Inactive');
    const second = await request(app).patch(`/api/campaigns/${campaignId}/toggle-status`).set('Authorization', `Bearer ${admin.token}`);
    expect(second.body.find(c => c.id === campaignId).status).toBe('Active');
  });
});

describe('monthly sales count (what the monthly sales goal is measured against)', () => {
  const submit = (token, campaignId, extra = {}) =>
    request(app).post('/api/sales').set('Authorization', `Bearer ${token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', ...extra });

  it('counts this month\'s Pending and Approved sales, but not last month\'s or Rejected ones', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { monthlySalesGoal: 20 });
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const kept = await submit(agent.token, campaignId);
    const approved = await submit(agent.token, campaignId);
    const rejected = await submit(agent.token, campaignId);
    await submit(agent.token, campaignId, { saleDate: '2020-01-15' }); // long ago -- not this month
    await request(app).patch(`/api/sales/${approved.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});
    await request(app).patch(`/api/sales/${rejected.body.id}/reject`).set('Authorization', `Bearer ${admin.token}`).send({});
    expect(kept.status).toBe(201);

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    const camp = list.body.find(c => c.id === campaignId);
    expect(camp.monthSalesCount).toBe(2); // the pending one + the approved one
    expect(camp.monthlySalesGoal).toBe(20);
  });

  it('an assigned agent sees the count for their own campaign (it drives their celebration tracker)', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { monthlySalesGoal: 5 });
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await submit(agent.token, campaignId);

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${agent.token}`);
    expect(list.body.find(c => c.id === campaignId).monthSalesCount).toBe(1);
  });
});

describe('Supervisor campaign management (own campaigns only)', () => {
  it('a Supervisor can edit the details of a campaign they have access to', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { name: 'Original Name' });
    const supervisor = await createSupervisor(admin, [campaignId]);

    const res = await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ name: 'Renamed by Supervisor', monthlySalesGoal: 75 });
    expect(res.status).toBe(200);
    const updated = res.body.find(c => c.id === campaignId);
    expect(updated.name).toBe('Renamed by Supervisor');
    expect(updated.monthlySalesGoal).toBe(75);
  });

  it('a Supervisor cannot edit a campaign outside their access', async () => {
    const admin = await createAdmin();
    const mine = await createCampaign(admin.token);
    const theirs = await createCampaign(admin.token, { name: 'Not Mine' });
    const supervisor = await createSupervisor(admin, [mine]);

    const res = await request(app).patch(`/api/campaigns/${theirs}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.find(c => c.id === theirs).name).toBe('Not Mine'); // untouched
  });

  it('a Supervisor can assign an agent who shares their own campaign access', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supervisor = await createSupervisor(admin, [campaignId]);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ assignedAgentIds: [agent.id] });
    expect(res.status).toBe(200);
    expect(res.body.find(c => c.id === campaignId).assignedAgentIds).toEqual([agent.id]);
  });

  it('a Supervisor cannot assign an agent outside their own campaign scope', async () => {
    const admin = await createAdmin();
    const mine = await createCampaign(admin.token);
    const elsewhere = await createCampaign(admin.token);
    const supervisor = await createSupervisor(admin, [mine]);
    const outsideAgent = await createAgentViaApi(admin.token, [elsewhere]);

    const res = await request(app).patch(`/api/campaigns/${mine}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ assignedAgentIds: [outsideAgent.id] });
    expect(res.status).toBe(403);

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.find(c => c.id === mine).assignedAgentIds).toEqual([]); // nothing changed
  });

  it('reassigning agents never removes the Supervisor\'s own access to the campaign they just edited', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supervisor = await createSupervisor(admin, [campaignId]);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);

    // Reassign away from agentA to agentB -- a naive "wipe every access row for this campaign,
    // then re-insert only the submitted agent ids" would also delete the Supervisor's own row,
    // since assignedAgentIds only ever lists agents.
    await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ assignedAgentIds: [agentB.id] });

    const stillVisible = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${supervisor.token}`);
    expect(stillVisible.body.some(c => c.id === campaignId)).toBe(true);

    // And can keep editing it afterward -- proof they were not locked out.
    const again = await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${supervisor.token}`)
      .send({ name: 'Still mine' });
    expect(again.status).toBe(200);
  });

  it('cannot smuggle a non-Agent (e.g. another Admin) into assignedAgentIds', async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();
    const campaignId = await createCampaign(admin.token);

    const res = await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedAgentIds: [otherAdmin.id] });
    expect(res.status).toBe(200);
    expect(res.body.find(c => c.id === campaignId).assignedAgentIds).toEqual([]); // silently dropped, not inserted
  });

  it('a Supervisor still cannot create a campaign or toggle Active/Inactive', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supervisor = await createSupervisor(admin, [campaignId]);

    const create = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${supervisor.token}`)
      .send({ id: uid('camp'), name: 'Should Fail' });
    expect(create.status).toBe(403);

    const toggle = await request(app).patch(`/api/campaigns/${campaignId}/toggle-status`).set('Authorization', `Bearer ${supervisor.token}`);
    expect(toggle.status).toBe(403);
  });

  it('an Agent cannot edit a campaign at all', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).patch(`/api/campaigns/${campaignId}`).set('Authorization', `Bearer ${agent.token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });
});

describe('assignedAgentIds only ever lists Agents', () => {
  it('never includes a Supervisor\'s own management-access row, even though it lives in the same table', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supervisor = await createSupervisor(admin, [campaignId]); // grants the supervisor a campaign_access row
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const list = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.find(c => c.id === campaignId).assignedAgentIds).toEqual([agent.id]);
    void supervisor;
  });
});
