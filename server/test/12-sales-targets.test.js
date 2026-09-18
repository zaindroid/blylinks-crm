const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const setTarget = (token, agentId, body) => request(app).patch(`/api/targets/${agentId}`).set(auth(token)).send(body);

async function createSupervisor(admin, campaignIds) {
  const user = await insertUser({ role: 'Supervisor' });
  await request(app).patch(`/api/users/${user.id}/campaigns`).set(auth(admin.token)).send({ campaignIds });
  return { ...user, token: await loginToken(user.username) };
}

describe('individual monthly sales-count targets', () => {
  it('an Admin can set any agent\'s monthly sales target, and it comes back on the target record', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await setTarget(admin.token, agent.id, { monthlySalesTarget: 60 });
    expect(res.status).toBe(200);
    expect(res.body.monthlySalesTarget).toBe(60);

    const list = await request(app).get('/api/targets').set(auth(admin.token));
    expect(list.body.find(t => t.agentId === agent.id).monthlySalesTarget).toBe(60);
  });

  it('it can be changed later without disturbing the PKR figures set alongside it', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await setTarget(admin.token, agent.id, { monthlyTargetPkr: 500000, monthlySalesTarget: 10 });

    const res = await setTarget(admin.token, agent.id, { monthlySalesTarget: 25 });
    expect(res.body.monthlySalesTarget).toBe(25);
    expect(res.body.monthlyTargetPkr).toBe(500000);
  });

  it('the agent can see their own target (it drives their dashboard and celebration) but not anyone else\'s', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    await setTarget(admin.token, agentA.id, { monthlySalesTarget: 40 });
    await setTarget(admin.token, agentB.id, { monthlySalesTarget: 99 });

    const res = await request(app).get('/api/targets').set(auth(agentA.token));
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ agentId: agentA.id, monthlySalesTarget: 40 });
  });

  it('a Supervisor can set the target for an agent who shares one of their campaigns', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const supervisor = await createSupervisor(admin, [campaignId]);

    const res = await setTarget(supervisor.token, agent.id, { monthlySalesTarget: 35 });
    expect(res.status).toBe(200);
    expect(res.body.monthlySalesTarget).toBe(35);
  });

  it('a Supervisor cannot set the target for an agent outside their campaigns', async () => {
    const admin = await createAdmin();
    const mine = await createCampaign(admin.token);
    const theirs = await createCampaign(admin.token);
    const outsider = await createAgentViaApi(admin.token, [theirs]);
    const supervisor = await createSupervisor(admin, [mine]);

    const res = await setTarget(supervisor.token, outsider.id, { monthlySalesTarget: 35 });
    expect(res.status).toBe(403);
    const list = await request(app).get('/api/targets').set(auth(admin.token));
    expect(list.body.find(t => t.agentId === outsider.id)).toBeUndefined();
  });

  it('a Supervisor may not touch the Admin-only PKR figures, even alongside a valid sales target', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const supervisor = await createSupervisor(admin, [campaignId]);

    const res = await setTarget(supervisor.token, agent.id, { monthlySalesTarget: 30, monthlyTargetPkr: 9999999 });
    expect(res.status).toBe(403);
    const list = await request(app).get('/api/targets').set(auth(admin.token));
    expect(list.body.find(t => t.agentId === agent.id)).toBeUndefined(); // nothing was written
  });

  it('an Agent cannot set targets -- not their own, not anyone\'s', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);

    expect((await setTarget(agentA.token, agentA.id, { monthlySalesTarget: 1 })).status).toBe(403);
    expect((await setTarget(agentA.token, agentB.id, { monthlySalesTarget: 1 })).status).toBe(403);
  });

  it('rejects targets that are negative, fractional or not a number', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    for (const bad of [-5, 2.5, 'many', {}]) {
      expect((await setTarget(admin.token, agent.id, { monthlySalesTarget: bad })).status).toBe(400);
    }
  });

  it('only Agents have targets: unknown users are 404, non-agents are 400', async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();
    expect((await setTarget(admin.token, 'usr_does_not_exist', { monthlySalesTarget: 5 })).status).toBe(404);
    expect((await setTarget(admin.token, otherAdmin.id, { monthlySalesTarget: 5 })).status).toBe(400);
  });

  it('zero is a valid target (it means "none set")', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await setTarget(admin.token, agent.id, { monthlySalesTarget: 20 });
    const res = await setTarget(admin.token, agent.id, { monthlySalesTarget: 0 });
    expect(res.status).toBe(200);
    expect(res.body.monthlySalesTarget).toBe(0);
  });
});
