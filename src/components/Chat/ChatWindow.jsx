import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, MessageSquare, Hash, ArrowLeft } from 'lucide-react';
import { dmChannelId, dmPartnerId as partnerOf, isDmChannel } from '../../utils/chatChannels';
import { useChat } from './ChatContext';

const NARROW_QUERY = '(max-width: 560px)';

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
}

function useTabVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return <span className="chat-unread-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>;
}

// The conversation list (groups + people, each with an unread badge) next to the
// active thread. Hosted by both the navbar drawer and the dashboard messenger, so the
// two can't drift apart. Chat data and read-state come from ChatContext (owned by App).
//
// `variant` is 'drawer' or 'inline'; `visible` is whether the window is actually on
// screen -- only then does the open conversation count as "being read".
export default function ChatWindow({ variant, visible = true, currentUser, users = [], onSendMessage }) {
  const { messages, groups, unreadByChannel, markRead, reportViewing, focusRequest, consumeFocus } = useChat();
  const [activeChannel, setActiveChannel] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [textInput, setTextInput] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);
  const isNarrow = useIsNarrow();
  const tabVisible = useTabVisible();

  const dmContacts = useMemo(
    () => users.filter(u => u.id !== currentUser.id && u.status === 'Active'),
    [users, currentUser.id]
  );

  // Most recently active people first, so the person who just wrote is at the top.
  const lastActivity = useMemo(() => {
    const latest = {};
    for (const m of messages) {
      const t = Date.parse(m.createdAt) || 0;
      if (t > (latest[m.channel] || 0)) latest[m.channel] = t;
    }
    return latest;
  }, [messages]);

  const sortedContacts = useMemo(() => {
    const dm = (u) => dmChannelId(currentUser.id, u.id);
    return [...dmContacts].sort((a, b) => {
      const unreadDiff = (unreadByChannel[dm(b)] || 0) - (unreadByChannel[dm(a)] || 0);
      if (unreadDiff) return unreadDiff;
      const activityDiff = (lastActivity[dm(b)] || 0) - (lastActivity[dm(a)] || 0);
      if (activityDiff) return activityDiff;
      return a.name.localeCompare(b.name);
    });
  }, [dmContacts, unreadByChannel, lastActivity, currentUser.id]);

  // Open on the first conversation with unread messages, otherwise the first group.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || activeChannel) return;
    const firstUnread = Object.keys(unreadByChannel)[0];
    const pick = firstUnread || groups[0]?.id;
    if (pick) {
      autoSelected.current = true;
      setActiveChannel(pick);
    }
  }, [groups, unreadByChannel, activeChannel]);

  const selectConversation = (channelId) => {
    setActiveChannel(channelId);
    setSendError('');
    setMobileView('thread');
  };

  // "Open this conversation" requests (clicking a notification toast / bell entry).
  useEffect(() => {
    if (!focusRequest || focusRequest.target !== variant) return;
    selectConversation(focusRequest.channel);
    consumeFocus?.(focusRequest.nonce);
  }, [focusRequest?.nonce, variant]);

  // On a narrow screen only one pane shows at a time; on desktop both do.
  const threadVisible = visible && tabVisible && (!isNarrow || mobileView === 'thread');

  // Tell App which conversation is actually on screen so it doesn't raise a toast for
  // a message you are looking at, and clear that conversation's unread badge.
  useEffect(() => {
    reportViewing?.(variant, threadVisible && activeChannel ? activeChannel : null);
    return () => reportViewing?.(variant, null);
  }, [variant, threadVisible, activeChannel]);

  const unreadHere = activeChannel ? unreadByChannel[activeChannel] || 0 : 0;
  useEffect(() => {
    if (threadVisible && activeChannel && unreadHere > 0) markRead(activeChannel);
  }, [threadVisible, activeChannel, unreadHere]);

  const channelMessages = useMemo(
    () => messages.filter(m => m.channel === activeChannel),
    [messages, activeChannel]
  );

  useEffect(() => {
    if (threadVisible) messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [threadVisible, channelMessages.length, activeChannel]);

  const activePartnerId = partnerOf(activeChannel, currentUser.id);
  const activeLabel = isDmChannel(activeChannel)
    ? dmContacts.find(u => u.id === activePartnerId)?.name || 'Direct Message'
    : groups.find(g => g.id === activeChannel)?.name || '';

  const handleSend = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    if (!activeChannel) {
      setSendError('Pick a group or start a Direct Message before sending.');
      return;
    }
    setSendError('');
    try {
      await onSendMessage({
        channel: activeChannel,
        text: textInput,
        ...(isDmChannel(activeChannel) ? { recipientId: activePartnerId } : {})
      });
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
      return;
    }
    setTextInput('');
  };

  const rowLabel = (name, channel) => {
    const n = unreadByChannel[channel] || 0;
    return n > 0 ? `${name}, ${n} unread ${n === 1 ? 'message' : 'messages'}` : name;
  };

  return (
    <div className={`chat-window chat-window--${variant}`} data-view={mobileView}>
      <nav className="chat-sidebar" aria-label="Conversations">
        <div className="chat-sidebar-heading">Groups</div>
        {groups.length === 0 && (
          <div className="chat-sidebar-hint">No group channels yet — ask your Admin/Supervisor to add you.</div>
        )}
        {groups.map(g => {
          const isActive = activeChannel === g.id;
          const unread = unreadByChannel[g.id] || 0;
          return (
            <button
              key={g.id}
              type="button"
              className={`chat-conv ${isActive ? 'active' : ''} ${unread ? 'has-unread' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              aria-label={rowLabel(g.name, g.id)}
              onClick={() => selectConversation(g.id)}
            >
              <Hash size={14} className="chat-conv-icon" />
              <span className="chat-conv-name">{g.name}</span>
              <UnreadBadge count={unread} />
            </button>
          );
        })}

        <div className="chat-sidebar-heading">Direct messages</div>
        {sortedContacts.length === 0 && <div className="chat-sidebar-hint">No teammates to message yet.</div>}
        {sortedContacts.map(u => {
          const channel = dmChannelId(currentUser.id, u.id);
          const isActive = activeChannel === channel;
          const unread = unreadByChannel[channel] || 0;
          return (
            <button
              key={u.id}
              type="button"
              className={`chat-conv ${isActive ? 'active' : ''} ${unread ? 'has-unread' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              aria-label={rowLabel(u.name, channel)}
              onClick={() => selectConversation(channel)}
            >
              <span className="chat-conv-avatar">{u.name.charAt(0)}</span>
              <span className="chat-conv-text">
                <span className="chat-conv-name">{u.name}</span>
                <span className="chat-conv-sub">{u.role}</span>
              </span>
              <UnreadBadge count={unread} />
            </button>
          );
        })}
      </nav>

      <section className="chat-thread" aria-label="Conversation">
        <div className="chat-thread-header">
          <button type="button" className="icon-btn-sm chat-back-btn" onClick={() => setMobileView('list')} aria-label="Back to conversations">
            <ArrowLeft size={16} />
          </button>
          <span className="chat-thread-title">{activeLabel || 'No conversation selected'}</span>
        </div>

        <div className="chat-messages-body" aria-live="polite" aria-relevant="additions">
          {!activeChannel ? (
            <div className="chat-empty">
              <MessageSquare size={24} className="chat-empty-icon" />
              <div>Pick a group or start a Direct Message to begin.</div>
            </div>
          ) : channelMessages.length === 0 ? (
            <div className="chat-empty">
              <MessageSquare size={24} className="chat-empty-icon" />
              <div>No messages yet — say hello to {activeLabel}.</div>
            </div>
          ) : (
            channelMessages.map(msg => {
              const isMine = msg.senderId === currentUser.id;
              return (
                <div key={msg.id} className={`chat-msg-row ${isMine ? 'mine' : ''}`}>
                  {!isMine && <div className="chat-msg-avatar">{msg.senderName.charAt(0)}</div>}
                  <div className="chat-msg-bubble">
                    {!isMine && (
                      <div className="chat-msg-meta">
                        <span className="chat-msg-sender">{msg.senderName}</span>
                        <span className={`chat-msg-role-pill ${msg.senderRole === 'Admin' ? 'admin' : 'agent'}`}>{msg.senderRole}</span>
                      </div>
                    )}
                    <div className="chat-msg-text">{msg.text}</div>
                    <div className="chat-msg-time">{msg.timestamp}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {sendError && <div className="chat-send-error">{sendError}</div>}

        <form className="chat-input-row" onSubmit={handleSend}>
          <label htmlFor={`chat-message-input-${variant}`} className="sr-only">Message {activeLabel}</label>
          <input
            id={`chat-message-input-${variant}`}
            type="text"
            className="form-input"
            placeholder={`Message ${activeLabel}...`}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="icon-btn" aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
      </section>

      <style>{`
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        .chat-window { display: flex; flex: 1; min-height: 0; min-width: 0; }
        .chat-window--inline { flex: none; height: 360px; }

        .chat-sidebar {
          width: 200px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0.5rem 0.4rem;
          overflow-y: auto;
          background: var(--bg-primary);
          border-right: 1px solid var(--border-color);
        }
        .chat-sidebar-heading {
          font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-subtle); padding: 0.55rem 0.5rem 0.25rem;
        }
        .chat-sidebar-hint { font-size: 0.7rem; color: var(--text-subtle); padding: 0.2rem 0.5rem 0.4rem; line-height: 1.35; }

        .chat-conv {
          display: flex; align-items: center; gap: 0.5rem; width: 100%;
          padding: 0.4rem 0.5rem; border: none; border-radius: var(--radius-sm);
          background: transparent; color: var(--text-muted); font-size: 0.78rem; text-align: left; cursor: pointer;
        }
        .chat-conv:hover { background: var(--bg-card); color: var(--text-main); }
        .chat-conv.active { background: var(--accent-light); color: var(--accent); }
        .chat-conv.has-unread { color: var(--text-main); font-weight: 700; }
        .chat-conv.active.has-unread { color: var(--accent); }
        .chat-conv-icon { flex-shrink: 0; opacity: 0.7; }
        .chat-conv-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-conv-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
        .chat-conv-sub { font-size: 0.62rem; font-weight: 500; opacity: 0.65; }
        .chat-conv-avatar {
          width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%;
          background: var(--accent); color: #fff; font-size: 0.7rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .chat-unread-badge {
          flex-shrink: 0; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
          background: var(--status-error); color: #fff; font-size: 0.66rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }

        .chat-thread { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .chat-thread-header {
          display: flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem;
          border-bottom: 1px solid var(--border-color); flex-shrink: 0;
        }
        .chat-thread-title { font-size: 0.82rem; font-weight: 700; color: var(--text-main); }
        .chat-back-btn { display: none; }

        .chat-messages-body {
          flex: 1; min-height: 0; overflow-y: auto; padding: 0.8rem 0.9rem;
          display: flex; flex-direction: column; gap: 0.7rem;
        }
        .chat-empty { margin: auto; text-align: center; font-size: 0.8rem; color: var(--text-subtle); display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
        .chat-empty-icon { opacity: 0.5; }

        .chat-msg-row { display: flex; gap: 0.55rem; }
        .chat-msg-row.mine { justify-content: flex-end; }
        .chat-msg-avatar {
          width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: #fff;
          font-weight: 700; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .chat-msg-bubble {
          background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md);
          padding: 0.5rem 0.7rem; max-width: 80%;
        }
        .chat-msg-row.mine .chat-msg-bubble { background: var(--accent); border-color: var(--accent); color: #fff; }
        .chat-msg-meta { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem; }
        .chat-msg-sender { font-weight: 650; font-size: 0.75rem; color: var(--text-main); }
        .chat-msg-role-pill { font-size: 0.56rem; font-weight: 700; padding: 0.08rem 0.35rem; border-radius: 4px; text-transform: uppercase; }
        .chat-msg-role-pill.admin { background: var(--accent-light); color: var(--accent); }
        .chat-msg-role-pill.agent { background: var(--status-success-bg); color: var(--status-success); }
        .chat-msg-text { font-size: 0.82rem; line-height: 1.4; overflow-wrap: anywhere; }
        .chat-msg-time { font-size: 0.6rem; margin-top: 0.2rem; opacity: 0.7; }
        .chat-msg-row.mine .chat-msg-time { color: rgba(255,255,255,0.85); }

        .chat-send-error { font-size: 0.75rem; color: var(--status-error); padding: 0 0.9rem 0.4rem; }
        .chat-input-row { display: flex; gap: 0.5rem; padding: 0.7rem 0.9rem; border-top: 1px solid var(--border-color); flex-shrink: 0; }
        .chat-input-row .form-input { flex: 1; min-width: 0; }

        @media (max-width: 560px) {
          .chat-sidebar { width: 100%; border-right: none; }
          .chat-window[data-view="list"] .chat-thread { display: none; }
          .chat-window[data-view="thread"] .chat-sidebar { display: none; }
          .chat-back-btn { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
