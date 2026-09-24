const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const check = (token, campaignId, phone) => request(app).post('/api/dnc/check').set(auth(token)).send({ campaignId, phone });
const add = (token, campaignId, phone, note) => request(app).post('/api/dnc').set(auth(token)).send({ campaignId, phone, note });
const bulk = (token, campaignId, numbers) => request(app).post('/api/dnc/bulk').set(auth(token)).send({ campaignId, numbers });
const list = (token, campaignId, q) => request(app)
  .get(`/api/dnc?campaignId=${campaignId}${q ? `&q=${encodeURIComponent(q)}` : ''}`).set(auth(token));
const importRows = (token, campaignId, rows) => request(app).post('/api/dnc/bulk').set(auth(token)).send({ campaignId, rows });
const edit = (token, id, phone, note) => request(app).put(`/api/dnc/${id}`).set(auth(token)).send({ phone, note });

async function createSupervisor(admin, campaignIds) {
  const user = await insertUser({ role: 'Supervisor' });
  await request(app).patch(`/api/users/${user.id}/campaigns`).set(auth(admin.token)).send({ campaignIds });
  return { ...user, token: await loginToken(user.username) };
}

async function world() {
  const admin = await createAdmin();
  const campA = await createCampaign(admin.token);
  const campB = await createCampaign(admin.token);
  const agentA = await createAgentViaApi(admin.token, [campA]);
  const agentAB = await createAgentViaApi(admin.token, [campA, campB]);
  return { admin, campA, campB, agentA, agentAB };
}

describe('DNC check (what an agent sees)', () => {
  it('finds a listed number and reports a clean number as not found', async () => {
    const { admin, campA, agentA } = await world();
    await add(admin.token, campA, '0300-1234567');

    const hit = await check(agentA.token, campA, '0300-1234567');
    expect(hit.status).toBe(200);
    expect(hit.body.found).toBe(true);
    const miss = await check(agentA.token, campA, '0300-7654321');
    expect(miss.body.found).toBe(false);
  });

  it('matches regardless of formatting or country code (03001234567 = +92 300 1234567 = 0092-300-1234567)', async () => {
    const { admin, campA, agentA } = await world();
    await add(admin.token, campA, '03001234567');
    for (const variant of ['+92 300 1234567', '0092-300-1234567', '3001234567', '(300) 123 4567', '923001234567']) {
      expect((await check(agentA.token, campA, variant)).body.found).toBe(true);
    }
  });

  it('US-style numbers match too', async () => {
    const { admin, campA, agentA } = await world();
    await add(admin.token, campA, '(555) 123-4567');
    expect((await check(agentA.token, campA, '+1 555 123 4567')).body.found).toBe(true);
    expect((await check(agentA.token, campA, '555.123.4567')).body.found).toBe(true);
  });

  it('each campaign has its own list: a number on A is NOT on B', async () => {
    const { admin, campA, campB, agentAB } = await world();
    await add(admin.token, campA, '03001112222');
    await add(admin.token, campB, '03003334444');

    expect((await check(agentAB.token, campA, '03001112222')).body.found).toBe(true);
    expect((await check(agentAB.token, campB, '03001112222')).body.found).toBe(false);
    expect((await check(agentAB.token, campB, '03003334444')).body.found).toBe(true);
    expect((await check(agentAB.token, campA, '03003334444')).body.found).toBe(false);
  });

  it('an agent cannot check a campaign they are not assigned to (no probing other campaigns\' lists)', async () => {
    const { admin, campB, agentA } = await world();
    await add(admin.token, campB, '03005556666');
    const res = await check(agentA.token, campB, '03005556666');
    expect(res.status).toBe(403);
    expect(res.body.found).toBeUndefined();
  });

  it('the answer reveals only found / not found -- never notes, who added it, or other entries', async () => {
    const { admin, campA, agentA } = await world();
    await add(admin.token, campA, '03007778888', 'customer complained on 3 Mar');
    const res = await check(agentA.token, campA, '03007778888');
    expect(Object.keys(res.body).sort()).toEqual(['campaignId', 'campaignName', 'found']);
    expect(JSON.stringify(res.body)).not.toMatch(/complained/);
  });

  it('rejects things that are not phone numbers, unknown campaigns, and unauthenticated calls', async () => {
    const { campA, agentA } = await world();
    for (const phone of ['abc', '123', '', '0000000', '1'.repeat(30), undefined, null, { $ne: 1 }]) {
      expect((await check(agentA.token, campA, phone)).status).toBe(400);
    }
    expect((await check(agentA.token, 'camp_nope', '03001234567')).status).toBe(404);
    expect((await request(app).post('/api/dnc/check').send({ campaignId: campA, phone: '03001234567' })).status).toBe(401);
  });

  it('a hostile phone value cannot inject SQL (it is treated purely as digits)', async () => {
    const { campA, agentA } = await world();
    const res = await check(agentA.token, campA, "0300123'; DROP TABLE dnc_numbers;--4567");
    expect([200, 400]).toContain(res.status);
    expect((await check(agentA.token, campA, '03001234567')).status).toBe(200); // table still there
  });
});

describe('DNC list management', () => {
  it('Admin can add a single number with a note; duplicates (even differently formatted) are refused', async () => {
    const { admin, campA } = await world();
    const first = await add(admin.token, campA, '0321-5550100', 'requested removal');
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ phone: '0321-5550100', note: 'requested removal', campaignId: campA });
    expect((await add(admin.token, campA, '+92 321 5550100')).status).toBe(409);
  });

  it('the same number can be on two different campaigns\' lists', async () => {
    const { admin, campA, campB } = await world();
    expect((await add(admin.token, campA, '03211111111')).status).toBe(201);
    expect((await add(admin.token, campB, '03211111111')).status).toBe(201);
  });

  it('rejects an invalid number', async () => {
    const { admin, campA } = await world();
    expect((await add(admin.token, campA, 'not a number')).status).toBe(400);
  });

  it('Agents cannot add, list, bulk-import, summarise or delete', async () => {
    const { admin, campA, agentA } = await world();
    const entry = await add(admin.token, campA, '03214445555');
    expect((await add(agentA.token, campA, '03216667777')).status).toBe(403);
    expect((await bulk(agentA.token, campA, ['03216667777'])).status).toBe(403);
    expect((await request(app).get(`/api/dnc?campaignId=${campA}`).set(auth(agentA.token))).status).toBe(403);
    expect((await request(app).get('/api/dnc/summary').set(auth(agentA.token))).status).toBe(403);
    expect((await request(app).delete(`/api/dnc/${entry.body.id}`).set(auth(agentA.token))).status).toBe(403);
  });

  it('a Supervisor manages the lists of their own campaigns only', async () => {
    const { admin, campA, campB } = await world();
    const supervisor = await createSupervisor(admin, [campA]);

    expect((await add(supervisor.token, campA, '03218889999')).status).toBe(201);
    expect((await add(supervisor.token, campB, '03218889999')).status).toBe(403);
    expect((await bulk(supervisor.token, campB, ['03218889998'])).status).toBe(403);
    expect((await request(app).get(`/api/dnc?campaignId=${campB}`).set(auth(supervisor.token))).status).toBe(403);

    const summary = await request(app).get('/api/dnc/summary').set(auth(supervisor.token));
    expect(summary.body.map(s => s.campaignId)).toEqual([campA]);
  });

  it('a Supervisor cannot delete an entry belonging to another campaign', async () => {
    const { admin, campA, campB } = await world();
    const supervisor = await createSupervisor(admin, [campA]);
    const other = await add(admin.token, campB, '03219990000');
    expect((await request(app).delete(`/api/dnc/${other.body.id}`).set(auth(supervisor.token))).status).toBe(403);
    expect((await check(admin.token, campB, '03219990000')).body.found).toBe(true);
  });

  it('lists a campaign\'s entries with a total, paging and digit search', async () => {
    const { admin, campA } = await world();
    for (let i = 0; i < 5; i++) await add(admin.token, campA, `0300555010${i}`);

    const page1 = await request(app).get(`/api/dnc?campaignId=${campA}&limit=2`).set(auth(admin.token));
    expect(page1.body.total).toBe(5);
    expect(page1.body.entries).toHaveLength(2);
    const page3 = await request(app).get(`/api/dnc?campaignId=${campA}&limit=2&offset=4`).set(auth(admin.token));
    expect(page3.body.entries).toHaveLength(1);

    const found = await request(app).get(`/api/dnc?campaignId=${campA}&q=0103`).set(auth(admin.token));
    expect(found.body.total).toBe(1);
    expect(found.body.entries[0].phone).toBe('03005550103');
  });

  it('summary gives the entry count per campaign', async () => {
    const { admin, campA, campB } = await world();
    await add(admin.token, campA, '03001000001');
    await add(admin.token, campA, '03001000002');
    const summary = await request(app).get('/api/dnc/summary').set(auth(admin.token));
    expect(summary.body.find(s => s.campaignId === campA).count).toBe(2);
    expect(summary.body.find(s => s.campaignId === campB).count).toBe(0);
  });

  it('deleting an entry takes the number off the list', async () => {
    const { admin, campA, agentA } = await world();
    const entry = await add(admin.token, campA, '03002000001');
    expect((await check(agentA.token, campA, '03002000001')).body.found).toBe(true);

    expect((await request(app).delete(`/api/dnc/${entry.body.id}`).set(auth(admin.token))).status).toBe(200);
    expect((await check(agentA.token, campA, '03002000001')).body.found).toBe(false);
    expect((await request(app).delete(`/api/dnc/${entry.body.id}`).set(auth(admin.token))).status).toBe(404);
  });
});

describe('row ids created in a burst', () => {
  // Regression: bulk import used genId(), whose random part is only 24 bits per millisecond, so a large upload
  // intermittently failed with a duplicate-primary-key 500.
  it('genUniqueId never collides, even for 100,000 ids minted in one tight loop', () => {
    const genId = require('../utils/genId');
    const ids = new Set();
    for (let i = 0; i < 100000; i++) ids.add(genId.genUniqueId('dnc'));
    expect(ids.size).toBe(100000);
  });

  it('the old genId() does collide when a burst lands in the same millisecond -- which is exactly why bulk imports must not use it', () => {
    // genId()'s uniqueness comes entirely from Date.now() + 24 random bits, so two ids minted in the
    // same millisecond only differ by those 24 bits -- generating enough of them guarantees a collision
    // by the birthday paradox. A real burst may or may not land in one millisecond depending on machine
    // speed (this is what made the bug intermittent in production), so the clock is pinned here rather
    // than relying on timing, which would make this assertion flaky.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    try {
      const genId = require('../utils/genId');
      const ids = new Set();
      for (let i = 0; i < 100000; i++) ids.add(genId('dnc'));
      expect(ids.size).toBeLessThan(100000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DNC bulk upload', () => {
  it('imports a file\'s numbers and reports added / duplicate / invalid counts', async () => {
    const { admin, campA, agentA } = await world();
    await add(admin.token, campA, '03003000001'); // already listed

    const res = await bulk(admin.token, campA, [
      '03003000001',        // already on the list
      '0300-3000002',       // new
      '+92 300 3000003',    // new
      '03003000002',        // same as the second one, in another format -> duplicate within the file
      'hello',              // invalid
      '123'                 // invalid
    ]);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ received: 6, added: 2, duplicates: 2, invalid: 2 });
    expect(res.body.invalidSamples).toEqual(['hello', '123']);

    expect((await check(agentA.token, campA, '03003000003')).body.found).toBe(true);
  });

  it('the maximum-size upload (20,000 numbers) succeeds every time', async () => {
    const { admin, campA } = await world();
    const numbers = Array.from({ length: 20000 }, (_, i) => `0347${String(1000000 + i)}`);
    const res = await bulk(admin.token, campA, numbers);
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(20000);
  });

  it('a large file (well over the normal request-size limit) is accepted', async () => {
    const { admin, campA } = await world();
    const numbers = Array.from({ length: 12000 }, (_, i) => `0345${String(1000000 + i)}`); // ~170kb of JSON
    const res = await bulk(admin.token, campA, numbers);
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(12000);
  });

  it('refuses an upload with too many numbers, an empty list, or a non-list', async () => {
    const { admin, campA } = await world();
    expect((await bulk(admin.token, campA, Array.from({ length: 20001 }, (_, i) => `0346${String(1000000 + i)}`))).status).toBe(413);
    expect((await bulk(admin.token, campA, [])).status).toBe(400);
    expect((await bulk(admin.token, campA, 'a,b,c')).status).toBe(400);
  });

  it('requires a signed-in user before the server will read a large body', async () => {
    const { campA } = await world();
    const res = await request(app).post('/api/dnc/bulk').send({ campaignId: campA, numbers: ['03001234567'] });
    expect(res.status).toBe(401);
  });

  it('a list that is entirely invalid adds nothing and says so', async () => {
    const { admin, campA } = await world();
    const res = await bulk(admin.token, campA, ['x', 'y', '12']);
    expect(res.body).toMatchObject({ added: 0, invalid: 3 });
  });
});

// A DNC list is only worth anything if it is exactly one row per number, per campaign. A duplicated row is a
// number nobody notices is listed twice; a missing one is a number that gets dialled.
describe('the DNC master list never holds the same number twice', () => {
  it('re-uploading the same numbers adds no second row, however they are written', async () => {
    const { admin, campA } = await world();
    const first = await importRows(admin.token, campA, [{ phone: '0300 1234567' }, { phone: '0300 7654321' }]);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ received: 2, added: 2, duplicates: 0, invalid: 0 });

    const again = await importRows(admin.token, campA, [{ phone: '+92 300 1234567' }, { phone: '0092-300-7654321' }]);
    expect(again.body).toMatchObject({ received: 2, added: 0, duplicates: 2 });

    expect((await list(admin.token, campA)).body.total).toBe(2);
    const summary = await request(app).get('/api/dnc/summary').set(auth(admin.token));
    expect(summary.body.find(s => s.campaignId === campA).count).toBe(2);
  });

  it('the same number repeated inside one file lands once', async () => {
    const { admin, campA } = await world();
    const res = await importRows(admin.token, campA, [
      { phone: '03001111111' }, { phone: '0300 1111111' }, { phone: '+92 300 1111111' }
    ]);
    expect(res.body).toMatchObject({ received: 3, added: 1, duplicates: 2 });
    expect((await list(admin.token, campA)).body.total).toBe(1);
  });

  it('looks like one row per number after many overlapping "weekly" uploads', async () => {
    const { admin, campA } = await world();
    const weeks = [
      ['0300 1111111', '0300 2222222', '0300 3333333'],
      ['+92 300 2222222', '0300 4444444', '0300 3333333'],
      ['0092-300-1111111', '0300 5555555', '0300 2222222']
    ];
    const addedPerWeek = [];
    for (const week of weeks) {
      const res = await importRows(admin.token, campA, week.map(phone => ({ phone })));
      addedPerWeek.push(res.body.added);
    }
    expect(addedPerWeek).toEqual([3, 1, 1]); // five distinct numbers, uploaded nine times

    const page = await list(admin.token, campA);
    expect(page.body.total).toBe(5);
    // Every row is its own number -- judged the same way a lookup judges it.
    const keys = page.body.entries.map(e => e.phone.replace(/\D/g, '').slice(-10));
    expect(new Set(keys).size).toBe(5);
  });

  it('a manager cannot add a number that is already listed, in any format', async () => {
    const { admin, campA } = await world();
    await add(admin.token, campA, '0321-5550100');
    for (const variant of ['+92 321 5550100', '03215550100', '(321) 555 0100']) {
      expect((await add(admin.token, campA, variant)).status).toBe(409);
    }
    expect((await list(admin.token, campA)).body.total).toBe(1);
  });

  it('a later upload fills in details the list did not have, without creating a second row', async () => {
    const { admin, campA } = await world();
    await importRows(admin.token, campA, [{ phone: '0300 1234567' }]);

    const second = await importRows(admin.token, campA, [
      { phone: '0300 1234567', fields: { name: 'Ali', city: 'Lahore' } }
    ]);
    expect(second.body).toMatchObject({ added: 0, duplicates: 1, enriched: 1 });

    const page = await list(admin.token, campA);
    expect(page.body.total).toBe(1);
    expect(page.body.entries[0].fields).toMatchObject({ name: 'Ali', city: 'Lahore' });

    // Re-importing the identical row changes nothing, and is not called an enrichment.
    const third = await importRows(admin.token, campA, [
      { phone: '0300 1234567', fields: { name: 'Ali', city: 'Lahore' } }
    ]);
    expect(third.body).toMatchObject({ added: 0, duplicates: 1, enriched: 0 });
    expect((await list(admin.token, campA)).body.total).toBe(1);
  });

  it('reports numbers it could not use instead of importing them', async () => {
    const { admin, campA } = await world();
    const res = await importRows(admin.token, campA, [
      { phone: '03001111111' }, { phone: 'abc' }, { phone: '12345' }, { phone: '0000000' }
    ]);
    expect(res.body).toMatchObject({ received: 4, added: 1, duplicates: 0, invalid: 3 });
    expect(res.body.invalidSamples).toEqual(['abc', '12345', '0000000']);
  });

  it('trims the extra sheet columns to something the list can render', async () => {
    const { admin, campA } = await world();
    const manyColumns = {};
    for (let i = 0; i < 40; i++) manyColumns[`col${i}`] = 'x'.repeat(500);

    const res = await importRows(admin.token, campA, [
      { phone: '03001111111', note: 'n'.repeat(500), fields: manyColumns }
    ]);
    expect(res.status).toBe(201);

    const entry = (await list(admin.token, campA)).body.entries[0];
    expect(Object.keys(entry.fields)).toHaveLength(20);
    expect(Object.values(entry.fields).every(value => value.length === 200)).toBe(true);
    expect(entry.note).toHaveLength(200);
  });

  it('a key that would poison an object is not stored', async () => {
    const { admin, campA } = await world();
    const body = `{"campaignId":${JSON.stringify(campA)},"rows":[{"phone":"03001111111","fields":{"__proto__":"boom","name":"Ali"}}]}`;
    const res = await request(app).post('/api/dnc/bulk')
      .set(auth(admin.token)).set('Content-Type', 'application/json').send(body);
    expect(res.status).toBe(201);

    const entry = (await list(admin.token, campA)).body.entries[0];
    expect(entry.fields).toEqual({ name: 'Ali' });
  });
});

describe('DNC list search', () => {
  it('finds a number however the search is typed, and however it was stored', async () => {
    const { admin, campA } = await world();
    await importRows(admin.token, campA, [{ phone: '(555) 123-4567', fields: { name: 'Bob' } }]);

    for (const typed of ['5551234567', '(555) 123-4567', '+1 555 123 4567', '0092-555-1234567', '1234567']) {
      const res = await list(admin.token, campA, typed);
      expect(res.body.total).toBe(1);
      expect(res.body.entries[0].phone).toBe('(555) 123-4567');
    }
  });

  it('searches the other columns the sheet came with, not just the number', async () => {
    const { admin, campA } = await world();
    await importRows(admin.token, campA, [
      { phone: '0300 1234567', note: 'called twice', fields: { name: 'Ali Khan', city: 'Lahore' } },
      { phone: '0300 7654321', fields: { name: 'Sara Ahmed', city: 'Austin' } }
    ]);

    const byName = await list(admin.token, campA, 'sara');
    expect(byName.body.total).toBe(1);
    expect(byName.body.entries[0].phone).toBe('0300 7654321');
    expect(byName.body.entries[0].fields).toMatchObject({ name: 'Sara Ahmed', city: 'Austin' });

    expect((await list(admin.token, campA, 'lahore')).body.entries.map(e => e.phone)).toEqual(['0300 1234567']);
    expect((await list(admin.token, campA, 'called twice')).body.entries.map(e => e.phone)).toEqual(['0300 1234567']);
    expect((await list(admin.token, campA, 'nobody')).body.total).toBe(0);
  });

  it('treats LIKE wildcards in a search as literal characters', async () => {
    const { admin, campA } = await world();
    await importRows(admin.token, campA, [{ phone: '0300 1234567' }, { phone: '0300 7654321' }]);
    expect((await list(admin.token, campA, '%')).body.total).toBe(0);
    expect((await list(admin.token, campA, '_')).body.total).toBe(0);
  });
});

describe('editing a DNC entry', () => {
  it('changes the number and the note, and the lookup follows', async () => {
    const { admin, campA } = await world();
    const entry = await add(admin.token, campA, '03001111111');

    const renamed = await edit(admin.token, entry.body.id, '0300-3333333', 'wrong number');
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ phone: '0300-3333333', note: 'wrong number' });

    expect((await check(admin.token, campA, '03001111111')).body.found).toBe(false);
    expect((await check(admin.token, campA, '03003333333')).body.found).toBe(true);
    expect((await list(admin.token, campA)).body.total).toBe(1);
  });

  it('refuses an edit that would put the same number on the list twice', async () => {
    const { admin, campA, campB } = await world();
    const entry = await add(admin.token, campA, '03001111111');
    await add(admin.token, campA, '03002222222');

    expect((await edit(admin.token, entry.body.id, '03002222222')).status).toBe(409);
    expect((await edit(admin.token, entry.body.id, '+92 300 222 2222')).status).toBe(409); // same number, written differently

    expect((await list(admin.token, campA)).body.total).toBe(2);
    expect((await check(admin.token, campA, '03001111111')).body.found).toBe(true); // unchanged

    // A different campaign's list is a different list, so there the same number is fine.
    await add(admin.token, campB, '03004444444');
    expect((await edit(admin.token, entry.body.id, '03004444444')).status).toBe(200);
  });

  it('rejects an invalid number, an unknown entry, and anyone without rights to the campaign', async () => {
    const { admin, campA, campB, agentA } = await world();
    const entry = await add(admin.token, campA, '03001111111');
    const supervisor = await createSupervisor(admin, [campA]);
    const other = await add(admin.token, campB, '03005555555');

    expect((await edit(admin.token, entry.body.id, 'not a number')).status).toBe(400);
    expect((await edit(admin.token, 'dnc_does_not_exist', '03001111111')).status).toBe(404);
    expect((await edit(agentA.token, entry.body.id, '03006666666')).status).toBe(403);
    expect((await edit(supervisor.token, other.body.id, '03007777777')).status).toBe(403);
    expect((await check(admin.token, campB, '03005555555')).body.found).toBe(true);
  });
});
