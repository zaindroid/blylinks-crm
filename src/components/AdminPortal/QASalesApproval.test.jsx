import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QASalesApproval from './QASalesApproval';

const NOW = new Date().toISOString();
const sale = (over) => ({
  id: 'SALE-1', customerName: 'Cust', phone: '555', campaignId: 'camp_solar', projectName: 'Solar', amount: 1000,
  date: '9/24/2026', saleDateIso: NOW, status: 'Pending', agentId: 'a1', agentName: 'Ayesha Khan',
  ...over
});

const CURRENT_USER = { id: 'admin1', name: 'Boss', role: 'Admin' };

const setup = (sales, props = {}) => render(
  <QASalesApproval sales={sales} currentUser={CURRENT_USER} onApproveSale={vi.fn()} onRejectSale={vi.fn()} onUpdateSale={vi.fn()} {...props} />
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

describe('QASalesApproval campaign filter', () => {
  it('offers a dropdown built from the campaigns actually present in the sales list', () => {
    setup([
      sale({ id: 'S1', campaignId: 'camp_solar', projectName: 'Solar Campaign' }),
      sale({ id: 'S2', campaignId: 'camp_gas', projectName: 'Gas Campaign' })
    ]);
    const select = screen.getByLabelText(/filter by campaign/i);
    expect(within(select).getByText('Solar Campaign')).toBeInTheDocument();
    expect(within(select).getByText('Gas Campaign')).toBeInTheDocument();
  });

  it('filters the table down to just the selected campaign', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', campaignId: 'camp_solar', projectName: 'Solar Campaign', status: 'Approved' }),
      sale({ id: 'S2', campaignId: 'camp_gas', projectName: 'Gas Campaign', status: 'Approved' })
    ]);
    await user.selectOptions(screen.getByDisplayValue(/pending review only/i), 'All');
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter by campaign/i), 'camp_gas');
    expect(screen.queryByText('S1')).not.toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();
  });

  it('a Supervisor only ever sees the campaigns their (already scoped) sales list contains', () => {
    // The sales array a Supervisor receives is already scoped server-side to their own campaigns,
    // so the dropdown -- built from that same array -- can never offer a campaign outside their access.
    setup([sale({ id: 'S1', campaignId: 'camp_solar', projectName: 'Solar Campaign' })]);
    const select = screen.getByLabelText(/filter by campaign/i);
    expect(within(select).queryByText('Gas Campaign')).not.toBeInTheDocument();
  });

  it('combines the campaign filter with the agent and status filters', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', campaignId: 'camp_solar', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Pending' }),
      sale({ id: 'S2', campaignId: 'camp_solar', agentId: 'a2', agentName: 'Bilal Raza', status: 'Pending' }),
      sale({ id: 'S3', campaignId: 'camp_gas', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Pending' })
    ]);
    await user.selectOptions(screen.getByLabelText(/filter by campaign/i), 'camp_solar');
    await user.selectOptions(screen.getByLabelText(/filter by agent/i), 'a1');
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.queryByText('S2')).not.toBeInTheDocument(); // wrong agent
    expect(screen.queryByText('S3')).not.toBeInTheDocument(); // wrong campaign
  });

  it('resets to showing every campaign when "All Campaigns" is chosen again', async () => {
    const user = userEvent.setup();
    setup([
      sale({ id: 'S1', campaignId: 'camp_solar' }),
      sale({ id: 'S2', campaignId: 'camp_gas' })
    ]);
    const select = screen.getByLabelText(/filter by campaign/i);
    await user.selectOptions(select, 'camp_solar');
    await user.selectOptions(select, 'All');
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('S2')).toBeInTheDocument();
  });
});

describe('QASalesApproval Admin can change the status of an already-reviewed sale', () => {
  const SUPERVISOR = { id: 'sup1', name: 'Sup', role: 'Supervisor' };

  const showAll = async (user) => {
    await user.selectOptions(screen.getByDisplayValue(/pending review only/i), 'All');
  };

  it('Admin sees a "Change to Rejected" button on an Approved sale, which calls onRejectSale after confirming', async () => {
    const user = userEvent.setup();
    const onRejectSale = vi.fn();
    setup([sale({ id: 'S1', status: 'Approved', verifiedBy: 'Boss (Admin)' })], { onRejectSale });
    await showAll(user);

    expect(screen.getByText(/reviewed by boss/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /change to rejected/i }));
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));
    expect(onRejectSale).toHaveBeenCalledWith('S1', expect.any(String));
  });

  it('Admin sees a "Change to Approved" button on a Rejected sale, which calls onApproveSale after confirming', async () => {
    const user = userEvent.setup();
    const onApproveSale = vi.fn();
    setup([sale({ id: 'S1', status: 'Rejected', verifiedBy: 'Boss (Admin)' })], { onApproveSale });
    await showAll(user);

    await user.click(screen.getByRole('button', { name: /change to approved/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));
    expect(onApproveSale).toHaveBeenCalledWith('S1', expect.any(String));
  });

  it('a Supervisor gets no status-change control on an already-reviewed sale, only the "Reviewed by" label', async () => {
    const user = userEvent.setup();
    setup([sale({ id: 'S1', status: 'Approved', verifiedBy: 'Boss (Admin)' })], { currentUser: SUPERVISOR });
    await showAll(user);

    expect(screen.getByText(/reviewed by boss/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change to rejected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change to approved/i })).not.toBeInTheDocument();
  });
});

describe('QASalesApproval Admin free-form sale edit', () => {
  const SUPERVISOR = { id: 'sup1', name: 'Sup', role: 'Supervisor' };

  it('Admin sees an "Edit" button on any sale, which opens a form prefilled from that sale', async () => {
    const user = userEvent.setup();
    setup([sale({ id: 'S1', customerName: 'Jon Smyth', status: 'Approved' })]);
    await user.selectOptions(screen.getByDisplayValue(/pending review only/i), 'All');

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByText(/edit sale — s1/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jon Smyth')).toBeInTheDocument();
  });

  it('saving the edit form calls onUpdateSale with the corrected fields, including status', async () => {
    const user = userEvent.setup();
    const onUpdateSale = vi.fn();
    setup([sale({ id: 'S1', customerName: 'Jon Smyth', status: 'Pending' })], { onUpdateSale });

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameInput = screen.getByDisplayValue('Jon Smyth');
    await user.clear(nameInput);
    await user.type(nameInput, 'John Smith');
    await user.selectOptions(screen.getByLabelText(/sale status/i), 'Rejected');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onUpdateSale).toHaveBeenCalledWith('S1', expect.objectContaining({ customerName: 'John Smith', status: 'Rejected' }));
  });

  it('a Supervisor has no Edit button on any sale', () => {
    setup([sale({ id: 'S1' })], { currentUser: SUPERVISOR });
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });
});
