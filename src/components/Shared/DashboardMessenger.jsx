import React, { useEffect, useState } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import ChatWindow from '../Chat/ChatWindow';
import { useChat } from '../Chat/ChatContext';

export default function DashboardMessenger({ currentUser, users = [], onSendMessage }) {
  const [collapsed, setCollapsed] = useState(false);
  const { totalUnread, focusRequest } = useChat();

  // Clicking a message notification asks this widget to show that conversation.
  // Expanding mounts ChatWindow, which then picks the request up and selects it.
  useEffect(() => {
    if (focusRequest?.target === 'inline') setCollapsed(false);
  }, [focusRequest?.nonce]);

  if (collapsed) {
    return (
      <button className="floating-messenger-bubble" onClick={() => setCollapsed(false)}>
        <MessageCircle size={20} />
        <span>Team Messenger</span>
        {totalUnread > 0 && <span className="floating-messenger-badge" aria-label={`${totalUnread} unread`}>{totalUnread}</span>}
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

      <ChatWindow variant="inline" visible currentUser={currentUser} users={users} onSendMessage={onSendMessage} />

      <style>{`
        .floating-messenger-panel {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: min(760px, calc(100vw - 32px));
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
      `}</style>
    </div>
  );
}
