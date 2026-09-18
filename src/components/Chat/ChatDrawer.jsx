import React from 'react';
import { X, Minus, MessageSquare } from 'lucide-react';
import ChatWindow from './ChatWindow';

export default function ChatDrawer({ isOpen, currentUser, users = [], onSendMessage, onClose, onMinimize }) {
  if (!isOpen) return null;

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

      <ChatWindow variant="drawer" visible currentUser={currentUser} users={users} onSendMessage={onSendMessage} />

      <style>{`
        .chat-drawer {
          position: fixed;
          top: var(--topbar-height);
          right: 0;
          bottom: 0;
          width: 620px;
          max-width: 100vw;
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
      `}</style>
    </div>
  );
}
