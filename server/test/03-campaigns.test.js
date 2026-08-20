const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

describe('campaigns', () => {
  it('non-Admin cannot create a campaign', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaign]);
    const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${agent.token}`)
      .send({ id: uid('camp'), name: 'Should Fail' });
    expect(res.status).toBe(403);
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
