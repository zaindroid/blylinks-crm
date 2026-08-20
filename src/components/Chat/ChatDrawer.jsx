import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Send, X, Minus, MessageSquare } from 'lucide-react';
import { dmChannelId, isDmChannel } from '../../utils/chatChannels';
import { fetchMessageGroups } from '../../api/messageGroups';

export default function ChatDrawer({ isOpen, currentUser, users = [], messages, onSendMessage, onClose, onMinimize }) {
  const [myGroups, setMyGroups] = useState([]);
  const [activeChannel, setActiveChannel] = useState('');
  const [dmPartnerId, setDmPartnerId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);

  const dmContacts = useMemo(
    () => users.filter(u => u.id !== currentUser.id && u.status === 'Active'),
    [users, currentUser.id]
  );

  useEffect(() => {
    if (!isOpen) return;
    fetchMessageGroups()
      .then(groups => {
        setMyGroups(groups);
        setActiveChannel(prev => prev || groups[0]?.id || '');
      })
      .catch(err => console.error('Failed to load message groups', err));
  }, [isOpen]);

  const filteredMessages = messages.filter(m => m.channel === activeChannel);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [isOpen, filteredMessages.length, activeChannel]);

  if (!isOpen) return null;

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
    const newMsg = {
      id: `msg_${Date.now()}`,
      channel: activeChannel,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: textInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...(isDmChannel(activeChannel) ? { recipientId: dmPartnerId } : {})
    };
    setSendError('');
    try {
      await onSendMessage(newMsg);
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
      return;
    }
    setTextInput('');
  };

  const activeLabel = isDmChannel(activeChannel)
    ? dmContacts.find(u => u.id === dmPartnerId)?.name || 'Direct Message'
    : myGroups.find(g => g.id === activeChannel)?.name || '';

  return (
    <div className="chat-drawer" role="dialog" aria-label="Team chat">
      <div className="chat-drawer-header">
        <div className="flex-align">
          <MessageSquare size={16} className="text-accent" />
          <span className="chat-drawer-title">Team Chat</span>
        </div>
        <div className="flex-align">
          <button className="icon-btn-sm" onClick={onMinimize} title="Minimize to task panel" aria-label="Minimize chat">
            <Minus size={16} />
          </button>
          <button className="icon-btn-sm" onClick={onClose} title="Close chat" aria-label="Close chat">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="chat-channel-tabs" role="tablist" aria-label="Chat channels">
        {myGroups.length === 0 && (
          <span className="chat-no-groups-hint">No group channels yet — ask your Admin/Supervisor to add you.</span>
        )}
        {myGroups.map(g => {
          const isActive = !isDmChannel(activeChannel) && activeChannel === g.id;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={isActive}
              className={`chat-channel-tab ${isActive ? 'active' : ''}`}
              onClick={() => selectChannel(g.id)}
            >
              <span>{g.name}</span>
            </button>
          );
        })}
      </div>

      <div className="chat-dm-row">
        <select
          className="form-select chat-dm-select"
          value={dmPartnerId}
          onChange={(e) => selectDmPartner(e.target.value)}
        >
          <option value="">Direct Message…</option>
          {dmContacts.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
          ))}
        </select>
      </div>

      <div className="chat-messages-body" aria-live="polite" aria-relevant="additions">
        {!activeChannel ? (
          <div className="empty-state">
            <MessageSquare size={26} className="empty-state-icon" />
            <div className="empty-state-title">No conversation selected</div>
            <div className="empty-state-text">Pick a group or start a Direct Message.</div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={26} className="empty-state-icon" />
            <div className="empty-state-title">No messages yet</div>
            <div className="empty-state-text">Be the first to post in {activeLabel}.</div>
          </div>
        ) : (
          filteredMessages.map(msg => {
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
        <label htmlFor="chat-message-input" className="sr-only">Message {activeLabel}</label>
        <input
          id="chat-message-input"
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

      <style>{`
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        .chat-drawer {
          position: fixed;
          top: var(--topbar-height);
          right: 0;
          bottom: 0;
          width: 380px;
          max-width: 92vw;
          background: var(--bg-card);
          border-left: 1px solid var(--border-color);
          box-shadow: var(--shadow-dropdown);
          display: flex;
          flex-direction: column;
          z-index: 1050;
          animation: chatSlideIn 0.2s ease;
        }

        @keyframes chatSlideIn {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .chat-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .chat-drawer-title { font-weight: 700; font-size: 0.9rem; color: var(--text-main); font-family: var(--font-display); }

        .chat-channel-tabs {
          display: flex;
          gap: 0.35rem;
          padding: 0.65rem 0.85rem;
          flex-shrink: 0;
          overflow-x: auto;
        }

        .chat-dm-row {
          padding: 0 0.85rem 0.65rem 0.85rem;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .chat-dm-select { width: 100%; }
        .chat-no-groups-hint { font-size: 0.75rem; color: var(--text-subtle); padding: 0.3rem 0; }
        .chat-send-error { font-size: 0.75rem; color: var(--status-error); padding: 0 0.85rem 0.5rem; }

        .chat-channel-tab {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 9999px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .chat-channel-tab:hover { color: var(--text-main); }
        .chat-channel-tab.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent-light); }

        .chat-messages-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .chat-msg-row { display: flex; gap: 0.6rem; }
        .chat-msg-row.mine { justify-content: flex-end; }

        .chat-msg-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--accent);
          color: #fff; font-weight: 700; font-size: 0.75rem;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .chat-msg-bubble {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.55rem 0.75rem;
          max-width: 78%;
        }
        .chat-msg-row.mine .chat-msg-bubble { background: var(--accent); border-color: var(--accent); color: #fff; }

        .chat-msg-meta { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
        .chat-msg-sender { font-weight: 650; font-size: 0.775rem; color: var(--text-main); }
        .chat-msg-role-pill { font-size: 0.58rem; font-weight: 700; padding: 0.08rem 0.35rem; border-radius: 4px; text-transform: uppercase; }
        .chat-msg-role-pill.admin { background: var(--accent-light); color: var(--accent); }
        .chat-msg-role-pill.agent { background: var(--status-success-bg); color: var(--status-success); }

        .chat-msg-text { font-size: 0.85rem; line-height: 1.4; }
        .chat-msg-time { font-size: 0.62rem; margin-top: 0.25rem; opacity: 0.7; }
        .chat-msg-row.mine .chat-msg-time { color: rgba(255,255,255,0.85); }

        .chat-input-row {
          display: flex;
          gap: 0.5rem;
          padding: 0.85rem;
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .chat-input-row .form-input { flex: 1; }

        @media (max-width: 560px) {
          .chat-drawer { width: 100vw; }
        }
      `}</style>
    </div>
  );
}
