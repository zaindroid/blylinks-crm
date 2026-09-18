import { describe, it, expect } from 'vitest';
import { buildCelebration, countMySales } from './celebration';

const first = () => 0; // deterministic "random": always picks the first option
const base = { agentName: 'Sarah Jenkins', campaignName: 'US Solar', salesToday: 2, salesThisMonth: 9, goal: 0, goalProgress: 0 };

describe('buildCelebration tracker', () => {
  it('tells the agent how many sales remain toward the monthly goal (the "20 more to go" line)', () => {
    const c = buildCelebration({ ...base, goal: 150, goalProgress: 130 }, first);
    expect(c.tracker.remaining).toBe(20);
    expect(c.tracker.line).toMatch(/20 more sales to hit this month's goal of 150/);
    expect(c.tracker.pct).toBe(87);
    expect(c.tracker.reached).toBe(false);
  });

  it('uses the singular for the last one', () => {
    const c = buildCelebration({ ...base, goal: 50, goalProgress: 49 }, first);
    expect(c.tracker.line).toMatch(/Just 1 more sale to hit/);
  });

  it('has no tracker at all when the campaign has no goal set', () => {
    expect(buildCelebration({ ...base, goal: 0 }, first).tracker).toBeNull();
    expect(buildCelebration({ ...base, goal: undefined }, first).tracker).toBeNull();
  });

  it('caps progress at 100% and never reports a negative remainder once the goal is passed', () => {
    const c = buildCelebration({ ...base, goal: 100, goalProgress: 130 }, first);
    expect(c.tracker.pct).toBe(100);
    expect(c.tracker.remaining).toBe(0);
    expect(c.tracker.reached).toBe(true);
  });
});

describe('buildCelebration messaging', () => {
  it('greets the agent by first name and never leaves a template placeholder behind', () => {
    for (const salesToday of [1, 2, 3, 5, 10, 14]) {
      for (const [goal, progress] of [[0, 0], [100, 10], [100, 98], [100, 100], [100, 120]]) {
        for (let seed = 0; seed < 6; seed++) {
          const c = buildCelebration({ ...base, salesToday, goal, goalProgress: progress }, () => seed / 6);
          expect(`${c.headline} ${c.message} ${c.tracker?.line || ''}`).not.toMatch(/[{}]|undefined|NaN/);
        }
      }
    }
    expect(buildCelebration({ ...base, salesToday: 1 }, first).headline).toContain('Sarah');
  });

  it('falls back to a friendly name when none is known', () => {
    expect(buildCelebration({ ...base, agentName: '', salesToday: 1 }, first).headline).toContain('Champ');
  });

  it('celebrates the sale that crosses the goal specially, and bigger', () => {
    const c = buildCelebration({ ...base, goal: 100, goalProgress: 100 }, first);
    expect(c.headline).toMatch(/GOAL SMASHED/);
    expect(c.intensity).toBe('epic');
    expect(c.tracker.reached).toBe(true);
  });

  it('acknowledges a goal that was already met before this sale', () => {
    const c = buildCelebration({ ...base, goal: 100, goalProgress: 112 }, first);
    expect(c.headline).toMatch(/Over the top/);
    expect(c.tracker.line).toMatch(/Goal reached/);
  });

  it('builds excitement when the goal is within 3 sales', () => {
    const c = buildCelebration({ ...base, goal: 100, goalProgress: 97 }, first);
    expect(c.headline).toMatch(/close/i);
    expect(c.intensity).toBe('big');
  });

  it('marks daily milestones: first sale, hat-trick, high five, double digits', () => {
    expect(buildCelebration({ ...base, salesToday: 1 }, first).headline).toMatch(/First one|off|Opening/i);
    expect(buildCelebration({ ...base, salesToday: 3 }, first).headline).toMatch(/HAT-TRICK/);
    expect(buildCelebration({ ...base, salesToday: 5 }, first).headline).toMatch(/High five/);
    const ten = buildCelebration({ ...base, salesToday: 10 }, first);
    expect(ten.headline).toMatch(/DOUBLE DIGITS/);
    expect(ten.intensity).toBe('epic');
  });

  it('is varied: ordinary sales draw from several different headlines', () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) seen.add(buildCelebration({ ...base, salesToday: 4 }, () => i / 20).headline);
    expect(seen.size).toBeGreaterThan(2);
  });

  it('always reports the agent\'s own daily and monthly counts', () => {
    const c = buildCelebration({ ...base, salesToday: 4, salesThisMonth: 17 }, first);
    expect(c.stats).toEqual([{ label: 'Today', value: 4 }, { label: 'This month', value: 17 }]);
  });
});

describe('countMySales', () => {
  const now = new Date('2026-08-19T16:00:00Z'); // 9:00 PM PKT on the 19th
  const sale = (over) => ({ agentId: 'me', status: 'Pending', saleDateIso: '2026-08-19T15:30:00Z', ...over });

  it('counts only my own, non-rejected sales, split into today and this month (PKT)', () => {
    const sales = [
      sale({}),                                         // today
      sale({ saleDateIso: '2026-08-19T15:59:00Z' }),    // today
      sale({ saleDateIso: '2026-08-03T10:00:00Z' }),    // this month, not today
      sale({ saleDateIso: '2026-07-30T10:00:00Z' }),    // last month
      sale({ status: 'Rejected' }),                     // rejected: ignored
      sale({ agentId: 'someone-else' })                 // not mine
    ];
    expect(countMySales(sales, 'me', now)).toEqual({ today: 2, month: 3 });
  });

  it('uses Pakistan time for the day boundary: 7:30 PM UTC is already tomorrow in PKT', () => {
    const lateNow = new Date('2026-08-19T19:30:00Z'); // 12:30 AM PKT on the 20th
    const sales = [sale({ saleDateIso: '2026-08-19T18:45:00Z' })]; // 11:45 PM PKT on the 19th
    expect(countMySales(sales, 'me', lateNow).today).toBe(0);
  });
});
