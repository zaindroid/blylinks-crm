export const DATE_RANGE_PRESETS = ['All Time', 'Today', 'This Week', 'This Month', 'Custom'];

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(d) {
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - day);
  return copy;
}

function startOfMonth(d) {
  const copy = startOfDay(d);
  copy.setDate(1);
  return copy;
}

// Returns { from: Date|null, to: Date|null } for a preset, evaluated against "now".
export function rangeForPreset(preset) {
  const now = new Date();
  if (preset === 'Today') {
    return { from: startOfDay(now), to: null };
  }
  if (preset === 'This Week') {
    return { from: startOfWeek(now), to: null };
  }
  if (preset === 'This Month') {
    return { from: startOfMonth(now), to: null };
  }
  return { from: null, to: null };
}

// Filters an array of records by an ISO date field name, given a preset or a custom {from, to} (yyyy-mm-dd strings).
export function filterByDateRange(records, isoField, preset, customFrom, customTo) {
  if (preset === 'All Time') return records;

  let from = null;
  let to = null;

  if (preset === 'Custom') {
    from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    to = customTo ? new Date(`${customTo}T23:59:59.999`) : null;
  } else {
    const range = rangeForPreset(preset);
    from = range.from;
    to = range.to;
  }

  if (!from && !to) return records;

  return records.filter(r => {
    if (!r[isoField]) return false;
    const value = new Date(r[isoField]);
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  });
}

// Formats a Date as a local YYYY-MM-DD string. Never UTC -- toISOString() would shift the
// date near midnight depending on the reader's timezone offset, which is exactly the bug
// filterByDateOnlyRange below exists to avoid.
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Same job as filterByDateRange, but for a field that is already a plain 'YYYY-MM-DD' string
// with no time of day (an attendance log's `date`, not a sale's `saleDateIso`). Running that
// through filterByDateRange would parse it with `new Date('2026-09-24')`, which JS treats as
// UTC midnight, and then compare it against `from`/`to` boundaries built in the *local*
// timezone -- a record dated "today" can silently fail to match depending on how far the
// reader's clock sits from UTC. Plain string comparison on YYYY-MM-DD sidesteps that
// entirely: lexicographic order on that format is exactly chronological order.
export function filterByDateOnlyRange(records, dateField, preset, customFrom, customTo) {
  if (preset === 'All Time') return records;

  let from = null;
  let to = null;

  if (preset === 'Custom') {
    from = customFrom || null;
    to = customTo || null;
  } else {
    const range = rangeForPreset(preset);
    from = range.from ? toLocalDateStr(range.from) : null;
    to = range.to ? toLocalDateStr(range.to) : null;
  }

  if (!from && !to) return records;

  return records.filter(r => {
    const value = r[dateField];
    if (!value) return false;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  });
}
