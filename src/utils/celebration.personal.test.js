import { describe, it, expect } from 'vitest';
import { buildCelebration } from './celebration';

const first = () => 0;
const base = { agentName: 'Sarah Jenkins', campaignName: 'US Solar', salesToday: 2, salesThisMonth: 40 };

describe('personal sales target (set by an Admin/Supervisor)', () => {
  const personal = { ...base, goalKind: 'personal', goal: 60, goalProgress: 40 };

  it('talks about "your monthly target", not the campaign goal', () => {
    const c = buildCelebration(personal, first);
    expect(c.tracker.line).toMatch(/20 more sales to hit your monthly target of 60/);
    expect(c.tracker.title).toBe('Monthly sales target progress');
    expect(c.tracker.kind).toBe('personal');
  });

  it('never refers to the campaign in personal messaging', () => {
    for (const progress of [10, 58, 60, 75]) {
      for (let seed = 0; seed < 6; seed++) {
        const c = buildCelebration({ ...personal, goalProgress: progress }, () => seed / 6);
        expect(`${c.headline} ${c.message}`).not.toContain('US Solar');
      }
    }
  });

  it('celebrates hitting the personal target', () => {
    const c = buildCelebration({ ...personal, goalProgress: 60 }, first);
    expect(c.headline).toMatch(/TARGET HIT/);
    expect(c.tracker.line).toMatch(/^Target reached/);
    expect(c.intensity).toBe('epic');
  });

  it('builds excitement when the personal target is within 3 sales', () => {
    const c = buildCelebration({ ...personal, goalProgress: 58 }, first);
    expect(c.headline).toMatch(/close/i);
  });

  it('a campaign goal is still worded as the month\'s goal when no personal target is used', () => {
    const c = buildCelebration({ ...base, goalKind: 'campaign', goal: 150, goalProgress: 130 }, first);
    expect(c.tracker.line).toMatch(/this month's goal of 150/);
    expect(c.tracker.title).toBe('Monthly sales goal progress');
  });
});
