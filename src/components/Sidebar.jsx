import React, { useState } from 'react';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Clock,
  PhoneCall,
  Target,
  Briefcase,
  FileSpreadsheet,
  BookOpen,
  CheckSquare,
  LifeBuoy,
  FileText,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const LOGO_SRC = '/blylinks-logo.png';

function getNavSections(role, pendingQaCount) {
  const sections = [
    { title: null, items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }] }
  ];

  if (role === 'Agent') {
    sections.push({
      title: 'Workspace',
      items: [
        { id: 'my-sales', label: 'My Sales', icon: DollarSign },
        { id: 'callbacks', label: 'Callbacks', icon: PhoneCall },
        { id: 'leads', label: 'My Leads', icon: Users },
        { id: 'attendance', label: 'Attendance', icon: Clock }
      ]
    });
  }

  if (role === 'Supervisor' || role === 'Admin') {
    sections.push({
      title: 'Operations',
      items: [
        { id: 'qa-approval', label: 'QA Audit', icon: CheckSquare, badge: pendingQaCount },
        { id: 'leads', label: 'Lead CRM', icon: Users },
        { id: 'team-attendance', label: 'Team Attendance', icon: UserCheck }
      ]
    });
  }

  if (role === 'Admin') {
    sections.push({
      title: 'Management',
      items: [
        { id: 'payroll', label: 'Payroll', icon: FileSpreadsheet },
        { id: 'targets', label: 'Targets', icon: Target },
        { id: 'projects', label: 'Campaigns', icon: Briefcase },
        { id: 'reports', label: 'Reports', icon: FileText }
      ]
    });
  }

  sections.push({
    title: 'Resources',
    items: [
      { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
      { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy }
    ]
  });

  return sections;
}

export default function Sidebar({ currentRole, activeTab, setActiveTab, pendingQaCount }) {
  const [collapsed, setCollapsed] = useState(false);
  const sections = getNavSections(currentRole, pendingQaCount);

  return (
    <aside className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <img src={LOGO_SRC} alt="Blylinks" className="sidebar-brand-logo" />
          </div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">BlyLinks</span>
              <span className="sidebar-brand-sub">Operations Console</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section, sIdx) => (
          <div className="sidebar-section" key={sIdx}>
            {section.title && !collapsed && <div className="sidebar-section-title">{section.title}</div>}
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={17} className="sidebar-link-icon" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge > 0 && <span className="nav-badge-pill">{item.badge}</span>}
                  {collapsed && item.badge > 0 && <span className="nav-badge-dot" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight size={15} /> : (<><ChevronLeft size={15} /><span>Collapse</span></>)}
      </button>

      <style>{`
        .sidebar-container {
          width: var(--sidebar-width);
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          padding: 0.9rem 0.75rem 0.75rem 0.75rem;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          transition: width 0.18s ease;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        .sidebar-container.collapsed { width: var(--sidebar-width-collapsed); }

        .sidebar-brand-row { padding: 0.35rem 0.4rem 1rem 0.4rem; }
        .sidebar-brand { display: flex; align-items: center; gap: 0.65rem; }
        .sidebar-brand-mark {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-brand-logo { width: 100%; height: 100%; object-fit: contain; }
        .sidebar-brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
        .sidebar-brand-name { font-family: var(--font-display); font-weight: 700; font-size: 0.95rem; color: #ffffff; white-space: nowrap; }
        .sidebar-brand-sub { font-size: 0.65rem; color: var(--sidebar-text-muted); white-space: nowrap; }

        .sidebar-nav { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.15rem; }
        .sidebar-section { display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.4rem; }

        .sidebar-section-title {
          font-size: 0.625rem;
          font-weight: 700;
          color: var(--sidebar-section-title);
          letter-spacing: 0.08em;
          padding: 0.7rem 0.65rem 0.3rem 0.65rem;
          text-transform: uppercase;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.55rem 0.65rem;
          border-radius: var(--radius-sm);
          color: var(--sidebar-text);
          background: transparent;
          border: none;
          font-size: 0.835rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
          text-align: left;
          font-family: var(--font-body);
        }

        .sidebar-container.collapsed .sidebar-link { justify-content: center; }

        .sidebar-link-icon { flex-shrink: 0; }

        .sidebar-link:hover { color: var(--sidebar-text-active); background: var(--sidebar-hover-bg); }

        .sidebar-link.active {
          color: var(--sidebar-text-active);
          background: var(--sidebar-active-bg);
          font-weight: 600;
        }
        .sidebar-link.active .sidebar-link-icon { color: var(--sidebar-active-accent); }

        .nav-badge-pill {
          margin-left: auto;
          background: var(--status-warning);
          color: #1c1300;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
        }

        .nav-badge-dot { margin-left: auto; width: 7px; height: 7px; border-radius: 50%; background: var(--status-warning); }

        .sidebar-collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          margin-top: 0.5rem;
          padding: 0.5rem 0.65rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--sidebar-border);
          color: var(--sidebar-text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sidebar-collapse-btn:hover { color: var(--sidebar-text-active); background: var(--sidebar-hover-bg); }
      `}</style>
    </aside>
  );
}
