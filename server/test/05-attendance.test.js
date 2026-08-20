const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

// Shift policy under test (server/routes/attendance.routes.js): on-time window is
// 6:00 PM - 8:15 PM PKT (Asia/Karachi, UTC+5, no DST). Anything outside that window,
// including very early morning hours, is Tardy.
function pktTimeToUtc(hour, minute = 0) {
  return new Date(Date.UTC(2026, 7, 19, hour - 5, minute));
}

describe('attendance clock-in Present/Tardy policy', () => {
  let admin, campaignId;

  beforeEach(async () => {
    vi.useFakeTimers();
    admin = await createAdmin();
    campaignId = await createCampaign(admin.token);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function clockInAt(pktHour, pktMinute = 0) {
    vi.setSystemTime(pktTimeToUtc(pktHour, pktMinute));
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const res = await request(app).post('/api/attendance/clock-in').set('Authorization', `Bearer ${agent.token}`);
    return res.body;
  }

  it('7:00 PM PKT (comfortably inside the window) is Present', async () => {
    const log = await clockInAt(19, 0);
    expect(log.status).toBe('Present');
  });

  it('exactly 8:15 PM PKT (the inclusive boundary) is Present', async () => {
    const log = await clockInAt(20, 15);
    expect(log.status).toBe('Present');
  });

  it('8:16 PM PKT (one minute past the boundary) is Tardy', async () => {
    const log = await clockInAt(20, 16);
    expect(log.status).toBe('Tardy');
  });

  it('exactly 6:00 PM PKT (the early edge) is Present', async () => {
    const log = await clockInAt(18, 0);
    expect(log.status).toBe('Present');
  });

  it('5:59 PM PKT (one minute before the early edge) is Tardy', async () => {
    const log = await clockInAt(17, 59);
    expect(log.status).toBe('Tardy');
  });

  it('4:49 AM PKT (very late / early-morning arrival) is Tardy, not Present', async () => {
    const log = await clockInAt(4, 49);
    expect(log.status).toBe('Tardy');
  });

  it('clock-out requires an existing open clock-in', async () => {
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const res = await request(app).post('/api/attendance/clock-out').set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(400);
  });

  it('clock-out closes the open log and sets status to Clocked Out', async () => {
    vi.setSystemTime(pktTimeToUtc(19, 0));
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/attendance/clock-in').set('Authorization', `Bearer ${agent.token}`);
    const res = await request(app).post('/api/attendance/clock-out').set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Clocked Out');
    expect(res.body.clockOut).not.toBe('--:--');
  });
});

describe('attendance status override RBAC', () => {
  it('only Admin/Supervisor can manually override a status', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await request(app).post('/api/attendance/clock-in').set('Authorization', `Bearer ${agent.token}`);
    const list = await request(app).get('/api/attendance').set('Authorization', `Bearer ${admin.token}`);
    const logId = list.body.find(l => l.agentId === agent.id).id;

    const selfOverride = await request(app).patch(`/api/attendance/${logId}`).set('Authorization', `Bearer ${agent.token}`).send({ status: 'Present' });
    expect(selfOverride.status).toBe(403);

    const adminOverride = await request(app).patch(`/api/attendance/${logId}`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'Late' });
    expect(adminOverride.status).toBe(200);
    expect(adminOverride.body.status).toBe('Late');
  });
});
