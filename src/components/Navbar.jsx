import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Bell,
  Search,
  Clock,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Briefcase,
  LogOut,
  MessageSquare
} from 'lucide-react';

export default function Navbar({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  notifications,
  onClearNotifications,
  attendanceStatus,
  onClockAction,
  projects,
  selectedCampaignId,
  onSelectCampaign,
  onToggleChat,
  chatUnreadCount = 0
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const allowedProjects = currentUser.role === 'Admin' || currentUser.role === 'Supervisor'
    ? projects
    : projects.filter(p => currentUser.allowedCampaignIds?.includes(p.id));

  return (
    <header className="navbar-header">
      {/* Campaign Switcher */}
      <div className="nav-brand-group">
        <div className="campaign-selector-wrapper">
          <Briefcase size={14} className="text-accent" />
          <select
            className="form-select campaign-nav-select"
            value={selectedCampaignId}
            onChange={(e) => onSelectCampaign(e.target.value)}
          >
            {allowedProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="nav-search-container">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search leads, deal ID, phone (+92)..."
          className="nav-search-input"
        />
      </div>

      {/* Right Actions */}
      <div className="nav-actions">
        {currentUser.role === 'Agent' && (
          <div className="nav-clock-widget">
            <span className={`status-dot ${attendanceStatus === 'Present' ? 'active' : 'inactive'}`}></span>
            <span className="clock-status-text">
              {attendanceStatus === 'Present' ? 'Clocked In' : attendanceStatus}
            </span>
            {attendanceStatus === 'Clocked Out' ? (
              <button className="btn btn-success btn-sm" onClick={() => onClockAction('Clock In')}>
                <Clock size={13} /> Clock In
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => onClockAction('Clock Out')}>
                Clock Out
              </button>
            )}
          </div>
        )}

        <button className="icon-btn" onClick={onToggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Team Chat launcher — one click from anywhere */}
        <button className="icon-btn relative" onClick={onToggleChat} title="Team Chat">
          <MessageSquare size={16} />
          {chatUnreadCount > 0 && <span className="notification-badge">{chatUnreadCount}</span>}
        </button>

        {/* Notifications */}
        <div className="nav-dropdown-container">
          <button className="icon-btn relative" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={16} />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="dropdown-menu notifications-menu">
              <div className="dropdown-header">
                <span>Notifications ({notifications.length})</span>
                {notifications.length > 0 && (
                  <button className="text-btn" onClick={onClearNotifications}>Clear All</button>
                )}
              </div>
              <div className="dropdown-body">
                {notifications.length === 0 ? (
                  <div className="empty-dropdown">No new notifications</div>
                ) : (
                  notifications.map((n, idx) => (
                    <div key={idx} className={`notification-item ${!n.read ? 'unread' : ''}`}>
                      <div className="notif-icon">
                        {n.type === 'alert' ? <AlertCircle size={14} className="text-danger" /> : <CheckCircle size={14} className="text-success" />}
                      </div>
                      <div className="notif-content">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-desc">{n.message}</div>
                        <div className="notif-time">{n.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile & Account Switcher Dropdown */}
        <div className="nav-dropdown-container">
          <button className="user-profile-btn" onClick={() => setShowUserDropdown(!showUserDropdown)}>
            <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar" />
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <span className={`user-role-tag ${currentUser.role.toLowerCase()}`}>{currentUser.role}</span>
            </div>
            <ChevronDown size={13} className="text-subtle" />
          </button>

          {showUserDropdown && (
            <div className="dropdown-menu user-switcher-menu">
              <div className="dropdown-header-sm">Active Account Profile</div>
              <div className="user-switch-item">
                <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar-sm" />
                <div className="user-switch-info">
                  <div className="switch-name">{currentUser.name}</div>
                  <div className="switch-role">{currentUser.role} — {currentUser.designation}</div>
                </div>
              </div>

              <button className="user-switch-item text-danger" onClick={onLogout}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .navbar-header {
          height: var(--topbar-height);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: var(--shadow-subtle);
          gap: 1rem;
        }

        .nav-brand-group { display: flex; align-items: center; gap: 1.25rem; flex-shrink: 0; }

        .campaign-selector-wrapper {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-sm);
        }

        .campaign-nav-select {
          border: none;
          background-color: transparent;
          background-position: right 0.2rem center;
          padding-right: 1.5rem;
          font-weight: 600;
          font-size: 0.8rem;
          color: var(--text-main);
        }

        .campaign-nav-select:focus { box-shadow: none; }

        .nav-search-container { position: relative; width: 320px; max-width: 40vw; }
        .nav-search-input { width: 100%; padding: 0.4rem 1rem 0.4rem 2.2rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 9999px; font-size: 0.8rem; outline: none; color: var(--text-main); }

        .nav-actions { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }

        .nav-clock-widget { display: flex; align-items: center; gap: 0.45rem; background: var(--bg-primary); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; }
        .clock-status-text { font-weight: 600; color: var(--text-muted); }

        .relative { position: relative; }
        .notification-badge { position: absolute; top: -3px; right: -3px; background: var(--status-error); color: #fff; font-size: 0.6rem; font-weight: 700; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px; display: flex; align-items: center; justify-content: center; }

        .user-profile-btn { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.25rem 0.6rem; border-radius: var(--radius-sm); cursor: pointer; }
        .user-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
        .user-avatar-sm { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        .user-info { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
        .user-name { font-size: 0.775rem; font-weight: 600; color: var(--text-main); }
        .user-role-tag { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; }
        .user-role-tag.admin { color: var(--accent); }
        .user-role-tag.supervisor { color: var(--status-warning); }
        .user-role-tag.agent { color: var(--status-success); }

        .nav-dropdown-container { position: relative; }
        .user-switch-item { display: flex; align-items: center; gap: 0.65rem; width: 100%; padding: 0.6rem 0.85rem; background: transparent; border: none; border-bottom: 1px solid var(--border-color); color: var(--text-main); text-align: left; cursor: pointer; }
        .user-switch-item:hover { background: var(--bg-hover); }
        .user-switch-item:last-child { border-bottom: none; }
        .user-switch-info { flex: 1; }
        .switch-name { font-size: 0.8rem; font-weight: 600; }
        .switch-role { font-size: 0.7rem; color: var(--text-subtle); }

        @media (max-width: 900px) {
          .nav-search-container { display: none; }
        }
      `}</style>
    </header>
  );
}
