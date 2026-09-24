import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterByDateRange, filterByDateOnlyRange } from './dateFilters';

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

describe('filterByDateOnlyRange', () => {
  // FIXED_NOW is Wed 2026-08-19 (see above); the week runs Sun 2026-08-16 through Sat 2026-08-22.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const logs = [
    { id: 'yesterday', date: '2026-08-18' },
    { id: 'today', date: '2026-08-19' },
    { id: 'earlier-this-week', date: '2026-08-17' },
    { id: 'earlier-this-month', date: '2026-08-03' },
    { id: 'last-month', date: '2026-07-20' },
    { id: 'no-date', date: null }
  ];

  it('All Time returns every record, including ones with no date', () => {
    expect(filterByDateOnlyRange(logs, 'date', 'All Time')).toHaveLength(logs.length);
  });

  it('Today keeps only the current calendar day', () => {
    const result = filterByDateOnlyRange(logs, 'date', 'Today').map(r => r.id);
    expect(result).toEqual(['today']);
  });

  it('This Week includes today and earlier days in the same week, excludes last month', () => {
    const result = filterByDateOnlyRange(logs, 'date', 'This Week').map(r => r.id);
    expect(result).toEqual(expect.arrayContaining(['today', 'yesterday', 'earlier-this-week']));
    expect(result).not.toContain('earlier-this-month');
  });

  it('This Month excludes last month', () => {
    const result = filterByDateOnlyRange(logs, 'date', 'This Month').map(r => r.id);
    expect(result).toContain('earlier-this-month');
    expect(result).not.toContain('last-month');
  });

  it('records with a null date are excluded once any range is applied', () => {
    expect(filterByDateOnlyRange(logs, 'date', 'Today').find(r => r.id === 'no-date')).toBeUndefined();
  });

  it('Custom range is inclusive of both bounding days', () => {
    const result = filterByDateOnlyRange(logs, 'date', 'Custom', '2026-08-17', '2026-08-18').map(r => r.id);
    expect(result.sort()).toEqual(['earlier-this-week', 'yesterday']);
  });

  it('Custom range with only a "from" bound has no upper limit', () => {
    const result = filterByDateOnlyRange(logs, 'date', 'Custom', '2026-08-18', null).map(r => r.id);
    expect(result.sort()).toEqual(['today', 'yesterday'].sort());
  });

  it('Custom range with neither bound set behaves like All Time', () => {
    expect(filterByDateOnlyRange(logs, 'date', 'Custom', '', '')).toHaveLength(logs.length);
  });

  it('never misclassifies a boundary day due to UTC-vs-local parsing (the bug this exists to avoid)', () => {
    // A plain 'YYYY-MM-DD' string run through `new Date(...)` parses as UTC midnight; comparing
    // that against a *local* midnight boundary can push "today" into "yesterday" or vice versa
    // depending on the reader's UTC offset. String comparison must never do that.
    const todayOnly = [{ id: 'today', date: '2026-08-19' }];
    expect(filterByDateOnlyRange(todayOnly, 'date', 'Today')).toHaveLength(1);
  });
});
