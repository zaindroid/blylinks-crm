import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, MessageCircle, ChevronDown } from 'lucide-react';
import { dmChannelId, isDmChannel } from '../../utils/chatChannels';
import { fetchMessages } from '../../api/messages';
import { fetchMessageGroups } from '../../api/messageGroups';
import { playBlylinksTone } from '../../utils/sound';
import { showDesktopNotification } from '../../utils/notifications';

const POLL_INTERVAL_MS = 8000;

export default function DashboardMessenger({ currentUser, users = [], onSendMessage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [activeChannel, setActiveChannel] = useState('');
  const [dmPartnerId, setDmPartnerId] = useState('');
  const [allMessages, setAllMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);
  const seenIds = useRef(new Set());
  const initialized = useRef(false);

  const dmContacts = useMemo(
    () => users.filter(u => u.id !== currentUser.id && u.status === 'Active'),
    [users, currentUser.id]
  );

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [msgs, groups] = await Promise.all([fetchMessages(), fetchMessageGroups()]);
        if (cancelled) return;
        setAllMessages(msgs);
        setMyGroups(groups);
        setActiveChannel(prev => prev || groups[0]?.id || '');

        if (!initialized.current) {
          msgs.forEach(m => seenIds.current.add(m.id));
          initialized.current = true;
          return;
        }

        const incoming = msgs.filter(m => m.senderId !== currentUser.id && !seenIds.current.has(m.id));
        if (incoming.length > 0) {
          incoming.forEach(m => seenIds.current.add(m.id));
          if (collapsed) {
            setUnreadCount(c => c + incoming.length);
            playBlylinksTone('notification');
            const latest = incoming[incoming.length - 1];
            showDesktopNotification(`New message from ${latest.senderName}`, latest.text);
          }
        }
      } catch (err) {
        console.error('Failed to poll messages', err);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [collapsed, currentUser.id]);

  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [collapsed, allMessages.length, activeChannel]);

  const channelMessages = useMemo(
    () => allMessages.filter(m => m.channel === activeChannel),
    [allMessages, activeChannel]
  );

  const expand = () => {
    setCollapsed(false);
    setUnreadCount(0);
    allMessages.forEach(m => seenIds.current.add(m.id));
  };

  const selectChannel = (channelId) => {
    setActiveChannel(channelId);
    setDmPartnerId('');
    setSendError('');
  };

  const selectDmPartner = (userId) => {
    setDmPartnerId(userId);
    setSendError('');
    if (userId) setActiveChannel(dmChannelId(currentUser.id, userId));
  };

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
        ...(isDmChannel(activeChannel) ? { recipientId: dmPartnerId } : {})
      });
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
      return;
    }
    setTextInput('');
    setAllMessages(await fetchMessages());
  };

  const activeLabel = isDmChannel(activeChannel)
    ? dmContacts.find(u => u.id === dmPartnerId)?.name || 'Direct Message'
    : myGroups.find(g => g.id === activeChannel)?.name || '';

  if (collapsed) {
    return (
      <button className="floating-messenger-bubble" onClick={expand}>
        <MessageCircle size={20} />
        <span>Team Messenger</span>
        {unreadCount > 0 && <span className="floating-messenger-badge">{unreadCount}</span>}
        <style>{`
          .floating-messenger-bubble {
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--accent);
            color: #fff;
            border: none;
            padding: 0.7rem 1.4rem;
            border-radius: 14px 14px 0 0;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 -6px 24px rgba(0,0,0,0.18);
            z-index: 950;
            transition: transform 0.15s ease;
          }
          .floating-messenger-bubble:hover { transform: translateX(-50%) translateY(-3px); }
          .floating-messenger-badge {
            background: var(--status-error);
            color: #fff;
            font-size: 0.68rem;
            font-weight: 800;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="floating-messenger-panel">
      <div className="floating-messenger-header">
        <span className="floating-messenger-title"><MessageCircle size={16} /> Team Messenger</span>
        <button className="icon-btn-sm floating-messenger-collapse" onClick={() => setCollapsed(true)} aria-label="Minimize messenger">
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="floating-messenger-tabs-row">
        <div className="messenger-channel-tabs">
          {myGroups.length === 0 && (
            <span className="messenger-no-groups-hint">No group channels yet — ask your Admin/Supervisor to add you.</span>
          )}
          {myGroups.map(g => (
            <button
              key={g.id}
              className={`messenger-channel-tab ${!isDmChannel(activeChannel) && activeChannel === g.id ? 'active' : ''}`}
              onClick={() => selectChannel(g.id)}
              title={g.name}
            >
              {g.name}
            </button>
          ))}
        </div>
        <select
          className="form-select messenger-dm-select"
          value={dmPartnerId}
          onChange={(e) => selectDmPartner(e.target.value)}
        >
          <option value="">Direct Message…</option>
          {dmContacts.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
          ))}
        </select>
      </div>

      <div className="messenger-body">
        {!activeChannel ? (
          <div className="messenger-empty">Pick a group or start a Direct Message to begin.</div>
        ) : channelMessages.length === 0 ? (
          <div className="messenger-empty">No messages yet — say hello to {activeLabel}.</div>
        ) : (
          channelMessages.map(msg => {
            const isMine = msg.senderId === currentUser.id;
            return (
              <div key={msg.id} className={`messenger-row ${isMine ? 'mine' : ''}`}>
                <div className="messenger-bubble">
                  {!isMine && <span className="messenger-sender">{msg.senderName}</span>}
                  <span className="messenger-text">{msg.text}</span>
                  <span className="messenger-time">{msg.timestamp}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && <div className="messenger-send-error">{sendError}</div>}

      <form className="messenger-input-row" onSubmit={handleSend}>
        <input
          type="text"
          className="form-input"
          placeholder={`Message ${activeLabel}...`}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="icon-btn" aria-label="Send message"><Send size={16} /></button>
      </form>

      <style>{`
        .floating-messenger-panel {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: min(720px, calc(100vw - 32px));
          background: var(--bg-card);
          border: 1px solid var(--accent);
          border-bottom: none;
          border-radius: 18px 18px 0 0;
          box-shadow: 0 -18px 44px rgba(0,0,0,0.26);
          z-index: 950;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: floatingMessengerSnapUp 0.32s cubic-bezier(0.2, 1.1, 0.4, 1);
        }
        @keyframes floatingMessengerSnapUp {
          from { transform: translateX(-50%) translateY(100%); }
          to { transform: translateX(-50%) translateY(0); }
        }
        .floating-messenger-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.7rem 1rem;
          background: var(--accent);
          color: #fff;
          flex-shrink: 0;
        }
        .floating-messenger-title { display: flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 0.85rem; }
        .floating-messenger-collapse { color: #fff; }
        .floating-messenger-collapse:hover { background: rgba(255,255,255,0.18); }
        .floating-messenger-tabs-row { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; padding: 0.6rem 1rem 0; }
        .messenger-channel-tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; }
        .messenger-channel-tab { border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-muted); font-size: 0.65rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 9999px; cursor: pointer; white-space: nowrap; }
        .messenger-channel-tab.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent-light); }
        .messenger-dm-select { font-size: 0.7rem; padding: 0.25rem 0.5rem; max-width: 150px; }
        .messenger-no-groups-hint { font-size: 0.7rem; color: var(--text-subtle); }
        .messenger-send-error { font-size: 0.72rem; color: var(--status-error); padding: 0 1rem 0.4rem; }
        .messenger-body { display: flex; flex-direction: column; gap: 0.5rem; height: 200px; overflow-y: auto; padding: 0.6rem 1rem; }
        .messenger-empty { font-size: 0.8rem; color: var(--text-subtle); text-align: center; margin: auto; }
        .messenger-row { display: flex; }
        .messenger-row.mine { justify-content: flex-end; }
        .messenger-bubble { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; max-width: 82%; display: flex; flex-direction: column; gap: 1px; }
        .messenger-row.mine .messenger-bubble { background: var(--accent); border-color: var(--accent); color: #fff; }
        .messenger-sender { font-size: 0.65rem; font-weight: 700; color: var(--text-main); }
        .messenger-text { font-size: 0.78rem; line-height: 1.35; }
        .messenger-time { font-size: 0.6rem; opacity: 0.7; }
        .messenger-input-row { display: flex; gap: 0.4rem; padding: 0.65rem 1rem; border-top: 1px solid var(--border-color); flex-shrink: 0; }
        .messenger-input-row .form-input { flex: 1; }

      `}</style>
    </div>
  );
}
