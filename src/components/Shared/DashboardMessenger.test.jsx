import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardMessenger from './DashboardMessenger';
import { ChatContext } from '../Chat/ChatContext';
import { renderWithChat, chatValue, ME, OTHER } from '../../test/chatTestUtils';

const messenger = () => <DashboardMessenger currentUser={ME} users={[OTHER]} onSendMessage={vi.fn()} />;

describe('DashboardMessenger', () => {
  it('starts expanded (not a collapsed bubble) -- it is meant to be always visible while on the dashboard', async () => {
    renderWithChat(messenger());
    expect(await screen.findByText('Team Messenger')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /conversations/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it('collapses to a bubble when minimized, and can be re-expanded', async () => {
    const user = userEvent.setup();
    renderWithChat(messenger());
    await user.click(screen.getByLabelText(/minimize messenger/i));
    const bubble = await screen.findByRole('button', { name: /team messenger/i });
    await user.click(bubble);
    expect(await screen.findByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it('shows the total unread count on the collapsed bubble', async () => {
    const user = userEvent.setup();
    renderWithChat(messenger(), { totalUnread: 5, unreadByChannel: { announcements: 5 } });
    await user.click(screen.getByLabelText(/minimize messenger/i));
    expect(await screen.findByLabelText('5 unread')).toBeInTheDocument();
  });

  it('a notification click aimed at it re-expands a minimized messenger and opens that conversation', async () => {
    const user = userEvent.setup();
    const base = chatValue();
    const { rerender } = render(<ChatContext.Provider value={base}>{messenger()}</ChatContext.Provider>);
    await user.click(screen.getByLabelText(/minimize messenger/i));
    expect(screen.queryByPlaceholderText(/message/i)).not.toBeInTheDocument();

    const withFocus = { ...base, focusRequest: { channel: 'general-lounge', target: 'inline', nonce: 'x1' } };
    rerender(<ChatContext.Provider value={withFocus}>{messenger()}</ChatContext.Provider>);
    expect(await screen.findByPlaceholderText(/message sales lounge/i)).toBeInTheDocument();
  });
});
