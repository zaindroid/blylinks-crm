const request = require('supertest');
const { app, pool, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');
const { invalidate, SETTING_KEY } = require('../utils/ipAccess');

const MY_IP = '203.0.113.5'; // documentation addresses (RFC 5737 / 3849) -- never real hosts
const OTHER_IP = '192.0.2.99';

// The app trusts one proxy hop, so the address it uses is the LAST entry of X-Forwarded-For --
// exactly what Traefik appends in production. Supertest plays the part of that proxy here.
const from = (ip) => ({ 'X-Forwarded-For': ip });
const withAuth = (token, ip) => ({ Authorization: `Bearer ${token}`, ...from(ip) });

const status = (token, ip = MY_IP) => request(app).get('/api/access').set(withAuth(token, ip));
const addEntry = (token, cidr, label, ip = MY_IP) => request(app).post('/api/access/entries').set(withAuth(token, ip)).send({ cidr, label });
const setEnabled = (token, enabled, ip = MY_IP) => request(app).put('/api/access/settings').set(withAuth(token, ip)).send({ enabled });

async function reset() {
  await pool.query('DELETE FROM ip_allowlist');
  await pool.query('DELETE FROM app_settings WHERE key = $1', [SETTING_KEY]);
  invalidate();
}

// Leaves the shared database exactly as it found it, so no other test file inherits a restriction.
beforeEach(reset);
afterEach(async () => {
  delete process.env.IP_RESTRICTION_DISABLED;
  await reset();
});

async function restrictedTo(admin, ...cidrs) {
  for (const cidr of cidrs) expect((await addEntry(admin.token, cidr)).status).toBe(201);
  expect((await setEnabled(admin.token, true)).status).toBe(200);
}

describe('IP restriction is off until an Admin turns it on', () => {
  it('any address can reach the portal and the API by default', async () => {
    const anon = await request(app).get('/api/users').set(from(OTHER_IP));
    expect(anon.status).toBe(401); // reached the auth layer, i.e. not blocked by the gate
    const login = await request(app).post('/api/auth/login').set(from(OTHER_IP)).send({ username: 'nobody', password: 'x' });
    expect(login.status).not.toBe(403);
  });

  it('adding entries alone does not start blocking anyone (only the switch does)', async () => {
    const admin = await createAdmin();
    await addEntry(admin.token, MY_IP);
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(401);
  });
});

describe('when the restriction is on', () => {
  it('an unlisted address is refused everywhere, including the login endpoint', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);

    const api = await request(app).get('/api/users').set(from(OTHER_IP));
    expect(api.status).toBe(403);
    expect(api.body.ip).toBe(OTHER_IP);

    const login = await request(app).post('/api/auth/login').set(from(OTHER_IP)).send({ username: admin.username, password: admin.password });
    expect(login.status).toBe(403); // credentials cannot even be attempted from an unlisted network
    expect(login.body.token).toBeUndefined();
  });

  it('a valid session token does not get an unlisted address in either', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    const res = await request(app).get('/api/users').set(withAuth(admin.token, OTHER_IP));
    expect(res.status).toBe(403);
  });

  it('the portal page itself does not open: a readable 403 page that shows the visitor their address', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);

    const page = await request(app).get('/').set(from(OTHER_IP)).set('Accept', 'text/html');
    expect(page.status).toBe(403);
    expect(page.type).toMatch(/html/);
    expect(page.text).toMatch(/Access restricted/);
    expect(page.text).toContain(OTHER_IP);
    expect(page.headers['cache-control']).toMatch(/no-store/);

    const asset = await request(app).get('/assets/index.js').set(from(OTHER_IP));
    expect(asset.status).toBe(403);
  });

  it('a listed address works normally', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/api/users').set(withAuth(admin.token, MY_IP))).status).toBe(200);
  });

  it('health probes stay reachable from any address so the hosting platform never marks the app down', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/health').set(from(OTHER_IP))).status).toBe(200);
    expect((await request(app).get('/ready').set(from(OTHER_IP))).status).toBe(200);
  });

  it('CIDR ranges match every address inside them and none outside', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP, '198.51.100.0/24');
    expect((await request(app).get('/api/users').set(from('198.51.100.77'))).status).toBe(401); // inside
    expect((await request(app).get('/api/users').set(from('198.51.100.0'))).status).toBe(401);
    expect((await request(app).get('/api/users').set(from('198.51.100.255'))).status).toBe(401);
    expect((await request(app).get('/api/users').set(from('198.51.101.1'))).status).toBe(403); // just outside
    expect((await request(app).get('/api/users').set(from('198.51.99.255'))).status).toBe(403);
  });

  it('a single-address entry matches only that address', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/api/users').set(from('203.0.113.6'))).status).toBe(403);
    expect((await request(app).get('/api/users').set(from('203.0.113.4'))).status).toBe(403);
  });

  it('IPv6 addresses and ranges work', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP, '2001:db8::/32', '2001:4860::1');
    expect((await request(app).get('/api/users').set(from('2001:db8:1234::5'))).status).toBe(401);
    expect((await request(app).get('/api/users').set(from('2001:4860::1'))).status).toBe(401);
    expect((await request(app).get('/api/users').set(from('2001:db9::1'))).status).toBe(403);
    expect((await request(app).get('/api/users').set(from('2001:4860::2'))).status).toBe(403);
  });

  it('an IPv4 address presented in IPv6-mapped form is compared as IPv4', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/api/users').set(from(`::ffff:${MY_IP}`))).status).toBe(401);
    expect((await request(app).get('/api/users').set(from(`::ffff:${OTHER_IP}`))).status).toBe(403);
  });

  it('a spoofed X-Forwarded-For cannot talk its way in: only the address the proxy itself appended counts', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    // The client claims to be an allowed address, but the real connecting address (appended last) is not.
    const res = await request(app).get('/api/users').set({ 'X-Forwarded-For': `${MY_IP}, ${OTHER_IP}` });
    expect(res.status).toBe(403);
    // ...and other spoofable headers are ignored entirely.
    const res2 = await request(app).get('/api/users').set({ 'X-Forwarded-For': OTHER_IP, 'X-Real-IP': MY_IP, 'CF-Connecting-IP': MY_IP, 'True-Client-IP': MY_IP });
    expect(res2.status).toBe(403);
  });

  it('changes take effect on the very next request, with no waiting for a cache', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(403);

    await addEntry(admin.token, OTHER_IP, 'Home office');
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(401); // now allowed

    expect((await setEnabled(admin.token, false)).status).toBe(200);
    expect((await request(app).get('/api/users').set(from('192.0.2.200'))).status).toBe(401); // everyone back in
  });
});

describe('an Admin cannot lock themselves out', () => {
  it('refuses to turn the restriction on while the Admin\'s own address is not on the list', async () => {
    const admin = await createAdmin();
    await addEntry(admin.token, OTHER_IP); // someone else's address, not mine
    const res = await setEnabled(admin.token, true);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain(MY_IP);
    expect((await status(admin.token)).body.enabled).toBe(false);
    expect((await request(app).get('/api/users').set(from('192.0.2.200'))).status).toBe(401); // nothing was blocked
  });

  it('refuses to turn it on with an empty list', async () => {
    const admin = await createAdmin();
    expect((await setEnabled(admin.token, true)).status).toBe(409);
  });

  it('refuses to remove the entry that covers the Admin while the restriction is on', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP, '198.51.100.0/24');
    const entries = (await status(admin.token)).body.entries;
    const mine = entries.find(e => e.cidr === MY_IP);

    const res = await request(app).delete(`/api/access/entries/${mine.id}`).set(withAuth(admin.token, MY_IP));
    expect(res.status).toBe(409);
    expect((await status(admin.token)).body.entries).toHaveLength(2); // still there
  });

  it('allows removing an entry that is not the one covering the Admin', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP, '198.51.100.0/24');
    const other = (await status(admin.token)).body.entries.find(e => e.cidr === '198.51.100.0/24');
    expect((await request(app).delete(`/api/access/entries/${other.id}`).set(withAuth(admin.token, MY_IP))).status).toBe(200);
    expect((await request(app).get('/api/users').set(from('198.51.100.7'))).status).toBe(403);
  });

  it('removing the covering entry is fine when a second entry also covers the Admin', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP, '203.0.113.0/24');
    const single = (await status(admin.token)).body.entries.find(e => e.cidr === MY_IP);
    expect((await request(app).delete(`/api/access/entries/${single.id}`).set(withAuth(admin.token, MY_IP))).status).toBe(200);
  });

  it('entries can be removed freely while the restriction is off', async () => {
    const admin = await createAdmin();
    await addEntry(admin.token, OTHER_IP);
    const entry = (await status(admin.token)).body.entries[0];
    expect((await request(app).delete(`/api/access/entries/${entry.id}`).set(withAuth(admin.token, MY_IP))).status).toBe(200);
  });

  it('the emergency override switches enforcement off without needing to sign in', async () => {
    const admin = await createAdmin();
    await restrictedTo(admin, MY_IP);
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(403);

    process.env.IP_RESTRICTION_DISABLED = 'true';
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(401); // let in again
    expect((await status(admin.token)).body.overrideActive).toBe(true);

    delete process.env.IP_RESTRICTION_DISABLED;
    expect((await request(app).get('/api/users').set(from(OTHER_IP))).status).toBe(403); // back on
  });
});

describe('managing the list', () => {
  it('reports the Admin\'s own address and whether it is allowed', async () => {
    const admin = await createAdmin();
    let s = (await status(admin.token)).body;
    expect(s).toMatchObject({ enabled: false, yourIp: MY_IP, yourIpAllowed: false, overrideActive: false, entries: [] });

    await addEntry(admin.token, MY_IP, 'Office');
    s = (await status(admin.token)).body;
    expect(s.yourIpAllowed).toBe(true);
    expect(s.entries[0]).toMatchObject({ cidr: MY_IP, label: 'Office' });
  });

  it('rejects things that are not addresses or ranges', async () => {
    const admin = await createAdmin();
    for (const bad of ['hello', '999.1.1.1', '1.2.3', '1.2.3.4/33', '::1/129', '1.2.3.4/abc', '1.2.3.4/24/8', '', '   ', 12, null, { $ne: 1 }, ['1.2.3.4']]) {
      const res = await addEntry(admin.token, bad);
      expect(res.status, `should reject ${JSON.stringify(bad)}`).toBe(400);
    }
  });

  it('refuses a range that would allow the whole internet (/0)', async () => {
    const admin = await createAdmin();
    expect((await addEntry(admin.token, '0.0.0.0/0')).status).toBe(400);
    expect((await addEntry(admin.token, '::/0')).status).toBe(400);
  });

  it('treats the same address written differently as a duplicate', async () => {
    const admin = await createAdmin();
    expect((await addEntry(admin.token, MY_IP)).status).toBe(201);
    expect((await addEntry(admin.token, MY_IP)).status).toBe(409);
    expect((await addEntry(admin.token, `::ffff:${MY_IP}`)).status).toBe(409);
    expect((await addEntry(admin.token, '  203.0.113.5  ')).status).toBe(409);
    expect((await addEntry(admin.token, '2001:DB8::1')).status).toBe(201);
    expect((await addEntry(admin.token, '2001:db8::1')).status).toBe(409);
  });

  it('unknown entries are 404, and a non-boolean switch value is rejected', async () => {
    const admin = await createAdmin();
    expect((await request(app).delete('/api/access/entries/ip_nope').set(withAuth(admin.token, MY_IP))).status).toBe(404);
    const res = await request(app).put('/api/access/settings').set(withAuth(admin.token, MY_IP)).send({ enabled: 'yes' });
    expect(res.status).toBe(400);
  });

  it('a label is optional and is trimmed and length-limited', async () => {
    const admin = await createAdmin();
    const res = await addEntry(admin.token, MY_IP, `  ${'x'.repeat(300)}  `);
    expect(res.body.entries[0].label).toHaveLength(100);
  });

  it('only an Admin can read or change any of it', async () => {
    const admin = await createAdmin();
    const campaign = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaign]);
    expect((await status(agent.token)).status).toBe(403);
    expect((await addEntry(agent.token, OTHER_IP)).status).toBe(403);
    expect((await setEnabled(agent.token, true)).status).toBe(403);
    expect((await request(app).get('/api/access')).status).toBe(401);
    expect((await status(admin.token)).status).toBe(200);
  });
});
