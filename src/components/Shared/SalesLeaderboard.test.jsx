import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesLeaderboard from './SalesLeaderboard';
import * as salesApi from '../../api/sales';

vi.mock('../../api/sales');

const ROWS = [
  // Ayesha: fewer submissions but every one Approved (big approved revenue).
  // Bilal: more submissions this month, but most are still Pending/Rejected (tiny approved revenue).
  { agentId: 'a1', agentName: 'Ayesha Khan', submittedCount: 40, monthSubmittedCount: 5, approvedRevenuePkr: 400000 },
  { agentId: 'a2', agentName: 'Bilal Raza', submittedCount: 10, monthSubmittedCount: 12, approvedRevenuePkr: 5000 }
];

describe('SalesLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ranks by monthSubmittedCount (This Month is the default) -- number submitted, not approved count or revenue', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    await screen.findByText('Bilal Raza');
    // Bilal (12 submitted this month) outranks Ayesha (5) despite Ayesha's far higher approved revenue.
    const names = screen.getAllByText(/Ayesha Khan|Bilal Raza/).map(el => el.textContent);
    expect(names[0]).toContain('Bilal Raza');
    expect(screen.getByText('12 submitted')).toBeInTheDocument();
  });

  it('marks the current user\'s own row with "(You)"', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    expect(await screen.findByText(/Ayesha Khan \(You\)/)).toBeInTheDocument();
  });

  it('switching to All Time re-ranks by submittedCount instead', async () => {
    const user = userEvent.setup();
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);
    await screen.findByText('Bilal Raza');

    await user.click(screen.getByRole('button', { name: /all time/i }));
    const names = screen.getAllByText(/Ayesha Khan|Bilal Raza/).map(el => el.textContent);
    expect(names[0]).toContain('Ayesha Khan'); // 40 all-time submitted vs Bilal's 10
  });

  it('shows an empty state when nobody has submitted a sale in the period', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue([{ agentId: 'a1', agentName: 'Ayesha Khan', submittedCount: 0, monthSubmittedCount: 0, approvedRevenuePkr: 0 }]);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    expect(await screen.findByText(/no sales submitted in this period yet/i)).toBeInTheDocument();
  });

  it('shows the error message if the fetch fails', async () => {
    salesApi.fetchLeaderboard.mockRejectedValue(new Error('Network down'));
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
  });
});
