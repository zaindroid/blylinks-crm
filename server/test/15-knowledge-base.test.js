const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const create = (token, body) => request(app).post('/api/kb-articles').set(auth(token)).send(body);

async function world() {
  const admin = await createAdmin();
  const campaign = await createCampaign(admin.token);
  const agent = await createAgentViaApi(admin.token, [campaign]);
  const supervisorUser = await insertUser({ role: 'Supervisor' });
  const supervisor = { ...supervisorUser, token: await loginToken(supervisorUser.username) };
  return { admin, agent, supervisor };
}

describe('knowledge base documents', () => {
  it('an Admin can add a document, and every role can then read it', async () => {
    const { admin, agent } = await world();
    const res = await create(admin.token, { title: 'Objection: too expensive', category: 'Scripts', content: 'Acknowledge, then reframe on value.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Objection: too expensive', category: 'Scripts' });
    expect(res.body.id).toMatch(/^kb_/);
    expect(res.body.updatedAt).toMatch(/^\d{4}-/);

    const list = await request(app).get('/api/kb-articles').set(auth(agent.token));
    expect(list.body.some(a => a.id === res.body.id)).toBe(true);
  });

  it('a Supervisor can add documents too', async () => {
    const { supervisor } = await world();
    expect((await create(supervisor.token, { title: 'Shift handover', content: 'Post a summary in the lounge.' })).status).toBe(201);
  });

  it('an Agent cannot add, edit or delete documents', async () => {
    const { admin, agent } = await world();
    const doc = await create(admin.token, { title: 'Policy', content: 'text' });
    expect((await create(agent.token, { title: 'Sneaky', content: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/api/kb-articles/${doc.body.id}`).set(auth(agent.token)).send({ title: 'Hacked' })).status).toBe(403);
    expect((await request(app).delete(`/api/kb-articles/${doc.body.id}`).set(auth(agent.token))).status).toBe(403);
  });

  it('category defaults to General and a blank summary is derived from the content', async () => {
    const { admin } = await world();
    const short = await create(admin.token, { title: 'Short', content: 'Just one line.' });
    expect(short.body.category).toBe('General');
    expect(short.body.summary).toBe('Just one line.');

    const long = await create(admin.token, { title: 'Long', content: `${'word '.repeat(100)}` });
    expect(long.body.summary.length).toBeLessThanOrEqual(160);
    expect(long.body.summary.endsWith('...')).toBe(true);
  });

  it('title and content are required; over-long fields are refused', async () => {
    const { admin } = await world();
    expect((await create(admin.token, { content: 'no title' })).status).toBe(400);
    expect((await create(admin.token, { title: 'no content' })).status).toBe(400);
    expect((await create(admin.token, { title: '   ', content: 'blank title' })).status).toBe(400);
    expect((await create(admin.token, { title: 'x'.repeat(201), content: 'c' })).status).toBe(400);
    expect((await create(admin.token, { title: 't', content: 'c'.repeat(50001) })).status).toBe(400);
    expect((await create(admin.token, { title: { $ne: 1 }, content: 'c' })).status).toBe(400);
  });

  it('stores markup as plain text -- it is never interpreted server-side', async () => {
    const { admin } = await world();
    const res = await create(admin.token, { title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('<script>alert(1)</script>'); // returned verbatim; the UI renders it as text
  });

  it('editing changes only the supplied fields and bumps the updated time', async () => {
    const { admin } = await world();
    const doc = await create(admin.token, { title: 'Original', category: 'Scripts', content: 'Body text.' });
    await new Promise(r => setTimeout(r, 15));

    const res = await request(app).patch(`/api/kb-articles/${doc.body.id}`).set(auth(admin.token)).send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', category: 'Scripts', content: 'Body text.' });
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(doc.body.updatedAt).getTime());
  });

  it('cannot blank out a document\'s title or content, and unknown ids are 404', async () => {
    const { admin } = await world();
    const doc = await create(admin.token, { title: 'Keep', content: 'Keep this.' });
    expect((await request(app).patch(`/api/kb-articles/${doc.body.id}`).set(auth(admin.token)).send({ title: '' })).status).toBe(400);
    expect((await request(app).patch(`/api/kb-articles/${doc.body.id}`).set(auth(admin.token)).send({ content: '  ' })).status).toBe(400);
    expect((await request(app).patch('/api/kb-articles/kb_nope').set(auth(admin.token)).send({ title: 'x' })).status).toBe(404);
  });

  it('a document can be deleted, and then it is gone', async () => {
    const { admin, agent } = await world();
    const doc = await create(admin.token, { title: 'Temporary', content: 'bye' });
    expect((await request(app).delete(`/api/kb-articles/${doc.body.id}`).set(auth(admin.token))).status).toBe(200);
    const list = await request(app).get('/api/kb-articles').set(auth(agent.token));
    expect(list.body.some(a => a.id === doc.body.id)).toBe(false);
    expect((await request(app).delete(`/api/kb-articles/${doc.body.id}`).set(auth(admin.token))).status).toBe(404);
  });

  it('requires a signed-in user to read or write', async () => {
    expect((await request(app).get('/api/kb-articles')).status).toBe(401);
    expect((await request(app).post('/api/kb-articles').send({ title: 't', content: 'c' })).status).toBe(401);
  });
});
