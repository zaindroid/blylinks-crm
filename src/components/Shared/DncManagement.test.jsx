import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DncManagement from './DncManagement';
import * as dncApi from '../../api/dnc';

vi.mock('../../api/dnc');

const SUMMARY = [
  { campaignId: 'camp_a', campaignName: 'Campaign A', count: 2 },
  { campaignId: 'camp_b', campaignName: 'Campaign B', count: 0 }
];
const ENTRY = { id: 'dnc_1', campaignId: 'camp_a', phone: '0300-1112222', note: 'asked to be removed', addedBy: 'Boss', createdAt: '2026-03-01T10:00:00.000Z' };

const fileOf = (text, name = 'numbers.csv') => new File([text], name, { type: 'text/csv' });

describe('DncManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dncApi.fetchDncSummary.mockResolvedValue(SUMMARY);
    dncApi.fetchDncEntries.mockResolvedValue({ total: 1, entries: [ENTRY] });
    dncApi.addDncEntry.mockResolvedValue(ENTRY);
    dncApi.bulkAddDnc.mockResolvedValue({ received: 3, added: 2, duplicates: 1, invalid: 0, invalidSamples: [] });
    dncApi.deleteDncEntry.mockResolvedValue({ status: 'deleted' });
  });

  it('shows a tab per campaign with its count, and the numbers on the selected list', async () => {
    render(<DncManagement />);
    expect(await screen.findByRole('tab', { name: /campaign a\s*2/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /campaign b\s*0/i })).toBeInTheDocument();
    expect(await screen.findByText('0300-1112222')).toBeInTheDocument();
    expect(dncApi.fetchDncEntries).toHaveBeenCalledWith('camp_a', expect.objectContaining({ limit: 50, offset: 0 }));
  });

  it('switching campaign loads that campaign\'s own list', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    dncApi.fetchDncEntries.mockResolvedValue({ total: 0, entries: [] });

    await user.click(screen.getByRole('tab', { name: /campaign b/i }));
    await waitFor(() => expect(dncApi.fetchDncEntries).toHaveBeenLastCalledWith('camp_b', expect.anything()));
    expect(await screen.findByText(/no numbers on this list yet/i)).toBeInTheDocument();
  });

  it('adds a single number (with a note) to the selected campaign', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.type(screen.getByLabelText('Phone number', { selector: '#dnc-add-phone' }), '0321 5550100');
    await user.type(screen.getByLabelText(/note/i), 'complaint');
    await user.click(screen.getByRole('button', { name: /add to dnc/i }));

    await waitFor(() => expect(dncApi.addDncEntry).toHaveBeenCalledWith('camp_a', '0321 5550100', 'complaint'));
    expect(await screen.findByText(/added to the campaign a dnc list/i)).toBeInTheDocument();
  });

  it('shows the server\'s reason when a number cannot be added (e.g. already listed)', async () => {
    dncApi.addDncEntry.mockRejectedValue(new Error('That number is already on this campaign\'s DNC list.'));
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    await user.type(screen.getByLabelText('Phone number', { selector: '#dnc-add-phone' }), '03001112222');
    await user.click(screen.getByRole('button', { name: /add to dnc/i }));
    expect(await screen.findByText(/already on this campaign/i)).toBeInTheDocument();
  });

  it('uploads a file: previews how many numbers were found, then imports them into the selected campaign', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [fileOf('phone\n03001111111\n03002222222\n03003333333\n')] } });
    expect(await screen.findByText(/numbers found in numbers\.csv/i)).toBeInTheDocument();
    expect(dncApi.bulkAddDnc).not.toHaveBeenCalled(); // nothing is imported until confirmed

    await user.click(screen.getByRole('button', { name: /import to campaign a/i }));
    await waitFor(() => expect(dncApi.bulkAddDnc).toHaveBeenCalledWith('camp_a', ['03001111111', '03002222222', '03003333333']));
    expect(await screen.findByText(/imported 2 new numbers/i)).toBeInTheDocument();
    expect(screen.getByText(/1 were already on the list/i)).toBeInTheDocument();
  });

  it('refuses a file with no phone numbers, and does not offer to import it', async () => {
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [fileOf('name,city\nAli,Lahore\n', 'people.csv')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no phone numbers were found/i);
    expect(screen.queryByRole('button', { name: /^import to/i })).not.toBeInTheDocument();
  });

  it('refuses a file larger than the limit before reading it', async () => {
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    const huge = new File(['x'], 'huge.csv', { type: 'text/csv' });
    Object.defineProperty(huge, 'size', { value: 5 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [huge] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i);
  });

  it('removes a number from the list', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await user.click(await screen.findByLabelText(/remove 0300-1112222 from the dnc list/i));
    await waitFor(() => expect(dncApi.deleteDncEntry).toHaveBeenCalledWith('dnc_1'));
  });

  it('searches the list (debounced) and loads more when there are more than one page', async () => {
    const user = userEvent.setup();
    dncApi.fetchDncEntries.mockResolvedValue({ total: 120, entries: [ENTRY] });
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByRole('button', { name: /load more \(119 remaining\)/i }));
    await waitFor(() => expect(dncApi.fetchDncEntries).toHaveBeenLastCalledWith('camp_a', expect.objectContaining({ offset: 1 })));

    await user.type(screen.getByLabelText(/search this dnc list/i), '0300');
    await waitFor(() => expect(dncApi.fetchDncEntries).toHaveBeenLastCalledWith('camp_a', expect.objectContaining({ q: '0300', offset: 0 })));
  });

  it('includes the check tool so an Admin/Supervisor can also look a number up', async () => {
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    expect(screen.getByRole('button', { name: /search campaign a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search campaign b/i })).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    dncApi.fetchDncSummary.mockRejectedValue(new Error('You do not have access'));
    render(<DncManagement />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/you do not have access/i);
  });
});
