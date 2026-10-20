const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

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
  it('required fields are enforced: campaignId, customerName, phone', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'No Phone Or Amount' });
    expect(res.status).toBe(400);
  });

  it('amount is optional (agents no longer enter one) and defaults to 0', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'No Amount', phone: '5551234567' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(0);
  });

  it('a supplied amount must still be a non-negative number', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    for (const bad of [-5, 'abc', {}]) {
      const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
        .send({ campaignId, customerName: 'Bad Amount', phone: '5551234567', amount: bad });
      expect(res.status).toBe(400);
    }
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

  it('an Admin can flip an already-Approved sale to Rejected, and back again', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const approved = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({ qaNote: 'good' });
    expect(approved.body.status).toBe('Approved');

    const flippedToRejected = await request(app).patch(`/api/sales/${sale.body.id}/reject`).set('Authorization', `Bearer ${admin.token}`).send({ qaNote: 'actually no' });
    expect(flippedToRejected.status).toBe(200);
    expect(flippedToRejected.body.status).toBe('Rejected');

    const flippedBackToApproved = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({ qaNote: 'reconsidered' });
    expect(flippedBackToApproved.status).toBe(200);
    expect(flippedBackToApproved.body.status).toBe('Approved');
  });

  it('a Supervisor cannot change the status of a sale that is already Approved or Rejected', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('sale_flip_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignId] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const approved = await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${supToken}`).send({});
    expect(approved.body.status).toBe('Approved');

    const flipAttempt = await request(app).patch(`/api/sales/${sale.body.id}/reject`).set('Authorization', `Bearer ${supToken}`).send({});
    expect(flipAttempt.status).toBe(403);

    const stillApproved = await request(app).get(`/api/sales?campaignId=${campaignId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(stillApproved.body.find(s => s.id === sale.body.id).status).toBe('Approved');
  });
});

describe('PATCH /api/sales/:id -- Admin free-form edit', () => {
  it('an Admin can correct customer details and the status on an already-reviewed sale', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Jon Smyth', phone: '5551234567', amount: 100 });
    await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});

    const edit = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${admin.token}`)
      .send({ customerName: 'John Smith', phone: '5559998888', city: 'Austin', status: 'Rejected' });
    expect(edit.status).toBe(200);
    expect(edit.body.customerName).toBe('John Smith');
    expect(edit.body.phone).toBe('5559998888');
    expect(edit.body.city).toBe('Austin');
    expect(edit.body.status).toBe('Rejected');
    expect(edit.body.verifiedBy).toContain('Admin');
  });

  it('a Supervisor cannot use the free-form edit endpoint', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('sale_edit_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignId] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const res = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${supToken}`).send({ customerName: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status or a negative amount', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });

    const badStatus = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'Bogus' });
    expect(badStatus.status).toBe(400);

    const badAmount = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${admin.token}`).send({ amount: -5 });
    expect(badAmount.status).toBe(400);
  });

  it('404s for a sale that does not exist', async () => {
    const admin = await createAdmin();
    const res = await request(app).patch('/api/sales/SALE-9999').set('Authorization', `Bearer ${admin.token}`).send({ customerName: 'X' });
    expect(res.status).toBe(404);
  });
});
