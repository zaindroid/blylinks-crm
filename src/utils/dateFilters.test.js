import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterByDateRange } from './dateFilters';

// Fixed "now" for deterministic Today/This Week/This Month boundaries:
// Wednesday, 2026-08-19 15:00:00 local time.
const FIXED_NOW = new Date(2026, 7, 19, 15, 0, 0);

function iso(y, m, d, h = 12) {
  return new Date(y, m, d, h).toISOString();
}

describe('filterByDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const records = [
    { id: 'yesterday', saleDateIso: iso(2026, 7, 18) },
    { id: 'today-morning', saleDateIso: iso(2026, 7, 19, 6) },
    { id: 'today-evening', saleDateIso: iso(2026, 7, 19, 20) },
    { id: 'earlier-this-week', saleDateIso: iso(2026, 7, 17) }, // Monday
    { id: 'earlier-this-month', saleDateIso: iso(2026, 7, 3) },
    { id: 'last-month', saleDateIso: iso(2026, 6, 20) },
    { id: 'no-date', saleDateIso: null }
  ];

  it('All Time returns every record untouched, including ones with no date', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'All Time');
    expect(result).toHaveLength(records.length);
  });

  it('Today keeps only records from the current calendar day', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'Today').map(r => r.id);
    expect(result.sort()).toEqual(['today-evening', 'today-morning']);
  });

  it('This Week includes today and earlier days in the same Sun-Sat week, excludes last month', () => {
    // FIXED_NOW is Wed 2026-08-19; the week runs Sun 2026-08-16 through Sat 2026-08-22.
    const result = filterByDateRange(records, 'saleDateIso', 'This Week').map(r => r.id);
    expect(result).toContain('today-morning');
    expect(result).toContain('yesterday'); // 8/18, Tue -- same week
    expect(result).toContain('earlier-this-week'); // 8/17, Mon -- same week
    expect(result).not.toContain('earlier-this-month'); // 8/3 -- prior week
    expect(result).not.toContain('last-month');
  });

  it('This Month excludes last month', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'This Month').map(r => r.id);
    expect(result).toContain('earlier-this-month');
    expect(result).not.toContain('last-month');
  });

  it('records with a null/missing date field are always excluded once any range is applied', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'Today');
    expect(result.find(r => r.id === 'no-date')).toBeUndefined();
  });

  it('Custom range is inclusive of the full start and end day', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'Custom', '2026-08-17', '2026-08-17').map(r => r.id);
    expect(result).toEqual(['earlier-this-week']);
  });

  it('Custom range with only a "from" bound has no upper limit', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'Custom', '2026-08-18', null).map(r => r.id);
    expect(result.sort()).toEqual(['today-evening', 'today-morning', 'yesterday'].sort());
  });

  it('Custom range with neither bound set behaves like All Time', () => {
    const result = filterByDateRange(records, 'saleDateIso', 'Custom', '', '');
    expect(result).toHaveLength(records.length);
  });
});
