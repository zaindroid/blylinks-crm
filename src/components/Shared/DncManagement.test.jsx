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
const ENTRY = { id: 'dnc_1', campaignId: 'camp_a', phone: '0300-1112222', note: 'asked to be removed', fields: {}, addedBy: 'Boss', createdAt: '2026-03-01T10:00:00.000Z' };
const ENTRY_2 = { id: 'dnc_2', campaignId: 'camp_a', phone: '0321-5550100', note: '', fields: {}, addedBy: 'Boss', createdAt: '2026-03-02T10:00:00.000Z' };

const fileOf = (text, name = 'numbers.csv') => new File([text], name, { type: 'text/csv' });
// What the uploader sends for one parsed row of a sheet.
const row = (phone, note = '', fields = {}) => ({ phone, note, fields });

describe('DncManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dncApi.fetchDncSummary.mockResolvedValue(SUMMARY);
    dncApi.fetchDncEntries.mockResolvedValue({ total: 1, entries: [ENTRY] });
    dncApi.addDncEntry.mockResolvedValue(ENTRY);
    dncApi.bulkAddDnc.mockResolvedValue({ received: 3, added: 2, duplicates: 1, enriched: 0, invalid: 0, invalidSamples: [] });
    dncApi.updateDncEntry.mockResolvedValue(ENTRY);
    dncApi.deleteDncEntry.mockResolvedValue({ status: 'deleted' });
    dncApi.bulkDeleteDnc.mockResolvedValue({ status: 'deleted', deleted: 2 });
    dncApi.clearDncList.mockResolvedValue({ status: 'deleted', deleted: 1, campaignId: 'camp_a' });
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
    expect(await screen.findByText(/0321 5550100 added/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() => expect(dncApi.bulkAddDnc).toHaveBeenCalledWith('camp_a', [
      row('03001111111'), row('03002222222'), row('03003333333')
    ]));
    expect(await screen.findByText(/2 added/i)).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate/i)).toBeInTheDocument();
  });

  it('keeps the other columns of the sheet and says which column the numbers came from', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    const csv = 'name,phone,city,remarks\nAli,0300 1234567,Lahore,called twice\n';
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [fileOf(csv)] } });

    expect(await screen.findByText(/column:/i)).toBeInTheDocument();
    expect(screen.getByText(/also: name, city, remarks/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() => expect(dncApi.bulkAddDnc).toHaveBeenCalledWith('camp_a', [
      row('0300 1234567', 'called twice', { name: 'Ali', city: 'Lahore' })
    ]));
  });

  it('refuses a file with no phone numbers, and does not offer to import it', async () => {
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [fileOf('name,city\nAli,Lahore\n', 'people.csv')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no phone numbers were found/i);
    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
  });

  it('accepts a file far larger than the old 2 MB cap instead of refusing it', async () => {
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    const huge = fileOf('phone\n03001111111\n03002222222\n', 'huge.csv');
    Object.defineProperty(huge, 'size', { value: 40 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [huge] } });

    expect(await screen.findByText(/numbers found in huge\.csv/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends a big file in chunks, so no single request decides how large a file can be', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    // One more than the chunk size, so exactly two requests are expected: a full one and a remainder.
    const lines = ['phone'];
    for (let i = 0; i < 5001; i++) lines.push(`0300${String(i).padStart(7, '0')}`);
    fireEvent.change(screen.getByLabelText(/a \.csv or \.txt file/i), { target: { files: [fileOf(lines.join('\n'))] } });

    // The count sits in its own <strong>, so it is queried on its own rather than as part of the sentence.
    await screen.findByText(/numbers found in numbers\.csv/i);
    expect(screen.getByText('5,001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(dncApi.bulkAddDnc).toHaveBeenCalledTimes(2));
    expect(dncApi.bulkAddDnc.mock.calls[0][1]).toHaveLength(5000);
    expect(dncApi.bulkAddDnc.mock.calls[1][1]).toHaveLength(1);
  });

  it('shows the other columns a number was imported with', async () => {
    dncApi.fetchDncEntries.mockResolvedValue({
      total: 1,
      entries: [{ ...ENTRY, fields: { name: 'Ali Khan', city: 'Lahore' } }]
    });
    render(<DncManagement />);
    expect(await screen.findByText('Ali Khan')).toBeInTheDocument();
    expect(screen.getByText('Lahore')).toBeInTheDocument();
  });

  it('edits a listed number and its note', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText(/edit 0300-1112222/i));
    const numberField = screen.getByLabelText(/new number for 0300-1112222/i);
    await user.clear(numberField);
    await user.type(numberField, '0321 5550100');
    await user.clear(screen.getByLabelText(/new note for 0300-1112222/i));
    await user.type(screen.getByLabelText(/new note for 0300-1112222/i), 'wrong number');
    await user.click(screen.getByLabelText(/save changes to 0300-1112222/i));

    await waitFor(() => expect(dncApi.updateDncEntry).toHaveBeenCalledWith('dnc_1', '0321 5550100', 'wrong number'));
  });

  it('shows why an edit was refused (it would list the number twice)', async () => {
    dncApi.updateDncEntry.mockRejectedValue(new Error("That number is already on this campaign's DNC list."));
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText(/edit 0300-1112222/i));
    await user.click(screen.getByLabelText(/save changes to 0300-1112222/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already on this campaign/i);
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

  describe('batch selection and delete', () => {
  beforeEach(() => {
    dncApi.fetchDncEntries.mockResolvedValue({ total: 2, entries: [ENTRY, ENTRY_2] });
  });

  it('checking rows shows a bulk action bar with the count, and it disappears once cleared', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Select 0300-1112222'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Select 0321-5550100'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  it('"select all" checks every loaded row, and unchecking it clears them', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText('Select all loaded numbers'));
    expect(screen.getByLabelText('Select 0300-1112222')).toBeChecked();
    expect(screen.getByLabelText('Select 0321-5550100')).toBeChecked();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Select all loaded numbers'));
    expect(screen.getByLabelText('Select 0300-1112222')).not.toBeChecked();
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  it('deletes exactly the checked numbers for the selected campaign', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText('Select 0300-1112222'));
    await user.click(screen.getByLabelText('Select 0321-5550100'));
    await user.click(screen.getByRole('button', { name: /delete selected \(2\)/i }));

    await waitFor(() => expect(dncApi.bulkDeleteDnc).toHaveBeenCalledWith('camp_a', ['dnc_1', 'dnc_2']));
  });

  it('clears the selection and refreshes the list after a successful batch delete', async () => {
    dncApi.fetchDncEntries
      .mockResolvedValueOnce({ total: 2, entries: [ENTRY, ENTRY_2] })
      .mockResolvedValue({ total: 0, entries: [] });
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText('Select 0300-1112222'));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));

    await waitFor(() => expect(screen.queryByText(/selected/i)).not.toBeInTheDocument());
    expect(await screen.findByText(/no numbers on this list yet/i)).toBeInTheDocument();
  });

  it('shows the server\'s reason when a batch delete fails', async () => {
    dncApi.bulkDeleteDnc.mockRejectedValue(new Error('You do not have access to this campaign'));
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByLabelText('Select 0300-1112222'));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/you do not have access/i);
  });

  it('switching campaigns clears the selection', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');
    await user.click(screen.getByLabelText('Select 0300-1112222'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    dncApi.fetchDncEntries.mockResolvedValue({ total: 0, entries: [] });
    await user.click(screen.getByRole('tab', { name: /campaign b/i }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});

  describe('remove all', () => {
  it('asks for confirmation before removing everything, and does nothing on cancel', async () => {
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByRole('button', { name: /remove all/i }));
    const dialog = screen.getByRole('dialog', { name: /remove all numbers/i });
    expect(dialog).toHaveTextContent('1');
    expect(dialog).toHaveTextContent('Campaign A');
    expect(dncApi.clearDncList).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dncApi.clearDncList).not.toHaveBeenCalled();
  });

  it('clears the whole campaign list on confirmation', async () => {
    dncApi.fetchDncEntries
      .mockResolvedValueOnce({ total: 1, entries: [ENTRY] })
      .mockResolvedValue({ total: 0, entries: [] });
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByRole('button', { name: /remove all/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^remove all$/i }));

    await waitFor(() => expect(dncApi.clearDncList).toHaveBeenCalledWith('camp_a'));
    expect(await screen.findByText(/no numbers on this list yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is disabled when the list is already empty', async () => {
    dncApi.fetchDncEntries.mockResolvedValue({ total: 0, entries: [] });
    render(<DncManagement />);
    await screen.findByText(/no numbers on this list yet/i);
    expect(screen.getByRole('button', { name: /remove all/i })).toBeDisabled();
  });

  it('shows the server\'s reason when clearing fails, and keeps the dialog open', async () => {
    dncApi.clearDncList.mockRejectedValue(new Error('You do not have access to this campaign'));
    const user = userEvent.setup();
    render(<DncManagement />);
    await screen.findByText('0300-1112222');

    await user.click(screen.getByRole('button', { name: /remove all/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^remove all$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/you do not have access/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  });
});
