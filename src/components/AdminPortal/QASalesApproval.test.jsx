import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QASalesApproval from './QASalesApproval';

const NOW = new Date().toISOString();
const sale = (over) => ({
  id: 'SALE-1', customerName: 'Cust', phone: '555', projectName: 'Solar', amount: 1000,
  date: '9/24/2026', saleDateIso: NOW, status: 'Pending', agentId: 'a1', agentName: 'Ayesha Khan',
  ...over
});

const CURRENT_USER = { id: 'admin1', name: 'Boss', role: 'Admin' };

const setup = (sales, props = {}) => render(
  <QASalesApproval sales={sales} currentUser={CURRENT_USER} onApproveSale={vi.fn()} onRejectSale={vi.fn()} {...props} />
);

describe('QASalesApproval agent filter', () => {
  it('offers a dropdown built from the agents actually present in the sales list', () => {
    setup([
      sale({ id: 'S1', agentId: 'a1', agentName: 'Ayesha Khan' }),
      sale({ id: 'S2', agentId: 'a2', agentName: 'Bilal Raza' })
    ]);
    const select = screen.getByLabelText(/filter by agent/i);
    expect(within(select).getByText('Ayesha Khan')).toBeInTheDocument();
    expect(within(select).getByText('Bilal Raza')).toBeInTheDocument();
  });

  it('filters the table down to just the selected agent', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Approved' }),
      sale({ id: 'S2', agentId: 'a2', agentName: 'Bilal Raza', status: 'Approved' })
    ]);
    // default status filter starts on Pending -- switch to All so both rows are visible first
    await user.selectOptions(screen.getByDisplayValue(/pending review only/i), 'All');
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter by agent/i), 'a2');
    expect(screen.queryByText('S1')).not.toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();
  });

  it('combines with the existing status and search filters rather than replacing them', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Pending' }),
      sale({ id: 'S2', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Approved' }),
      sale({ id: 'S3', agentId: 'a2', agentName: 'Bilal Raza', status: 'Pending' })
    ]);
    await user.selectOptions(screen.getByLabelText(/filter by agent/i), 'a1');
    // status filter still defaults to Pending -- of Ayesha's two sales, only the pending one shows
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.queryByText('S2')).not.toBeInTheDocument();
    expect(screen.queryByText('S3')).not.toBeInTheDocument();
  });

  it('resets to showing everyone when "All Agents" is chosen again', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', agentId: 'a1', agentName: 'Ayesha Khan' }),
      sale({ id: 'S2', agentId: 'a2', agentName: 'Bilal Raza' })
    ]);
    const select = screen.getByLabelText(/filter by agent/i);
    await user.selectOptions(select, 'a1');
    await user.selectOptions(select, 'All');
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();
  });
});
