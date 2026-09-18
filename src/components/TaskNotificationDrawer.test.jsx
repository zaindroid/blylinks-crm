import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskNotificationDrawer from './TaskNotificationDrawer';

vi.mock('../utils/sound', () => ({ playBlylinksTone: vi.fn() }));

const base = { callbacks: [], attendanceStatus: 'Clocked Out', onClockAction: vi.fn(), onDismissNotification: vi.fn() };

describe('TaskNotificationDrawer toast', () => {
  it('clicking a message notification opens that conversation and hides the toast', async () => {
    const onOpenNotification = vi.fn();
    const notif = { title: 'New message from Agent Two', message: 'hey', type: 'message', channel: 'dm:a|b' };
    const user = userEvent.setup();
    render(<TaskNotificationDrawer {...base} latestNotification={notif} onOpenNotification={onOpenNotification} />);

    await user.click(await screen.findByRole('button', { name: /new message from agent two/i }));
    expect(onOpenNotification).toHaveBeenCalledWith(notif);
    expect(screen.queryByText('hey')).not.toBeInTheDocument();
  });

  it('is keyboard-activatable', async () => {
    const onOpenNotification = vi.fn();
    const notif = { title: 'New message from X', message: 'yo', type: 'message', channel: 'announcements' };
    const user = userEvent.setup();
    render(<TaskNotificationDrawer {...base} latestNotification={notif} onOpenNotification={onOpenNotification} />);
    (await screen.findByRole('button', { name: /new message from x/i })).focus();
    await user.keyboard('{Enter}');
    expect(onOpenNotification).toHaveBeenCalledWith(notif);
  });

  it('the dismiss button closes the toast without opening the conversation', async () => {
    const onOpenNotification = vi.fn();
    const notif = { title: 'New message from X', message: 'yo', type: 'message', channel: 'announcements' };
    const user = userEvent.setup();
    render(<TaskNotificationDrawer {...base} latestNotification={notif} onOpenNotification={onOpenNotification} />);
    await user.click(await screen.findByLabelText(/dismiss notification/i));
    expect(onOpenNotification).not.toHaveBeenCalled();
    expect(screen.queryByText('yo')).not.toBeInTheDocument();
  });

  it('non-message notifications (e.g. sale approved) are plain, not clickable', async () => {
    const onOpenNotification = vi.fn();
    const notif = { title: 'Sale Approved', message: 'SALE-1234 approved', type: 'success' };
    render(<TaskNotificationDrawer {...base} latestNotification={notif} onOpenNotification={onOpenNotification} />);
    expect(await screen.findByText('Sale Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sale approved/i })).not.toBeInTheDocument();
  });
});
