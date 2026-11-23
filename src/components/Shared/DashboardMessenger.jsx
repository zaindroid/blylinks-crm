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
            bottom: 20px;
            /* --sidebar-width is the nav's widest (expanded) state -- offsetting from that, not
               a bare 20px, keeps this clear of the nav even when it isn't collapsed. */
            left: calc(var(--sidebar-width, 252px) + 20px);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--accent);
            color: #fff;
            border: none;
            padding: 0.7rem 1.1rem;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 10px 28px rgba(0,0,0,0.22);
            z-index: 950;
            transition: transform 0.15s ease;
          }
          .floating-messenger-bubble:hover { transform: translateY(-3px); }
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
        /* Docked to the bottom-left corner, like a conventional support-chat widget, instead of
           floating in the bottom-center of the screen. Bottom-RIGHT is already the anchor for
           TaskNotificationDrawer's own pill stack (the "Tasks & Callbacks" button and the
           minimized-chat-drawer pill), so this uses the opposite corner rather than stacking on
           top of that. ChatWindow's own narrow-screen layout is a viewport media query, not a
           container query, so it won't kick in here just from this panel being narrow -- 440px
           keeps its two-column (conversation list + thread) layout comfortably legible rather
           than switching layouts. Tall enough to actually read a conversation in, unlike the old
           360px strip. */
        .floating-messenger-panel {
          position: fixed;
          bottom: 20px;
          left: calc(var(--sidebar-width, 252px) + 20px);
          width: min(440px, calc(100vw - var(--sidebar-width, 252px) - 40px));
          height: min(560px, calc(100vh - 140px));
          background: var(--bg-card);
          border: 1px solid var(--accent);
          border-radius: 16px;
          box-shadow: 0 18px 44px rgba(0,0,0,0.26);
          z-index: 950;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: floatingMessengerSlideIn 0.22s ease;
        }
        @keyframes floatingMessengerSlideIn {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
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
        /* Fill the whole panel body instead of ChatWindow's default fixed 360px inline height. */
        .floating-messenger-panel .chat-window--inline { flex: 1; height: auto; min-height: 0; }
      `}</style>
    </div>
  );
}
