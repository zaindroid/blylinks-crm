import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const storageKey = (userId) => `blylinks_chat_read_v1_${userId}`;

function load(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { baseline: parsed.baseline ?? null, channels: parsed.channels || {} };
    }
  } catch { /* corrupt or unavailable storage: start fresh */ }
  return { baseline: null, channels: {} };
}

function persist(userId, state) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(state)); } catch { /* private mode / quota: read state just won't survive a reload */ }
}

function timeOf(message) {
  const t = Date.parse(message.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

// Per-conversation unread counts, derived rather than accumulated: a message from
// someone else is "unread" if it is newer than the last time this user viewed that
// conversation. Deriving it (instead of incrementing a counter as messages arrive)
// means it survives a reload, and picks up messages that arrived while the user was
// logged out -- the case that made incoming DMs look like they never showed up.
//
// Read marks use the server's own message timestamps, never the browser clock, so
// clock skew between client and server can't hide or invent unread messages.
//
// `ready` must only turn true once the first real fetch has landed. The first time a
// user ever opens the app on this browser, everything already in history is treated
// as read (a baseline at the newest message) so they aren't greeted by "200 unread".
export function useUnreadTracker(userId, messages, ready) {
  const [readState, setReadState] = useState(() => (userId ? load(userId) : { baseline: null, channels: {} }));
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setReadState(userId ? load(userId) : { baseline: null, channels: {} });
  }, [userId]);

  useEffect(() => {
    if (!userId || !ready || readState.baseline !== null) return;
    const baseline = messages.reduce((max, m) => Math.max(max, timeOf(m)), 0);
    const next = { ...readState, baseline };
    persist(userId, next);
    setReadState(next);
  }, [userId, ready, readState, messages]);

  const unreadByChannel = useMemo(() => {
    const counts = {};
    if (!userId || readState.baseline === null) return counts;
    for (const m of messages) {
      if (m.senderId === userId) continue;
      const readUpTo = readState.channels[m.channel] ?? readState.baseline;
      if (timeOf(m) > readUpTo) counts[m.channel] = (counts[m.channel] || 0) + 1;
    }
    return counts;
  }, [userId, messages, readState]);

  const totalUnread = useMemo(
    () => Object.values(unreadByChannel).reduce((sum, n) => sum + n, 0),
    [unreadByChannel]
  );

  const markRead = useCallback((channel) => {
    if (!userId || !channel) return;
    const newest = messagesRef.current.reduce((max, m) => (m.channel === channel ? Math.max(max, timeOf(m)) : max), 0);
    setReadState(prev => {
      if ((prev.channels[channel] ?? 0) >= newest) return prev;
      const next = { ...prev, channels: { ...prev.channels, [channel]: newest } };
      persist(userId, next);
      return next;
    });
  }, [userId]);

  return { unreadByChannel, totalUnread, markRead };
}
