const request = require('supertest');
const { app, pool, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');

const MONTH = '2026-03'; // March 2026: Mondays fall on the 2nd, 9th, 16th, 23rd, 30th
const auth = (token) => ({ Authorization: `Bearer ${token}` });
let logCounter = 0;

// Attendance rows are inserted directly (rather than through clock-in) so a test can pin an exact
// calendar date and tardy state. Every row is 'Clocked Out': a tardy day must still count once the
// agent has clocked out, which is precisely what the status column alone cannot tell you.
async function logDay(agentId, date, { tardy = false } = {}) {
  await pool.query(
    `INSERT INTO attendance_logs (id, agent_id, log_date, clock_in, clock_out, status, tardy, total_hours)
     VALUES ($1,$2,$3,'08:00 PM','04:00 AM','Clocked Out',$4,'8h 00m')`,
    [`att_pay_${Date.now()}_${logCounter++}`, agentId, date, tardy]
  );
}
const days = (agentId, dates, opts) => Promise.all(dates.map(d => logDay(agentId, d, opts)));

async function setup(baseSalaryPkr = 24000) {
  const admin = await createAdmin();
  const campaignId = await createCampaign(admin.token);
  const agent = await createAgentViaApi(admin.token, [campaignId], { baseSalaryPkr });
  return { admin, agent };
}

const generate = async (admin, agent, month = MONTH) => {
  const res = await request(app).post('/api/payroll/generate').set(auth(admin.token)).send({ month });
  expect(res.status).toBe(200);
  return res.body.find(p => p.agentId === agent.id);
};
const addAdvance = (admin, agent, amountPkr, givenOn = '2026-03-01') =>
  request(app).post('/api/payroll/advances').set(auth(admin.token)).send({ agentId: agent.id, amountPkr, givenOn });
const adjust = (admin, id, body) => request(app).patch(`/api/payroll/${id}`).set(auth(admin.token)).send(body);
const togglePaid = (admin, id) => request(app).patch(`/api/payroll/${id}/toggle-payment`).set(auth(admin.token));

describe('payroll formula: base / 24 x working days', () => {
  it('per-day rate is base/24 and pay is per-day x days actually worked', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']);

    const row = await generate(admin, agent);
    expect(row.baseSalaryPkr).toBe(24000);
    expect(row.perDayPkr).toBe(1000);
    expect(row.workingDays).toBe(10);
    expect(row.netSalaryPkr).toBe(10000);
    expect(row.status).toBe('Pending');
  });

  it('a day with two clock-ins counts once, and a month with no attendance pays nothing', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-02']);
    expect((await generate(admin, agent)).workingDays).toBe(1);

    const { admin: a2, agent: idle } = await setup(24000);
    expect((await generate(a2, idle)).netSalaryPkr).toBe(0);
  });

  it('only days inside the month count', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-02-27', '2026-03-02', '2026-04-01']);
    expect((await generate(admin, agent)).workingDays).toBe(1);
  });

  it('an uneven base salary rounds to the paisa', async () => {
    const { admin, agent } = await setup(50000); // 50000 / 24 = 2083.33
    await days(agent.id, ['2026-03-02', '2026-03-03']);
    const row = await generate(admin, agent);
    expect(row.perDayPkr).toBe(2083.33);
    expect(row.netSalaryPkr).toBe(4166.66);
  });

  it('the Admin adds commission (and bonus / other deductions) and the final total reflects it', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
    const row = await generate(admin, agent);
    expect(row.commissionPkr).toBe(0); // no longer derived from sale amounts

    const res = await adjust(admin, row.id, { commissionPkr: 1500, bonusPkr: 500, deductionsPkr: 200 });
    expect(res.status).toBe(200);
    expect(res.body.commissionPkr).toBe(1500);
    expect(res.body.netSalaryPkr).toBe(5000 + 1500 + 500 - 200);
  });

  it('regenerating recalculates from attendance but never wipes the Admin\'s commission/bonus/deductions', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02']);
    const row = await generate(admin, agent);
    await adjust(admin, row.id, { commissionPkr: 300, bonusPkr: 100, deductionsPkr: 50 });

    await days(agent.id, ['2026-03-03', '2026-03-04']); // two more days worked
    const again = await generate(admin, agent);
    expect(again.workingDays).toBe(3);
    expect(again.commissionPkr).toBe(300);
    expect(again.bonusPkr).toBe(100);
    expect(again.deductionsPkr).toBe(50);
    expect(again.netSalaryPkr).toBe(3000 + 300 + 100 - 50);
  });

  it('the Admin can override the working-days figure', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02']);
    const row = await generate(admin, agent);
    const res = await adjust(admin, row.id, { workingDays: 20 });
    expect(res.body.workingDays).toBe(20);
    expect(res.body.netSalaryPkr).toBe(20000);
  });

  it('rejects negative, non-numeric and out-of-range adjustments', async () => {
    const { admin, agent } = await setup(24000);
    const row = await generate(admin, agent);
    for (const body of [{ commissionPkr: -1 }, { bonusPkr: 'lots' }, { deductionsPkr: {} }, { workingDays: 40 }, { workingDays: 2.5 }, { workingDays: -1 }]) {
      expect((await adjust(admin, row.id, body)).status).toBe(400);
    }
  });
});

describe('3 tardies in a week = half a day deducted', () => {
  it('3 tardy days in one Mon-Sun week deduct half a day\'s pay', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04'], { tardy: true });
    await days(agent.id, ['2026-03-05', '2026-03-06']);

    const row = await generate(admin, agent);
    expect(row.tardyWeeks).toBe(1);
    expect(row.tardyDeductionPkr).toBe(500);
    expect(row.netSalaryPkr).toBe(5000 - 500);
  });

  it('2 tardies in a week is not enough', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03'], { tardy: true });
    const row = await generate(admin, agent);
    expect(row.tardyWeeks).toBe(0);
    expect(row.tardyDeductionPkr).toBe(0);
  });

  it('a 4th or 5th tardy in the same week does not deduct again (one penalty per week)', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'], { tardy: true });
    const row = await generate(admin, agent);
    expect(row.tardyWeeks).toBe(1);
    expect(row.tardyDeductionPkr).toBe(500);
  });

  it('each qualifying week is penalised separately', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-09', '2026-03-10', '2026-03-11'], { tardy: true });
    const row = await generate(admin, agent);
    expect(row.tardyWeeks).toBe(2);
    expect(row.tardyDeductionPkr).toBe(1000);
  });

  it('the week runs Monday to Sunday: 2 tardies then 2 across the Sunday/Monday line is NOT 3 in a week', async () => {
    const { admin, agent } = await setup(24000);
    // Sat 7th + Sun 8th are in the week of Mon 2nd (2 tardies); Mon 9th starts a new week (1 tardy).
    await days(agent.id, ['2026-03-07', '2026-03-08', '2026-03-09'], { tardy: true });
    expect((await generate(admin, agent)).tardyWeeks).toBe(0);
  });

  it('tardiness survives clocking out (the status column becomes "Clocked Out", the flag does not)', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04'], { tardy: true }); // all rows are 'Clocked Out'
    expect((await generate(admin, agent)).tardyDeductionPkr).toBe(500);
  });

  it('an Admin can excuse a tardy day by overriding it to Present, which removes the penalty', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04'], { tardy: true });
    expect((await generate(admin, agent)).tardyDeductionPkr).toBe(500);

    const list = await request(app).get('/api/attendance').set(auth(admin.token));
    const target = list.body.find(l => l.agentId === agent.id && l.date === '2026-03-03');
    const res = await request(app).patch(`/api/attendance/${target.id}`).set(auth(admin.token)).send({ status: 'Present' });
    expect(res.body.tardy).toBe(false);

    const row = await generate(admin, agent);
    expect(row.tardyWeeks).toBe(0);
    expect(row.tardyDeductionPkr).toBe(0);
  });

  it('a real clock-in after 8:15 PM PKT is recorded as tardy and stays tardy after clock-out', async () => {
    vi.useFakeTimers();
    try {
      const { agent } = await setup(24000);
      vi.setSystemTime(new Date(Date.UTC(2026, 7, 19, 15, 20))); // 8:20 PM PKT
      const inRes = await request(app).post('/api/attendance/clock-in').set(auth(agent.token));
      expect(inRes.body.status).toBe('Tardy');
      expect(inRes.body.tardy).toBe(true);
      const outRes = await request(app).post('/api/attendance/clock-out').set(auth(agent.token));
      expect(outRes.body.status).toBe('Clocked Out');
      expect(outRes.body.tardy).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('salary advances are deducted automatically', () => {
  it('an outstanding advance comes off the final total when payroll is generated', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']); // 5000
    expect((await addAdvance(admin, agent, 2000)).status).toBe(201);

    const row = await generate(admin, agent);
    expect(row.advanceDeductionPkr).toBe(2000);
    expect(row.netSalaryPkr).toBe(3000);
  });

  it('an advance recorded after the payroll was generated is still deducted when it is paid', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
    const row = await generate(admin, agent);
    expect(row.advanceDeductionPkr).toBe(0);

    await addAdvance(admin, agent, 1000);
    const paid = await togglePaid(admin, row.id);
    expect(paid.body.status).toBe('Paid');
    expect(paid.body.advanceDeductionPkr).toBe(1000);
    expect(paid.body.netSalaryPkr).toBe(4000);
  });

  it('paying books the recovery, so the same advance is never deducted twice', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
    await days(agent.id, ['2026-04-01', '2026-04-02']);
    await addAdvance(admin, agent, 2000);

    const march = await generate(admin, agent, '2026-03');
    await togglePaid(admin, march.id);

    const advances = await request(app).get('/api/payroll/advances').set(auth(admin.token));
    const adv = advances.body.find(a => a.agentId === agent.id);
    expect(adv.recoveredPkr).toBe(2000);
    expect(adv.outstandingPkr).toBe(0);

    const april = await generate(admin, agent, '2026-04');
    expect(april.advanceDeductionPkr).toBe(0);
  });

  it('an advance bigger than the pay is recovered as far as possible, never taking the net below zero, and the rest carries forward', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04']); // 3000 earned
    await days(agent.id, ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-06', '2026-04-07']); // 5000 earned
    await addAdvance(admin, agent, 5000);

    const march = await generate(admin, agent, '2026-03');
    expect(march.advanceDeductionPkr).toBe(3000);
    expect(march.netSalaryPkr).toBe(0);
    await togglePaid(admin, march.id);

    const april = await generate(admin, agent, '2026-04');
    expect(april.advanceDeductionPkr).toBe(2000); // the remainder
    expect(april.netSalaryPkr).toBe(3000);
  });

  it('reverting a paid payroll to Pending restores the advance balance', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
    await addAdvance(admin, agent, 1500);
    const row = await generate(admin, agent);
    await togglePaid(admin, row.id);

    const reverted = await togglePaid(admin, row.id);
    expect(reverted.body.status).toBe('Pending');

    const advances = await request(app).get('/api/payroll/advances').set(auth(admin.token));
    expect(advances.body.find(a => a.agentId === agent.id).outstandingPkr).toBe(1500);
    expect((await generate(admin, agent)).advanceDeductionPkr).toBe(1500);
  });

  it('an advance given after the pay month has ended is not taken out of that month', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03']);
    await addAdvance(admin, agent, 1000, '2026-04-10');
    expect((await generate(admin, agent, '2026-03')).advanceDeductionPkr).toBe(0);
  });

  it('several advances are recovered oldest first', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04']); // 3000
    await addAdvance(admin, agent, 2000, '2026-03-01');
    await addAdvance(admin, agent, 2000, '2026-03-02');

    const row = await generate(admin, agent);
    expect(row.advanceDeductionPkr).toBe(3000);
    await togglePaid(admin, row.id);

    const advances = await request(app).get('/api/payroll/advances').set(auth(admin.token));
    const mine = advances.body.filter(a => a.agentId === agent.id).sort((a, b) => a.givenOn.localeCompare(b.givenOn));
    expect(mine[0].recoveredPkr).toBe(2000); // the older one is cleared first
    expect(mine[1].recoveredPkr).toBe(1000);
  });

  it('tardy and other deductions come off before the advance, so the advance cannot double-penalise', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04'], { tardy: true }); // 3000 earned, -500 tardy = 2500
    await addAdvance(admin, agent, 9999);
    const row = await generate(admin, agent);
    expect(row.tardyDeductionPkr).toBe(500);
    expect(row.advanceDeductionPkr).toBe(2500);
    expect(row.netSalaryPkr).toBe(0);
  });
});

describe('paid payroll is final', () => {
  it('a Paid record cannot be adjusted and is left alone by regeneration', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03']);
    const row = await generate(admin, agent);
    await togglePaid(admin, row.id);

    expect((await adjust(admin, row.id, { bonusPkr: 999 })).status).toBe(409);

    await days(agent.id, ['2026-03-04']);
    const again = await generate(admin, agent);
    expect(again.status).toBe('Paid');
    expect(again.workingDays).toBe(2); // unchanged
  });
});

describe('advance records', () => {
  it('only an Admin can record, list or delete advances', async () => {
    const { admin, agent } = await setup(24000);
    expect((await request(app).post('/api/payroll/advances').set(auth(agent.token)).send({ agentId: agent.id, amountPkr: 100 })).status).toBe(403);
    expect((await request(app).get('/api/payroll/advances').set(auth(agent.token))).status).toBe(403);
    const created = await addAdvance(admin, agent, 100);
    expect((await request(app).delete(`/api/payroll/advances/${created.body.id}`).set(auth(agent.token))).status).toBe(403);
  });

  it('validates the amount, the date and the person', async () => {
    const { admin, agent } = await setup(24000);
    for (const amountPkr of [0, -5, 'abc', null]) {
      expect((await addAdvance(admin, agent, amountPkr)).status).toBe(400);
    }
    expect((await addAdvance(admin, agent, 100, '31/03/2026')).status).toBe(400);
    expect((await addAdvance(admin, agent, 100, '2026-13-45')).status).toBe(400);
    const ghost = await request(app).post('/api/payroll/advances').set(auth(admin.token)).send({ agentId: 'usr_nope', amountPkr: 100 });
    expect(ghost.status).toBe(404);
    const other = await createAdmin();
    const notAgent = await request(app).post('/api/payroll/advances').set(auth(admin.token)).send({ agentId: other.id, amountPkr: 100 });
    expect(notAgent.status).toBe(400);
  });

  it('an unrecovered advance can be deleted; one already recovered from a paid payroll cannot', async () => {
    const { admin, agent } = await setup(24000);
    await days(agent.id, ['2026-03-02', '2026-03-03', '2026-03-04']);
    const spare = await addAdvance(admin, agent, 100, '2026-05-01'); // after March: never recovered
    const used = await addAdvance(admin, agent, 500, '2026-03-01');
    const row = await generate(admin, agent);
    await togglePaid(admin, row.id);

    expect((await request(app).delete(`/api/payroll/advances/${used.body.id}`).set(auth(admin.token))).status).toBe(409);
    expect((await request(app).delete(`/api/payroll/advances/${spare.body.id}`).set(auth(admin.token))).status).toBe(200);
    expect((await request(app).delete('/api/payroll/advances/adv_nope').set(auth(admin.token))).status).toBe(404);
  });
});

describe('payroll access and generation rules', () => {
  it('an Inactive agent is excluded from payroll generation', async () => {
    const { admin, agent } = await setup(10000);
    await request(app).delete(`/api/users/${agent.id}`).set(auth(admin.token));
    const res = await request(app).post('/api/payroll/generate').set(auth(admin.token)).send({ month: MONTH });
    expect(res.body.find(p => p.agentId === agent.id)).toBeUndefined();
  });

  it('rejects a malformed or impossible month', async () => {
    const admin = await createAdmin();
    for (const month of ['August 2026', '2026-13', '2026-00', '26-08', undefined]) {
      const res = await request(app).post('/api/payroll/generate').set(auth(admin.token)).send({ month });
      expect(res.status).toBe(400);
    }
  });

  it('only Admin can generate or adjust payroll', async () => {
    const { admin, agent } = await setup(24000);
    const row = await generate(admin, agent);
    expect((await request(app).post('/api/payroll/generate').set(auth(agent.token)).send({ month: MONTH })).status).toBe(403);
    expect((await request(app).patch(`/api/payroll/${row.id}`).set(auth(agent.token)).send({ bonusPkr: 1 })).status).toBe(403);
    expect((await request(app).patch(`/api/payroll/${row.id}/toggle-payment`).set(auth(agent.token))).status).toBe(403);
  });

  it('an Agent can read only their own payroll', async () => {
    const { admin, agent } = await setup(24000);
    const other = await createAgentViaApi(admin.token, [await createCampaign(admin.token)], { baseSalaryPkr: 24000 });
    await generate(admin, agent);
    const res = await request(app).get('/api/payroll').set(auth(agent.token));
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every(p => p.agentId === agent.id)).toBe(true);
    expect(res.body.some(p => p.agentId === other.id)).toBe(false);
  });
});
