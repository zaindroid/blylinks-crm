const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// A literal "5551234567"-style placeholder is reused as the default phone number across dozens of
// other test files sharing this same Postgres instance, so searching for one here would match
// whatever every other file happened to insert too. Each call returns a fresh, 10-digit number
// that is unique for the whole suite run, so a match can only ever be the row this test created.
let phoneCounter = 0;
function uniquePhone() {
  phoneCounter += 1;
  return `555${String(Date.now()).slice(-4)}${String(phoneCounter).padStart(3, '0')}`;
}

describe('GET /api/check-lead -- cross-campaign phone lookup', () => {
  it('finds a sale by phone, with a differently-formatted search still matching (normalized to last 10 digits)', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const phone = uniquePhone();
    const formatted = `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    const sale = await request(app).post('/api/sales').set(auth(agent.token))
      .send({ campaignId, customerName: 'Jane Doe', phone, amount: 100 });
    expect(sale.status).toBe(201);

    const res = await request(app).get('/api/check-lead?phone=' + encodeURIComponent(`+1 (${formatted.slice(0, 3)}) ${formatted.slice(4)}`)).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.sales).toHaveLength(1);
    expect(res.body.sales[0].id).toBe(sale.body.id);
    expect(res.body.sales[0].customerName).toBe('Jane Doe');
    expect(res.body.leads).toEqual([]);
    expect(res.body.callbacks).toEqual([]);
  });

  it('also matches on phone2', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const phone2 = uniquePhone();
    const sale = await request(app).post('/api/sales').set(auth(agent.token))
      .send({ campaignId, customerName: 'Jane Doe', phone: uniquePhone(), phone2, amount: 100 });

    const res = await request(app).get(`/api/check-lead?phone=${phone2}`).set(auth(admin.token));
    expect(res.body.sales.map(s => s.id)).toContain(sale.body.id);
  });

  it('finds a lead and a callback for the same number, across campaigns', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token, { name: 'Campaign A' });
    const campaignB = await createCampaign(admin.token, { name: 'Campaign B' });
    const agentA = await createAgentViaApi(admin.token, [campaignA]);
    const agentB = await createAgentViaApi(admin.token, [campaignB]);
    const phone = uniquePhone();

    const lead = await request(app).post('/api/leads').set(auth(admin.token))
      .send({ campaignId: campaignA, name: 'Lead Person', phone, assignedAgentId: agentA.id });
    const callback = await request(app).post('/api/callbacks').set(auth(agentB.token))
      .send({ campaignId: campaignB, customerName: 'Lead Person', phone });

    const res = await request(app).get(`/api/check-lead?phone=${phone}`).set(auth(admin.token));
    expect(res.body.leads.map(l => l.id)).toContain(lead.body.id);
    expect(res.body.callbacks.map(c => c.id)).toContain(callback.body.id);
  });

  it('is visible to any role, with no campaign scoping -- an Agent on an unrelated campaign still sees it', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token, { name: 'Campaign A' });
    const campaignB = await createCampaign(admin.token, { name: 'Campaign B' });
    const agentA = await createAgentViaApi(admin.token, [campaignA]);
    const agentB = await createAgentViaApi(admin.token, [campaignB]); // never touches campaign A
    const phone = uniquePhone();

    const sale = await request(app).post('/api/sales').set(auth(agentA.token))
      .send({ campaignId: campaignA, customerName: 'Jane Doe', phone, amount: 100 });

    const res = await request(app).get(`/api/check-lead?phone=${phone}`).set(auth(agentB.token));
    expect(res.status).toBe(200);
    expect(res.body.sales.map(s => s.id)).toContain(sale.body.id);
  });

  it('returns empty arrays (not 404) for a valid-looking phone with no activity', async () => {
    const admin = await createAdmin();
    const res = await request(app).get(`/api/check-lead?phone=${uniquePhone()}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sales: [], leads: [], callbacks: [] });
  });

  it('400s for a phone that does not look real', async () => {
    const admin = await createAdmin();
    for (const bad of ['123', '', '0000000', undefined]) {
      const query = bad === undefined ? '' : `?phone=${encodeURIComponent(bad)}`;
      const res = await request(app).get(`/api/check-lead${query}`).set(auth(admin.token));
      expect(res.status).toBe(400);
    }
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/check-lead?phone=${uniquePhone()}`);
    expect(res.status).toBe(401);
  });
});
