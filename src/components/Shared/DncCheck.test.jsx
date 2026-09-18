import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DncCheck from './DncCheck';
import * as dncApi from '../../api/dnc';

vi.mock('../../api/dnc');

const CAMPAIGNS = [{ id: 'camp_a', name: 'Campaign A' }, { id: 'camp_b', name: 'Campaign B' }];

describe('DncCheck (agent tool)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has a search box and one Search button per campaign the agent works on', () => {
    render(<DncCheck projects={CAMPAIGNS} />);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search campaign a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search campaign b/i })).toBeInTheDocument();
  });

  it('the buttons stay disabled until a number is typed', async () => {
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);
    expect(screen.getByRole('button', { name: /search campaign a/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/phone number/i), '0300');
    expect(screen.getByRole('button', { name: /search campaign a/i })).toBeEnabled();
  });

  it('Search A checks against campaign A only and warns when the number is on the list', async () => {
    dncApi.checkDnc.mockResolvedValue({ found: true, campaignId: 'camp_a', campaignName: 'Campaign A' });
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);

    await user.type(screen.getByLabelText(/phone number/i), '0300 1234567');
    await user.click(screen.getByRole('button', { name: /search campaign a/i }));

    expect(dncApi.checkDnc).toHaveBeenCalledWith('camp_a', '0300 1234567');
    expect(await screen.findByText(/do not call/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/campaign a/i);
  });

  it('Search B checks against campaign B and reports a clean number as OK to call', async () => {
    dncApi.checkDnc.mockResolvedValue({ found: false, campaignId: 'camp_b', campaignName: 'Campaign B' });
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);

    await user.type(screen.getByLabelText(/phone number/i), '03009998888');
    await user.click(screen.getByRole('button', { name: /search campaign b/i }));

    expect(dncApi.checkDnc).toHaveBeenCalledWith('camp_b', '03009998888');
    expect(await screen.findByText(/ok to call/i)).toBeInTheDocument();
  });

  it('shows the server\'s message when the number is invalid, instead of a misleading "clear" result', async () => {
    dncApi.checkDnc.mockRejectedValue(new Error('Enter a valid phone number (7 to 15 digits).'));
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);
    await user.type(screen.getByLabelText(/phone number/i), '12');
    await user.click(screen.getByRole('button', { name: /search campaign a/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid phone number/i);
    expect(screen.queryByText(/ok to call/i)).not.toBeInTheDocument();
  });

  it('editing the number clears the previous result so a stale answer is never shown for a new number', async () => {
    dncApi.checkDnc.mockResolvedValue({ found: true, campaignId: 'camp_a', campaignName: 'Campaign A' });
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);
    await user.type(screen.getByLabelText(/phone number/i), '03001234567');
    await user.click(screen.getByRole('button', { name: /search campaign a/i }));
    await screen.findByText(/do not call/i);

    await user.type(screen.getByLabelText(/phone number/i), '9');
    expect(screen.queryByText(/do not call/i)).not.toBeInTheDocument();
  });

  it('keeps a short list of recent checks', async () => {
    dncApi.checkDnc.mockResolvedValueOnce({ found: true, campaignName: 'Campaign A' }).mockResolvedValueOnce({ found: false, campaignName: 'Campaign B' });
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);
    const input = screen.getByLabelText(/phone number/i);
    await user.type(input, '03001111111');
    await user.click(screen.getByRole('button', { name: /search campaign a/i }));
    await screen.findByText(/do not call/i);
    await user.clear(input);
    await user.type(input, '03002222222');
    await user.click(screen.getByRole('button', { name: /search campaign b/i }));
    await screen.findByText(/ok to call/i);

    expect(screen.getByText('Your recent checks')).toBeInTheDocument();
    expect(screen.getByText('On DNC')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('with a single campaign, pressing Enter searches it', async () => {
    dncApi.checkDnc.mockResolvedValue({ found: false, campaignName: 'Campaign A' });
    const user = userEvent.setup();
    render(<DncCheck projects={[CAMPAIGNS[0]]} />);
    await user.type(screen.getByLabelText(/phone number/i), '03001234567{Enter}');
    await waitFor(() => expect(dncApi.checkDnc).toHaveBeenCalledWith('camp_a', '03001234567'));
  });

  it('with several campaigns, Enter alone does NOT guess which list to search', async () => {
    const user = userEvent.setup();
    render(<DncCheck projects={CAMPAIGNS} />);
    await user.type(screen.getByLabelText(/phone number/i), '03001234567{Enter}');
    expect(dncApi.checkDnc).not.toHaveBeenCalled();
  });

  it('explains when the agent has no campaign', () => {
    render(<DncCheck projects={[]} />);
    expect(screen.getByText(/not assigned to any campaign/i)).toBeInTheDocument();
  });
});
