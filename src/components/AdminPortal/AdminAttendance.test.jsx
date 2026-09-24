import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAttendance from './AdminAttendance';

// The date-math itself (Today/This Week/This Month boundaries) is already covered against a fixed
// clock in dateFilters.test.js. This component test only needs to prove the UI wires that utility
// up correctly, so it uses the real clock -- "today" and "yesterday" relative to whenever the suite
// actually runs -- rather than fighting fake timers against userEvent's own internal scheduling.
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const TODAY = toDateStr(new Date());
const YESTERDAY = toDateStr(new Date(Date.now() - 86400000));

const USERS = [
  { id: 'a1', name: 'Ayesha Khan', role: 'Agent' },
  { id: 'a2', name: 'Bilal Raza', role: 'Agent' }
];
const log = (over) => ({ id: 'L1', agentId: 'a1', agentName: 'Ayesha Khan', clockIn: '08:00 PM', clockOut: '--:--', totalHours: '0h', status: 'Present', tardy: false, date: TODAY, ...over });

const setup = (logs, props = {}) => render(
  <AdminAttendance attendanceLogs={logs} users={USERS} onUpdateAttendance={vi.fn()} {...props} />
);

describe('AdminAttendance filters', () => {
  it('filters by agent (existing behaviour, still works)', async () => {
    const user = userEvent.setup();
    setup([
      log({ id: 'L1', agentId: 'a1', agentName: 'Ayesha Khan' }),
      log({ id: 'L2', agentId: 'a2', agentName: 'Bilal Raza' })
    ]);
    await user.selectOptions(screen.getByLabelText(/filter by agent/i), 'a2');
    // scoped to the table: the dropdown itself always lists both names as <option>s
    const table = screen.getByRole('table');
    expect(within(table).queryByText('Ayesha Khan')).not.toBeInTheDocument();
    expect(within(table).getByText('Bilal Raza')).toBeInTheDocument();
  });

  it('filters by date range: Today keeps only the current day', async () => {
    const user = userEvent.setup();
    setup([
      log({ id: 'L1', date: TODAY }),
      log({ id: 'L2', date: YESTERDAY })
    ]);
    await user.selectOptions(screen.getByDisplayValue(/all time/i), 'Today');
    expect(screen.getByText(TODAY)).toBeInTheDocument();
    expect(screen.queryByText(YESTERDAY)).not.toBeInTheDocument();
  });

  it('a custom date range is inclusive of both bounds', async () => {
    const user = userEvent.setup();
    setup([
      log({ id: 'L1', date: '2026-08-01' }),
      log({ id: 'L2', date: '2026-08-10' }),
      log({ id: 'L3', date: '2026-08-20' })
    ]);
    await user.selectOptions(screen.getByDisplayValue(/all time/i), 'Custom');
    const from = screen.getByLabelText(/from date/i);
    const to = screen.getByLabelText(/to date/i);
    // Native date inputs don't take character-by-character typing reliably under jsdom; set the
    // value directly and fire the change React listens for, the same as a browser's date picker would.
    fireDateChange(from, '2026-08-01');
    fireDateChange(to, '2026-08-10');

    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('2026-08-10')).toBeInTheDocument();
    expect(screen.queryByText('2026-08-20')).not.toBeInTheDocument();
  });

  it('combines the agent and date filters', async () => {
    const user = userEvent.setup();
    setup([
      log({ id: 'L1', agentId: 'a1', agentName: 'Ayesha Khan', date: TODAY }), // matches both filters
      log({ id: 'L2', agentId: 'a2', agentName: 'Bilal Raza', date: TODAY }),  // wrong agent
      log({ id: 'L3', agentId: 'a1', agentName: 'Ayesha Khan', date: YESTERDAY }) // wrong date
    ]);
    await user.selectOptions(screen.getByLabelText(/filter by agent/i), 'a1');
    await user.selectOptions(screen.getByDisplayValue(/all time/i), 'Today');

    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('Ayesha Khan')).toBeInTheDocument();
    expect(within(rows[0]).getByText(TODAY)).toBeInTheDocument();
  });

  it('shows an empty-state message rather than a blank table when filters match nothing', async () => {
    const user = userEvent.setup();
    setup([log({ date: '2020-01-01' })]);
    await user.selectOptions(screen.getByDisplayValue(/all time/i), 'Today');
    expect(screen.getByText(/no attendance records match the current filters/i)).toBeInTheDocument();
  });
});

function fireDateChange(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
