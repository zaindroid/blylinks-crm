const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

async function approveSale(adminToken, agentToken, campaignId, amount) {
  const sale = await request(app).post('/api/sales').set('Authorization', `Bearer ${agentToken}`)
    .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount });
  await request(app).patch(`/api/sales/${sale.body.id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({});
  return sale.body;
}

describe('automatic payroll generation', () => {
  it('commission = sum(approved sale amounts) x campaign commissionRate%, added to base salary', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 10 });
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 50000 });

    await approveSale(admin.token, agent.token, campaignId, 2500);
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    expect(res.status).toBe(200);
    const row = res.body.find(p => p.agentId === agent.id);
    expect(row.baseSalaryPkr).toBe(50000);
    expect(row.commissionPkr).toBe(250); // 2500 * 10%
    expect(row.netSalaryPkr).toBe(50250);
    expect(row.status).toBe('Pending');
  });

  it('sums commission across multiple approved sales and multiple campaigns at their own rates', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token, { commissionRate: 10 });
    const campaignB = await createCampaign(admin.token, { commissionRate: 20 });
    const agent = await createAgentViaApi(admin.token, [campaignA, campaignB], { baseSalaryPkr: 0 });

    await approveSale(admin.token, agent.token, campaignA, 1000); // 100
    await approveSale(admin.token, agent.token, campaignA, 500);  // 50
    await approveSale(admin.token, agent.token, campaignB, 1000); // 200
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    const row = res.body.find(p => p.agentId === agent.id);
    expect(row.commissionPkr).toBe(350);
  });

  it('a Pending (unapproved) sale contributes nothing to commission', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 50 });
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 10000 });

    await request(app).post('/api/sales').set('Authorization', `Bearer ${agent.token}`)
      .send({ campaignId, customerName: 'Cust', phone: '5551234567', amount: 9999 }); // left Pending
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    const row = res.body.find(p => p.agentId === agent.id);
    expect(row.commissionPkr).toBe(0);
    expect(row.netSalaryPkr).toBe(10000);
  });

  it('regenerating a month recomputes commission but preserves manually-set bonus/deductions', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 10 });
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 10000 });
    const month = new Date().toISOString().slice(0, 7);

    const first = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    const payrollId = first.body.find(p => p.agentId === agent.id).id;

    await request(app).patch(`/api/payroll/${payrollId}`).set('Authorization', `Bearer ${admin.token}`)
      .send({ bonusPkr: 2000, deductionsPkr: 500 });

    await approveSale(admin.token, agent.token, campaignId, 1000); // adds 100 commission
    const second = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    const row = second.body.find(p => p.agentId === agent.id);

    expect(row.commissionPkr).toBe(100);
    expect(row.bonusPkr).toBe(2000); // preserved
    expect(row.deductionsPkr).toBe(500); // preserved
    expect(row.netSalaryPkr).toBe(10000 + 100 + 2000 - 500);
  });

  it('an Inactive agent is excluded from payroll generation', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token, { commissionRate: 10 });
    const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr: 10000 });
    await request(app).delete(`/api/users/${agent.id}`).set('Authorization', `Bearer ${admin.token}`);
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month });
    expect(res.body.find(p => p.agentId === agent.id)).toBeUndefined();
  });

  it('rejects a malformed month', async () => {
    const admin = await createAdmin();
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${admin.token}`).send({ month: 'August 2026' });
    expect(res.status).toBe(400);
  });

  it('only Admin can generate or adjust payroll', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${agent.token}`).send({ month: '2026-08' });
    expect(res.status).toBe(403);
  });
});
