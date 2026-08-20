import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardMessenger from './DashboardMessenger';
import * as messagesApi from '../../api/messages';
import * as messageGroupsApi from '../../api/messageGroups';

vi.mock('../../api/messages');
vi.mock('../../api/messageGroups');
vi.mock('../../utils/sound', () => ({ playBlylinksTone: vi.fn() }));
vi.mock('../../utils/notifications', () => ({ showDesktopNotification: vi.fn() }));

const CURRENT_USER = { id: 'usr_agent_1', name: 'Agent Smith' };
const OTHER_USER = { id: 'usr_agent_2', name: 'Agent Two', status: 'Active' };
const ONE_GROUP = [{ id: 'announcements', name: 'Announcements' }];

describe('DashboardMessenger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messagesApi.fetchMessages.mockResolvedValue([]);
  });

  it('starts expanded (not a collapsed bubble) -- it is meant to be always visible while on the dashboard', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue([]);
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[]} onSendMessage={vi.fn()} />);
    expect(await screen.findByText('Team Messenger')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it('collapses to a bubble when minimized, and can be re-expanded', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[]} onSendMessage={vi.fn()} />);
    await screen.findByText('Team Messenger');

    await user.click(screen.getByLabelText(/minimize messenger/i));
    const bubble = await screen.findByRole('button', { name: /team messenger/i });
    expect(bubble).toBeInTheDocument();

    await user.click(bubble);
    expect(await screen.findByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it('shows a hint instead of channel tabs when the user has no group memberships', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue([]);
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[]} onSendMessage={vi.fn()} />);
    expect(await screen.findByText(/no group channels yet/i)).toBeInTheDocument();
  });

  it('blocks sending with a clear error when no channel/DM is selected -- the exact bug that was silently failing before', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue([]);
    const onSendMessage = vi.fn();
    const user = userEvent.setup();
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[OTHER_USER]} onSendMessage={onSendMessage} />);

    const input = await screen.findByPlaceholderText(/message/i);
    await user.type(input, 'hello?');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/before sending/i)).toBeInTheDocument();
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(input.value).toBe('hello?'); // text is preserved, not silently discarded
  });

  it('sends successfully once a group is selected', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue(ONE_GROUP);
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[OTHER_USER]} onSendMessage={onSendMessage} />);

    await screen.findByText('Announcements');
    const input = await screen.findByPlaceholderText(/message announcements/i);
    await user.type(input, 'hello team');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith({ channel: 'announcements', text: 'hello team' }));
  });

  it('shows the real server error (not a silent failure) when the send API call rejects', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue(ONE_GROUP);
    const onSendMessage = vi.fn().mockRejectedValue(new Error('You are not a member of this group'));
    const user = userEvent.setup();
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[OTHER_USER]} onSendMessage={onSendMessage} />);

    const input = await screen.findByPlaceholderText(/message announcements/i);
    await user.type(input, 'hello team');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/you are not a member of this group/i)).toBeInTheDocument();
    expect(input.value).toBe('hello team'); // preserved on failure, not wiped
  });

  it('selecting a Direct Message contact includes recipientId when sending', async () => {
    messageGroupsApi.fetchMessageGroups.mockResolvedValue([]);
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DashboardMessenger currentUser={CURRENT_USER} users={[OTHER_USER]} onSendMessage={onSendMessage} />);

    const select = await screen.findByDisplayValue(/direct message/i);
    await user.selectOptions(select, OTHER_USER.id);

    const input = await screen.findByPlaceholderText(/message agent two/i);
    await user.type(input, 'hey');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const expectedChannel = ['usr_agent_1', 'usr_agent_2'].sort().join('|');
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith({
      channel: `dm:${expectedChannel}`,
      text: 'hey',
      recipientId: OTHER_USER.id
    }));
  });
});
