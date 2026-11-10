import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWindow from './ChatWindow';
import { renderWithChat, ME, OTHER, GROUPS, dmWithOther, msg } from '../../test/chatTestUtils';
import * as messagesApi from '../../api/messages';

vi.mock('../../api/messages');

const setup = (ctx, props = {}) =>
  renderWithChat(<ChatWindow variant="inline" currentUser={ME} users={[OTHER]} onSendMessage={vi.fn()} {...props} />, ctx);

describe('ChatWindow sidebar', () => {
  it('lists every group and every active contact', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: /conversations/i });
    expect(nav).toHaveTextContent('Announcements');
    expect(nav).toHaveTextContent('Sales Lounge');
    expect(nav).toHaveTextContent('Agent Two');
  });

  it('does not list inactive users or yourself as contacts', () => {
    setup({}, { users: [ME, { ...OTHER, id: 'usr_gone', name: 'Removed Person', status: 'Inactive' }, OTHER] });
    const nav = screen.getByRole('navigation', { name: /conversations/i });
    expect(nav).not.toHaveTextContent('Removed Person');
    expect(nav).not.toHaveTextContent('Agent Smith');
  });

  it('shows an unread badge on each group and contact that has unread messages, and none on the rest', () => {
    setup({ unreadByChannel: { 'general-lounge': 3, [`dm:${dmWithOther}`]: 1 } });
    expect(screen.getByRole('button', { name: 'Sales Lounge, 3 unread messages' })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Agent Two, 1 unread message' })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Announcements' })).not.toHaveTextContent(/\d/);
  });

  it('caps very large counts at 99+', () => {
    setup({ unreadByChannel: { 'general-lounge': 250 } });
    expect(screen.getByRole('button', { name: /Sales Lounge, 250 unread/ })).toHaveTextContent('99+');
  });

  it('opens on the first conversation with unread messages, and marks it read', async () => {
    const { value } = setup({ unreadByChannel: { 'general-lounge': 2 } });
    expect(await screen.findByPlaceholderText(/message sales lounge/i)).toBeInTheDocument();
    await waitFor(() => expect(value.markRead).toHaveBeenCalledWith('general-lounge'));
  });

  it('opens on the first group when nothing is unread', async () => {
    setup();
    expect(await screen.findByPlaceholderText(/message announcements/i)).toBeInTheDocument();
  });

  it('clicking a conversation shows its messages and marks it read', async () => {
    const user = userEvent.setup();
    const messages = [
      msg({ channel: 'announcements', text: 'in announcements' }),
      msg({ channel: `dm:${dmWithOther}`, text: 'private hello' })
    ];
    const { value } = setup({ messages, unreadByChannel: { [`dm:${dmWithOther}`]: 1 }, groups: GROUPS });

    await user.click(screen.getByRole('button', { name: /Agent Two/ }));
    expect(screen.getByText('private hello')).toBeInTheDocument();
    expect(screen.queryByText('in announcements')).not.toBeInTheDocument();
    await waitFor(() => expect(value.markRead).toHaveBeenCalledWith(`dm:${dmWithOther}`));
  });

  it('reports which conversation is on screen, and that nothing is once it unmounts', async () => {
    const { value, unmount } = setup();
    await waitFor(() => expect(value.reportViewing).toHaveBeenCalledWith('inline', 'announcements'));
    unmount();
    expect(value.reportViewing).toHaveBeenLastCalledWith('inline', null);
  });

  it('does not report a conversation as viewed (or mark it read) when the window is not visible', async () => {
    const { value } = setup({ unreadByChannel: { announcements: 4 } }, { visible: false });
    await waitFor(() => expect(value.reportViewing).toHaveBeenCalledWith('inline', null));
    expect(value.markRead).not.toHaveBeenCalled();
  });

  it('shows the hint when the user belongs to no groups', () => {
    setup({ groups: [] });
    expect(screen.getByText(/no group channels yet/i)).toBeInTheDocument();
  });
});

describe('ChatWindow focus requests (clicking a notification)', () => {
  it('selects the requested DM conversation and consumes the request', async () => {
    const focusRequest = { channel: `dm:${dmWithOther}`, target: 'inline', nonce: 'n1' };
    const { value } = setup({ focusRequest });
    expect(await screen.findByPlaceholderText(/message agent two/i)).toBeInTheDocument();
    expect(value.consumeFocus).toHaveBeenCalledWith('n1');
  });

  it('ignores requests aimed at the other chat window', async () => {
    const focusRequest = { channel: 'general-lounge', target: 'drawer', nonce: 'n2' };
    const { value } = setup({ focusRequest });
    expect(await screen.findByPlaceholderText(/message announcements/i)).toBeInTheDocument();
    expect(value.consumeFocus).not.toHaveBeenCalled();
  });
});

describe('ChatWindow sending', () => {
  it('blocks sending with a clear error when no conversation exists to send to', async () => {
    const onSendMessage = vi.fn();
    const user = userEvent.setup();
    setup({ groups: [] }, { users: [], onSendMessage });
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, 'hello?');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/before sending/i)).toBeInTheDocument();
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(input.value).toBe('hello?');
  });

  it('sends to the selected group', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({}, { onSendMessage });
    await user.type(await screen.findByPlaceholderText(/message announcements/i), 'hello team');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith({ channel: 'announcements', text: 'hello team' }));
  });

  it('shows the server error and keeps the typed text when sending fails', async () => {
    const onSendMessage = vi.fn().mockRejectedValue(new Error('You are not a member of this group'));
    const user = userEvent.setup();
    setup({}, { onSendMessage });
    const input = await screen.findByPlaceholderText(/message announcements/i);
    await user.type(input, 'hello team');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/you are not a member of this group/i)).toBeInTheDocument();
    expect(input.value).toBe('hello team');
  });

  it('sending to a contact includes the recipientId', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({}, { onSendMessage });
    await user.click(screen.getByRole('button', { name: /Agent Two/ }));
    await user.type(await screen.findByPlaceholderText(/message agent two/i), 'hey');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith({ channel: `dm:${dmWithOther}`, text: 'hey', recipientId: OTHER.id }));
  });
});

describe('ChatWindow file sharing', () => {
  it('attaching a file shows it pending, and sending includes it (text is optional)', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({}, { onSendMessage });
    await screen.findByPlaceholderText(/message announcements/i);

    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/attach a file to/i), file);

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'announcements',
      text: '',
      fileName: 'notes.txt',
      fileType: 'text/plain'
    })));
    const sent = onSendMessage.mock.calls[0][0];
    expect(typeof sent.fileData).toBe('string');
    expect(sent.fileData.length).toBeGreaterThan(0);
  });

  it('rejects a file over the 5MB cap client-side, without attaching it', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByPlaceholderText(/message announcements/i);

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.bin', { type: 'application/octet-stream' });
    await user.upload(screen.getByLabelText(/attach a file to/i), bigFile);

    expect(await screen.findByText(/too large to share/i)).toBeInTheDocument();
    expect(screen.queryByText('big.bin')).not.toBeInTheDocument();
  });

  it('removing a pending file clears it before sending', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByPlaceholderText(/message announcements/i);

    const file = new File(['x'], 'doc.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/attach a file to/i), file);
    await screen.findByText('doc.txt');

    await user.click(screen.getByRole('button', { name: /remove attached file/i }));
    expect(screen.queryByText('doc.txt')).not.toBeInTheDocument();
  });

  it('shows an attachment chip on a received message, which opens the file on click', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['content']);
    messagesApi.fetchAttachmentBlob.mockResolvedValue(blob);
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

    const messages = [msg({ channel: 'announcements', text: '', hasAttachment: true, fileName: 'report.pdf', fileType: 'application/pdf', fileSize: 20480 })];
    setup({ messages });

    const chip = await screen.findByRole('button', { name: /report\.pdf/i });
    expect(chip).toHaveTextContent('20.0 KB');
    await user.click(chip);

    await waitFor(() => expect(messagesApi.fetchAttachmentBlob).toHaveBeenCalledWith(messages[0].id));
    expect(openSpy).toHaveBeenCalledWith('blob:fake-url', '_blank', 'noopener');
  });
});
