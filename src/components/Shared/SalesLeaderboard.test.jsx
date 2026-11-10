import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesLeaderboard from './SalesLeaderboard';
import * as salesApi from '../../api/sales';

vi.mock('../../api/sales');

const ROWS = [
  { agentId: 'a1', agentName: 'Ayesha Khan', approvedCount: 40, monthApprovedCount: 5, approvedRevenuePkr: 400000 },
  { agentId: 'a2', agentName: 'Bilal Raza', approvedCount: 10, monthApprovedCount: 12, approvedRevenuePkr: 100000 }
];

describe('SalesLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the org-wide leaderboard and ranks by monthApprovedCount (This Month is the default)', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    await screen.findByText('Bilal Raza');
    // Bilal (12 this-month sales) outranks Ayesha (5) despite Ayesha's higher all-time count/revenue.
    const names = screen.getAllByText(/Ayesha Khan|Bilal Raza/).map(el => el.textContent);
    expect(names[0]).toContain('Bilal Raza');
  });

  it('marks the current user\'s own row with "(You)"', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    expect(await screen.findByText(/Ayesha Khan \(You\)/)).toBeInTheDocument();
  });

  it('switching to All Time re-ranks by approvedCount instead', async () => {
    const user = userEvent.setup();
    salesApi.fetchLeaderboard.mockResolvedValue(ROWS);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);
    await screen.findByText('Bilal Raza');

    await user.click(screen.getByRole('button', { name: /all time/i }));
    const names = screen.getAllByText(/Ayesha Khan|Bilal Raza/).map(el => el.textContent);
    expect(names[0]).toContain('Ayesha Khan'); // 40 all-time vs Bilal's 10
  });

  it('shows an empty state when nobody has an approved sale in the period', async () => {
    salesApi.fetchLeaderboard.mockResolvedValue([{ agentId: 'a1', agentName: 'Ayesha Khan', approvedCount: 0, monthApprovedCount: 0, approvedRevenuePkr: 0 }]);
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    expect(await screen.findByText(/no approved sales in this period yet/i)).toBeInTheDocument();
  });

  it('shows the error message if the fetch fails', async () => {
    salesApi.fetchLeaderboard.mockRejectedValue(new Error('Network down'));
    render(<SalesLeaderboard currentUser={{ id: 'a1' }} />);

    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
  });
});
