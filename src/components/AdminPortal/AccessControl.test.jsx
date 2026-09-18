import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessControl from './AccessControl';
import * as accessApi from '../../api/access';

vi.mock('../../api/access');

const base = { enabled: false, overrideActive: false, yourIp: '203.0.113.5', yourIpAllowed: false, entries: [] };
const withEntry = { ...base, yourIpAllowed: true, entries: [{ id: 'ip_1', cidr: '203.0.113.5', label: 'Office', createdAt: '2026-03-01T10:00:00.000Z' }] };

describe('AccessControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessApi.fetchAccess.mockResolvedValue(base);
  });

  it('shows the current state, the admin\'s own address, and whether it is allowed', async () => {
    render(<AccessControl />);
    expect(await screen.findByText(/restriction is off/i)).toBeInTheDocument();
    expect(screen.getByText('203.0.113.5')).toBeInTheDocument();
    expect(screen.getByText(/not on the list/i)).toBeInTheDocument();
    expect(screen.getByText(/can currently be opened from any network/i)).toBeInTheDocument();
  });

  it('adds an address or range with a label', async () => {
    accessApi.addAccessEntry.mockResolvedValue(withEntry);
    const user = userEvent.setup();
    render(<AccessControl />);
    await screen.findByText(/restriction is off/i);

    await user.type(screen.getByLabelText(/ip address or range/i), '203.0.113.0/24');
    await user.type(screen.getByLabelText(/label/i), 'Lahore office');
    await user.click(screen.getByRole('button', { name: /^allow$/i }));

    await waitFor(() => expect(accessApi.addAccessEntry).toHaveBeenCalledWith('203.0.113.0/24', 'Lahore office'));
    expect(await screen.findByText('Office')).toBeInTheDocument(); // list refreshed from the server's reply
  });

  it('"Add my current IP" adds the admin\'s own address in one click', async () => {
    accessApi.addAccessEntry.mockResolvedValue(withEntry);
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /add my current ip/i }));
    await waitFor(() => expect(accessApi.addAccessEntry).toHaveBeenCalledWith('203.0.113.5', expect.any(String)));
  });

  it('shows the server\'s reason when an entry is refused', async () => {
    accessApi.addAccessEntry.mockRejectedValue(new Error('That is not a valid IPv4 or IPv6 address.'));
    const user = userEvent.setup();
    render(<AccessControl />);
    await screen.findByText(/restriction is off/i);
    await user.type(screen.getByLabelText(/ip address or range/i), 'nonsense');
    await user.click(screen.getByRole('button', { name: /^allow$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid ipv4 or ipv6/i);
  });

  it('turning the restriction on asks for confirmation first, and explains the consequence', async () => {
    accessApi.fetchAccess.mockResolvedValue(withEntry);
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /turn restriction on/i }));

    expect(accessApi.setAccessEnabled).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /turn on ip restriction/i });
    expect(dialog).toHaveTextContent(/locked out/i);
    expect(dialog).toHaveTextContent(/will not be locked out/i);
  });

  it('confirming turns it on and shows the new state', async () => {
    accessApi.fetchAccess.mockResolvedValue(withEntry);
    accessApi.setAccessEnabled.mockResolvedValue({ ...withEntry, enabled: true });
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /turn restriction on/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /turn on restriction/i }));

    await waitFor(() => expect(accessApi.setAccessEnabled).toHaveBeenCalledWith(true));
    expect(await screen.findByText(/restriction is on/i)).toBeInTheDocument();
  });

  it('cancelling the confirmation changes nothing', async () => {
    accessApi.fetchAccess.mockResolvedValue(withEntry);
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /turn restriction on/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));
    expect(accessApi.setAccessEnabled).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('surfaces the server\'s lock-out protection instead of pretending it worked', async () => {
    accessApi.fetchAccess.mockResolvedValue(withEntry);
    accessApi.setAccessEnabled.mockRejectedValue(new Error('Your current IP address (203.0.113.5) is not on the list. Turning the restriction on now would lock you out, so add it first.'));
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /turn restriction on/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /turn on restriction/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/lock you out/i);
    expect(screen.getByText(/restriction is off/i)).toBeInTheDocument();
  });

  it('turning it off needs no confirmation (it can only let more people in)', async () => {
    accessApi.fetchAccess.mockResolvedValue({ ...withEntry, enabled: true });
    accessApi.setAccessEnabled.mockResolvedValue(withEntry);
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByRole('button', { name: /turn restriction off/i }));
    await waitFor(() => expect(accessApi.setAccessEnabled).toHaveBeenCalledWith(false));
  });

  it('removes an entry, and shows the reason when the server refuses (would lock the admin out)', async () => {
    accessApi.fetchAccess.mockResolvedValue({ ...withEntry, enabled: true });
    accessApi.removeAccessEntry.mockRejectedValue(new Error('Removing this entry would block your own current IP address.'));
    const user = userEvent.setup();
    render(<AccessControl />);
    await user.click(await screen.findByLabelText('Remove 203.0.113.5'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/block your own current ip/i);
    expect(screen.getByText('Office')).toBeInTheDocument(); // still listed
  });

  it('warns loudly when the emergency override is active', async () => {
    accessApi.fetchAccess.mockResolvedValue({ ...withEntry, enabled: true, overrideActive: true });
    render(<AccessControl />);
    expect(await screen.findByText(/emergency override is active/i)).toBeInTheDocument();
    expect(screen.getByText(/IP_RESTRICTION_DISABLED=true/)).toBeInTheDocument();
  });

  it('says so when the settings cannot be loaded', async () => {
    accessApi.fetchAccess.mockRejectedValue(new Error('Forbidden'));
    render(<AccessControl />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden/i);
  });
});
