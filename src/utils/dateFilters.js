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
