import React, { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, PhoneCall, ChevronUp, ChevronDown } from 'lucide-react';
import { playBlylinksTone } from '../utils/sound';

export default function TaskNotificationDrawer({
  latestNotification,
  onDismissNotification,
  callbacks,
  attendanceStatus,
  onClockAction,
  isChatMinimized,
  chatUnreadCount = 0,
  onExpandChat
}) {
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (latestNotification) {
      setShowToast(true);
      playBlylinksTone('notification');
    }
  }, [latestNotification]);

  const pendingCallbacks = callbacks.filter(c => c.status !== 'Completed');

  return (
    <>
      {/* Floating Corner Notification Toast (Bottom Right) */}
      {showToast && latestNotification && (
        <div className="corner-toast-notification">
          <div className="toast-icon-box">
            <Bell size={18} />
          </div>
          <div className="toast-content">
            <div className="toast-title">{latestNotification.title}</div>
            <div className="toast-message">{latestNotification.message}</div>
          </div>
          <button className="icon-btn-sm" onClick={() => setShowToast(false)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Task Panel + Minimized Chat Pill (Bottom Right Corner) */}
      <div className="task-panel-wrapper">
        {isChatMinimized && (
          <button className="minimized-chat-pill" onClick={onExpandChat}>
            <MessageSquare size={15} />
            <span>Chat minimized</span>
            {chatUnreadCount > 0 && <span className="minimized-chat-badge">{chatUnreadCount}</span>}
          </button>
        )}

        {!isTaskPanelOpen ? (
          <button className="task-panel-trigger-btn" onClick={() => setIsTaskPanelOpen(true)}>
            <PhoneCall size={15} />
            <span>Tasks &amp; Callbacks ({pendingCallbacks.length})</span>
            <ChevronUp size={14} />
          </button>
        ) : (
          <div className="task-panel-window card">
            <div className="panel-header">
              <span className="panel-title flex-align">
                <PhoneCall size={15} className="text-accent" /> Operational Task Panel
              </span>
              <button className="icon-btn-sm" onClick={() => setIsTaskPanelOpen(false)} aria-label="Collapse task panel">
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="panel-section">
              <div className="panel-section-title">SHIFT CLOCK STATUS</div>
              <div className="panel-punch-row">
                <div className="flex-align">
                  <span className={`status-dot ${attendanceStatus === 'Present' ? 'active' : 'inactive'}`}></span>
                  <span className="font-bold text-sm">{attendanceStatus}</span>
                </div>
                {attendanceStatus === 'Clocked Out' ? (
                  <button className="btn btn-success btn-sm" onClick={() => onClockAction('Clock In')}>Clock In</button>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => onClockAction('Clock Out')}>Clock Out</button>
                )}
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-section-title">DUE CALLBACKS ({pendingCallbacks.length})</div>
              <div className="panel-callbacks-list">
                {pendingCallbacks.length === 0 ? (
                  <div className="empty-panel-text">No callbacks pending.</div>
                ) : (
                  pendingCallbacks.slice(0, 3).map(cb => (
                    <div key={cb.id} className="panel-cb-item">
                      <div>
                        <div className="font-bold text-xs">{cb.customerName}</div>
                        <div className="text-xs text-subtle">{cb.phone} &bull; {cb.dueDate}</div>
                      </div>
                      <span className={`badge ${cb.priority === 'High' ? 'badge-error' : 'badge-warning'}`}>{cb.priority}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .corner-toast-notification {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-left: 4px solid var(--accent);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-dropdown);
          padding: 0.85rem 1rem;
          width: 330px;
          display: flex;
          gap: 0.75rem;
          z-index: 1100;
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .toast-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent-light);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .toast-content { flex: 1; }
        .toast-title { font-size: 0.825rem; font-weight: 700; color: var(--text-main); }
        .toast-message { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

        .task-panel-wrapper {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.6rem;
        }

        .minimized-chat-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-card);
          color: var(--text-main);
          border: 1px solid var(--border-color);
          padding: 0.55rem 0.9rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: var(--shadow-dropdown);
        }

        .minimized-chat-badge {
          background: var(--status-error);
          color: #fff;
          font-size: 0.65rem;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .task-panel-trigger-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--ink);
          color: #ffffff;
          border: none;
          padding: 0.6rem 1rem;
          border-radius: 9999px;
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: var(--shadow-dropdown);
          transition: transform 0.15s ease;
        }

        .task-panel-trigger-btn:hover { transform: translateY(-2px); }

        .task-panel-window {
          width: 320px;
          background: var(--bg-card);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          box-shadow: var(--shadow-dropdown);
        }

        .panel-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
        .panel-title { font-size: 0.85rem; font-weight: 700; }

        .panel-section-title { font-size: 0.625rem; font-weight: 700; color: var(--text-subtle); letter-spacing: 0.05em; margin-bottom: 0.35rem; }

        .panel-punch-row { display: flex; align-items: center; justify-content: space-between; background: var(--bg-primary); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }

        .panel-callbacks-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .panel-cb-item { display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.6rem; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
      `}</style>
    </>
  );
}
