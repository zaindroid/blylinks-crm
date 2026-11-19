import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckLead from './CheckLead';
import * as checkLeadApi from '../../api/checkLead';

vi.mock('../../api/checkLead');

describe('CheckLead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not search until a number is entered and submitted', () => {
    render(<CheckLead />);
    expect(checkLeadApi.checkLead).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /check number/i })).toBeDisabled();
  });

  it('shows the empty state when nothing is found', async () => {
    const user = userEvent.setup();
    checkLeadApi.checkLead.mockResolvedValue({ sales: [], leads: [], callbacks: [] });
    render(<CheckLead />);

    await user.type(screen.getByLabelText(/phone number to check/i), '5550000000');
    await user.click(screen.getByRole('button', { name: /check number/i }));

    expect(await screen.findByText(/no activity found for this number/i)).toBeInTheDocument();
    expect(checkLeadApi.checkLead).toHaveBeenCalledWith('5550000000');
  });

  it('shows matching sales, leads and callbacks grouped into their own sections', async () => {
    const user = userEvent.setup();
    checkLeadApi.checkLead.mockResolvedValue({
      sales: [{ id: 'SALE-1', customerName: 'Jane Doe', phone: '5551234567', phone2: null, campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Approved', amount: 1000, date: '9/1/2026' }],
      leads: [{ id: 'lead_1', name: 'Jane Doe', phone: '5551234567', campaignId: 'c2', projectName: 'Gas', assignedAgentId: 'a2', assignedAgentName: 'Bilal Raza', status: 'New', lastContact: '2026-09-01' }],
      callbacks: [{ id: 'cb_1', customerName: 'Jane Doe', phone: '5551234567', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', status: 'Pending', dueDate: '2026-09-05T00:00:00.000Z' }]
    });
    render(<CheckLead />);

    await user.type(screen.getByLabelText(/phone number to check/i), '5551234567');
    await user.click(screen.getByRole('button', { name: /check number/i }));

    const salesSection = (await screen.findByText(/sales \(1\)/i)).closest('.card');
    expect(within(salesSection).getByText('SALE-1')).toBeInTheDocument();
    expect(within(salesSection).getByText('Solar')).toBeInTheDocument();

    const leadsSection = screen.getByText(/leads \(1\)/i).closest('.card');
    expect(within(leadsSection).getByText('Bilal Raza')).toBeInTheDocument();

    const callbacksSection = screen.getByText(/callbacks \(1\)/i).closest('.card');
    expect(within(callbacksSection).getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows the server error instead of failing silently', async () => {
    const user = userEvent.setup();
    checkLeadApi.checkLead.mockRejectedValue(new Error('phone is required and must look like a real phone number'));
    render(<CheckLead />);

    await user.type(screen.getByLabelText(/phone number to check/i), '123');
    await user.click(screen.getByRole('button', { name: /check number/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/must look like a real phone number/i);
  });
});
