import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnreadTracker } from './useUnreadTracker';

const msg = (id, channel, senderId, createdAt) => ({ id, channel, senderId, createdAt });
const T = (n) => new Date(Date.UTC(2026, 0, 1, 10, n)).toISOString();

describe('useUnreadTracker', () => {
  beforeEach(() => localStorage.clear());

  it('counts nothing until the first real fetch has landed', () => {
    const { result } = renderHook(() => useUnreadTracker('me', [msg('1', 'g', 'them', T(1))], false));
    expect(result.current.totalUnread).toBe(0);
  });

  it('treats existing history as read on first ever load, then counts only newer messages from others', () => {
    let messages = [msg('1', 'g', 'them', T(1)), msg('2', 'g', 'them', T(2))];
    const { result, rerender } = renderHook(() => useUnreadTracker('me', messages, true));
    expect(result.current.totalUnread).toBe(0);

    messages = [...messages, msg('3', 'g', 'them', T(3)), msg('4', 'dm:a|b', 'them', T(4))];
    rerender();
    expect(result.current.unreadByChannel).toEqual({ g: 1, 'dm:a|b': 1 });
    expect(result.current.totalUnread).toBe(2);
  });

  it('never counts my own messages', () => {
    let messages = [msg('1', 'g', 'them', T(1))];
    const { result, rerender } = renderHook(() => useUnreadTracker('me', messages, true));
    messages = [...messages, msg('2', 'g', 'me', T(2))];
    rerender();
    expect(result.current.totalUnread).toBe(0);
  });

  it('markRead clears just that conversation, and only up to what has actually arrived', () => {
    let messages = [msg('1', 'g', 'them', T(1))];
    const { result, rerender } = renderHook(() => useUnreadTracker('me', messages, true));
    messages = [...messages, msg('2', 'g', 'them', T(2)), msg('3', 'dm:a|b', 'them', T(3))];
    rerender();
    expect(result.current.totalUnread).toBe(2);

    act(() => result.current.markRead('g'));
    expect(result.current.unreadByChannel).toEqual({ 'dm:a|b': 1 });

    // a message that arrives after the mark is unread again
    messages = [...messages, msg('4', 'g', 'them', T(5))];
    rerender();
    expect(result.current.unreadByChannel).toEqual({ g: 1, 'dm:a|b': 1 });
  });

  it('survives a reload: messages that arrived while logged out are still unread next session', () => {
    let messages = [msg('1', 'g', 'them', T(1))];
    const first = renderHook(() => useUnreadTracker('me', messages, true));
    expect(first.result.current.totalUnread).toBe(0);
    first.unmount();

    // while away someone writes; user comes back (new mount, same browser storage)
    messages = [msg('1', 'g', 'them', T(1)), msg('2', 'g', 'them', T(9))];
    const second = renderHook(() => useUnreadTracker('me', messages, true));
    expect(second.result.current.unreadByChannel).toEqual({ g: 1 });
  });

  it('keeps read state separate per user on the same browser', () => {
    let messages = [msg('1', 'g', 'x', T(1))];
    const a = renderHook(() => useUnreadTracker('userA', messages, true));
    messages = [...messages, msg('2', 'g', 'x', T(2))];
    a.rerender();
    act(() => a.result.current.markRead('g'));
    expect(a.result.current.totalUnread).toBe(0);
    a.unmount();

    // userB's baseline is their own first load, so g's later message is unread for them
    const bFirst = renderHook(() => useUnreadTracker('userB', [msg('1', 'g', 'x', T(1))], true));
    bFirst.unmount();
    const b = renderHook(() => useUnreadTracker('userB', messages, true));
    expect(b.result.current.unreadByChannel).toEqual({ g: 1 });
  });
});
