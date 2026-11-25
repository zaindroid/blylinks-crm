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
  agentNotes: 'Verbal TPV confirmed.',
  closerName: 'Hammad Arshad',
  saleType: 'Electric and Gas'
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

  it('rejects a saleType outside Electric / Gas / Electric and Gas', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', saleType: 'Water' });
    expect(res.status).toBe(400);
  });

  it('saleType is optional -- a legacy-style submission without it is still accepted', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567' });
    expect(res.status).toBe(201);
    expect(res.body.saleType).toBeNull();
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

describe('submitting a sale auto-adds the phone to that campaign\'s DNC list', () => {
  let phoneCounter = 0;
  function uniquePhone() {
    phoneCounter += 1;
    return `555${String(Date.now()).slice(-4)}${String(phoneCounter).padStart(3, '0')}`;
  }
  const dncCheck = (token, campaignId, phone) =>
    request(app).post('/api/dnc/check').set('Authorization', `Bearer ${token}`).send({ campaignId, phone });

  it('the submitted phone is found on that campaign\'s DNC list afterward', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const phone = uniquePhone();

    const before = await dncCheck(agent.token, campaignId, phone);
    expect(before.body.found).toBe(false);

    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone, amount: 100 });
    expect(sale.status).toBe(201);

    const after = await dncCheck(agent.token, campaignId, phone);
    expect(after.body.found).toBe(true);
  });

  it('is scoped to the sale\'s own campaign only -- a different campaign\'s list is untouched', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignA, campaignB]);
    const phone = uniquePhone();

    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId: campaignA, customerName: 'Cust', phone, amount: 100 });

    expect((await dncCheck(agent.token, campaignA, phone)).body.found).toBe(true);
    expect((await dncCheck(agent.token, campaignB, phone)).body.found).toBe(false);
  });

  it('a phone that is already on the list does not block the sale (idempotent, no conflict error)', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const phone = uniquePhone();

    const first = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'First Cust', phone, amount: 100 });
    expect(first.status).toBe(201);

    // Same phone, a second sale (e.g. a repeat caller/duplicate attempt) -- must not 500 or 409.
    const second = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Second Cust', phone, amount: 50 });
    expect(second.status).toBe(201);

    expect((await dncCheck(agent.token, campaignId, phone)).body.found).toBe(true);
  });

  it('a phone that does not look like a real number does not crash the sale, and nothing is added to DNC', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '11111', amount: 100 });
    expect(sale.status).toBe(201);

    // /dnc/check itself rejects a phone this malformed (400), so list-and-search as Admin instead.
    const list = await request(app).get(`/api/dnc?campaignId=${campaignId}&q=11111`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.total).toBe(0);
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

    const badSaleType = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${admin.token}`).send({ saleType: 'Water' });
    expect(badSaleType.status).toBe(400);
  });

  it('an Admin can correct the Sale Type', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100, saleType: 'Electric' });

    const edit = await request(app).patch(`/api/sales/${sale.body.id}`).set('Authorization', `Bearer ${admin.token}`)
      .send({ saleType: 'Electric and Gas' });
    expect(edit.status).toBe(200);
    expect(edit.body.saleType).toBe('Electric and Gas');
  });

  it('404s for a sale that does not exist', async () => {
    const admin = await createAdmin();
    // Real sale ids are always SALE-1000..SALE-9999 (Math.floor(1000 + Math.random() * 9000) in the
    // POST route), so a 4-digit id in that exact range risks colliding with one some other test in
    // the shared suite run happened to generate. SALE-0001 is outside that range -- never real.
    const res = await request(app).patch('/api/sales/SALE-0001').set('Authorization', `Bearer ${admin.token}`).send({ customerName: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/sales/leaderboard', () => {
  it('ranks by number of sales SUBMITTED (every status counts), not approved count or dollar amount -- with no customer PII', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);

    // Agent A: 2 sales submitted, both Approved (high revenue, fewer submissions).
    for (let i = 0; i < 2; i++) {
      const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agentA.token}`)
        .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 1000 });
      await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});
    }
    // Agent B: 3 sales submitted -- 1 Approved, 1 Pending, 1 Rejected (low revenue, more submissions).
    const saleB1 = await request(app).post('/api/sales').set('Authorization', `Bearer ${agentB.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 50 });
    await request(app).patch(`/api/sales/${saleB1.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agentB.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 50 }); // Pending -- still counts as submitted
    const saleB3 = await request(app).post('/api/sales').set('Authorization', `Bearer ${agentB.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 50 });
    await request(app).patch(`/api/sales/${saleB3.body.id}/reject`).set('Authorization', `Bearer ${admin.token}`).send({}); // Rejected -- still counts as submitted

    // The Agent token itself proves "every role" -- an Agent can only ever GET their own sales,
    // but this endpoint is a different thing entirely and must not 403 them.
    const res = await request(app).get('/api/sales/leaderboard').set('Authorization', `Bearer ${agentA.token}`);
    expect(res.status).toBe(200);

    const rowA = res.body.find(r => r.agentId === agentA.id);
    const rowB = res.body.find(r => r.agentId === agentB.id);
    expect(rowA.submittedCount).toBe(2);
    expect(rowA.monthSubmittedCount).toBe(2);
    expect(rowA.approvedRevenuePkr).toBe(2000);
    expect(rowB.submittedCount).toBe(3);
    expect(rowB.monthSubmittedCount).toBe(3);
    expect(rowB.approvedRevenuePkr).toBe(50);
    // B submitted more (3 vs 2) despite far less approved revenue (50 vs 2000) -- B ranks ahead.
    expect(res.body.indexOf(rowB)).toBeLessThan(res.body.indexOf(rowA));

    // No customer name/phone/address anywhere in the payload -- aggregate counts only.
    expect(JSON.stringify(res.body)).not.toContain('5551234567');
    expect(Object.keys(rowA).sort()).toEqual(['agentId', 'agentName', 'approvedRevenuePkr', 'monthSubmittedCount', 'submittedCount'].sort());
  });

  it('counts an "Electric and Gas" sale as 2 sales, not 1', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100, saleType: 'Electric' }); // 1
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234568', amount: 100, saleType: 'Gas' }); // 1
    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234569', amount: 100, saleType: 'Electric and Gas' }); // 2

    const res = await request(app).get('/api/sales/leaderboard').set('Authorization', `Bearer ${admin.token}`);
    const row = res.body.find(r => r.agentId === agent.id);
    expect(row.submittedCount).toBe(4); // 1 + 1 + 2, not 3 rows
    expect(row.monthSubmittedCount).toBe(4);
  });

  it('excludes a deactivated agent', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 100 });
    await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({});
    await request(app).delete(`/api/users/${agent.id}`).set('Authorization', `Bearer ${admin.token}`);

    const res = await request(app).get('/api/sales/leaderboard').set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.find(r => r.agentId === agent.id)).toBeUndefined();
  });
});
