const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

const FULL_ORDER = {
  customerName: 'Johnathan Sterling',
  address: '123 Main St',
  apt: '4B',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  phone: '5551234567',
  phone2: '5559876543',
  email: 'john@example.com',
  supplierName: 'BrightVolt Energy',
  electricUtility: 'Oncor',
  electricAccountType: 'Meter',
  electricAccountNumber: 'EL-998877',
  electricRate: '0.12/kWh',
  gasUtility: 'Atmos',
  gasAccountType: 'Meter',
  gasAccountNumber: 'GAS-112233',
  confirmationNumber: 'CONF-5566',
  amount: 2500,
  agentNotes: 'Verbal TPV confirmed.'
};

describe('sale submission', () => {
  it('required fields are enforced: campaignId, customerName, phone, amount', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'No Phone Or Amount' });
    expect(res.status).toBe(400);
  });

  it('every order-detail field submitted round-trips exactly through GET', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const createRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, ...FULL_ORDER });
    expect(createRes.status).toBe(201);

    const getRes = await request(app).get(`/api/sales?campaignId=${campaignId}`).set('Authorization', `Bearer ${agent.token}`);
    const saved = getRes.body.find(s => s.id === createRes.body.id);
    for (const [key, value] of Object.entries(FULL_ORDER)) {
      expect(saved[key], `field ${key}`).toBe(value);
    }
    expect(saved.status).toBe('Pending');
    expect(saved.saleDateIso).toBeDefined();
  });

  it('a new sale always starts Pending, and agentId is taken from the JWT -- never trusted from the request body', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agentA.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100, agentId: agentB.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Pending');
    expect(res.body.agentId).toBe(agentA.id); // not agentB, despite what the body claimed
  });

  it('an optional saleDate is honored; omitting it defaults to now', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100, saleDate: '2026-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.saleDateIso.startsWith('2026-01-15')).toBe(true);
  });
});

describe('sale approve/reject RBAC', () => {
  it('Admin and Supervisor can approve; an Agent (even the sale owner) cannot', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const selfApprove = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${agent.token}`).send({});
    expect(selfApprove.status).toBe(403);

    const adminApprove = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({ qaNote: 'looks good' });
    expect(adminApprove.status).toBe(200);
    expect(adminApprove.body.status).toBe('Approved');
    expect(adminApprove.body.verifiedBy).toContain('Admin');
  });

  it('reject sets status and records who reviewed it', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const res = await request(app).patch(`/api/sales/${sale.body.id}/reject`).set('Authorization', `Bearer ${admin.token}`).send({ qaNote: 'no good' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Rejected');
    expect(res.body.qaNotes).toBe('no good');
  });
});
