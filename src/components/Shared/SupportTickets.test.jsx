import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupportTickets from './SupportTickets';

const ticket = (over) => ({
  id: 'TICK-1', agentId: 'a1', agentName: 'Ayesha Khan', subject: 'Payroll question',
  category: 'Payroll & Incentives', priority: 'Medium', status: 'Open', date: '2026-10-01',
  description: 'desc', ...over
});

const ADMIN = { id: 'admin1', name: 'Boss', role: 'Admin' };
const SUPERVISOR = { id: 'sup1', name: 'Sup', role: 'Supervisor' };

const setup = (tickets, props = {}) => render(
  <SupportTickets currentUser={ADMIN} tickets={tickets} onAddTicket={vi.fn()} onResolveTicket={vi.fn()} onReopenTicket={vi.fn()} {...props} />
);

describe('SupportTickets Admin resolve/reopen', () => {
  it('Admin sees "Resolve Ticket" on an Open ticket, which calls onResolveTicket', async () => {
    const user = userEvent.setup();
    const onResolveTicket = vi.fn();
    setup([ticket({ status: 'Open' })], { onResolveTicket });

    await user.click(screen.getByRole('button', { name: /resolve ticket/i }));
    expect(onResolveTicket).toHaveBeenCalledWith('TICK-1');
  });

  it('Admin sees "Reopen Ticket" on a Resolved ticket, which calls onReopenTicket', async () => {
    const user = userEvent.setup();
    const onReopenTicket = vi.fn();
    setup([ticket({ status: 'Resolved' })], { onReopenTicket });

    expect(screen.queryByRole('button', { name: /resolve ticket/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reopen ticket/i }));
    expect(onReopenTicket).toHaveBeenCalledWith('TICK-1');
  });

  it('a Supervisor gets no resolve/reopen control on any ticket', () => {
    // Non-Admin ticket visibility is filtered to the viewer's own agentId, so give the
    // Supervisor's own id here to prove the buttons are hidden by role, not by visibility.
    setup([
      ticket({ id: 'TICK-1', agentId: 'sup1', status: 'Open' }),
      ticket({ id: 'TICK-2', agentId: 'sup1', status: 'Resolved' })
    ], { currentUser: SUPERVISOR });
    expect(screen.getByText('TICK-1')).toBeInTheDocument();
    expect(screen.getByText('TICK-2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolve ticket/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reopen ticket/i })).not.toBeInTheDocument();
  });
});
