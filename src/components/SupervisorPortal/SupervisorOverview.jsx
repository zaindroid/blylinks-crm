import React from 'react';
import { 
  DollarSign, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck,
  PlusCircle
} from 'lucide-react';
import { formatPKR } from '../../utils/currency';

export default function SupervisorOverview({ 
  sales, 
  users, 
  attendanceLogs, 
  onApproveSale, 
  onRejectSale, 
  setActiveTab,
  selectedCampaignId,
  projects
}) {
  const activeProject = projects.find(p => p.id === selectedCampaignId) || projects[0];

  // Filter sales to selected campaign
  const campaignSales = sales.filter(s => s.campaignId === selectedCampaignId);
  const approvedSales = campaignSales.filter(s => s.status === 'Approved');
  const pendingSales = campaignSales.filter(s => s.status === 'Pending');

  const totalRevenuePkr = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalSubmissions = campaignSales.length;
  const approvalRate = totalSubmissions > 0 ? Math.round((approvedSales.length / totalSubmissions) * 100) : 0;

  const agents = users.filter(u => u.role === 'Agent');
  const clockedInCount = attendanceLogs.filter(a => a.status === 'Present' || a.status === 'Late').length;

  return (
    <div className="supervisor-overview-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Supervisor Console</h1>
          <p className="page-subtitle">Team QA audit &amp; lead routing &bull; Active Campaign: <span className="font-bold text-accent">{activeProject?.name}</span></p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setActiveTab('qa-approval')}>
            <CheckCircle size={15} /> QA Audit Queue ({pendingSales.length})
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('leads')}>
            <PlusCircle size={15} /> Add / Assign Lead
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head"><span>Pending QA Audit</span><div className="kpi-icon"><Clock size={16} /></div></div>
          <div className="kpi-value">{pendingSales.length}</div>
          <div className="kpi-sub"><span className="text-warning">Deals Awaiting Audit</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>QA Approval Rate</span><div className="kpi-icon"><TrendingUp size={16} /></div></div>
          <div className="kpi-value">{approvalRate}%</div>
          <div className="kpi-sub"><span>{approvedSales.length} Approved / {totalSubmissions} Total</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Agents On Shift</span><div className="kpi-icon"><UserCheck size={16} /></div></div>
          <div className="kpi-value">{clockedInCount}</div>
          <div className="kpi-sub"><span>Out of {agents.length} Total Agents</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Campaign Sales Revenue</span><div className="kpi-icon"><DollarSign size={16} /></div></div>
          <div className="kpi-value">{formatPKR(totalRevenuePkr)}</div>
          <div className="kpi-sub"><span className="text-success">{approvedSales.length} Approved Deals</span></div>
        </div>
      </div>

      {/* Main Grid: QA Audit Queue + Shift Roster */}
      <div className="grid-2">
        {/* QA Audit Queue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} className="text-warning" /> QA Audit Queue ({pendingSales.length})</span>
            <button className="text-btn" onClick={() => setActiveTab('qa-approval')}>View All Queue</button>
          </div>

          {pendingSales.length === 0 ? (
            <div className="empty-qa-box">
              <CheckCircle size={16} className="text-success" />
              <span>All submitted deals for {activeProject?.name} have been audited.</span>
            </div>
          ) : (
            <div className="minimal-list">
              {pendingSales.slice(0, 3).map(s => (
                <div key={s.id} className="minimal-list-item">
                  <div>
                    <div className="item-title">{s.agentName} • {s.customerName}</div>
                    <div className="item-desc">{s.projectName} &bull; <span className="font-mono text-accent">{formatPKR(s.amount)}</span></div>
                  </div>
                  <div className="btn-group-sm">
                    <button className="btn btn-success btn-sm" onClick={() => onApproveSale(s.id, 'Approved by Supervisor QA')}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onRejectSale(s.id, 'Disqualified by Supervisor QA')}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today Shift Roster */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Users size={16} /> Agent Shift Attendance</span>
            <button className="text-btn" onClick={() => setActiveTab('team-attendance')}>Full Sheet</button>
          </div>
          <div className="roster-list-mini">
            {agents.map(agent => {
              const log = attendanceLogs.find(a => a.agentId === agent.id);
              const status = log ? log.status : 'Absent';
              return (
                <div key={agent.id} className="roster-mini-item">
                  <img src={agent.avatar} alt={agent.name} className="roster-avatar-mini" />
                  <div className="roster-mini-info">
                    <div className="font-bold text-xs">{agent.name}</div>
                    <div className="text-xs text-muted">{agent.designation}</div>
                  </div>
                  <span className={`badge ${status === 'Present' ? 'badge-success' : status === 'Late' ? 'badge-warning' : 'badge-error'}`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .supervisor-overview-container { display: flex; flex-direction: column; }
        .empty-qa-box { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem; background: var(--status-success-bg); border: 1px solid var(--status-success-border); border-radius: var(--radius-sm); color: var(--status-success); font-size: 0.8rem; }
        .minimal-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .minimal-list-item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .item-title { font-size: 0.825rem; font-weight: 600; }
        .item-desc { font-size: 0.725rem; color: var(--text-subtle); }
        .btn-group-sm { display: flex; gap: 0.35rem; }
        .roster-list-mini { display: flex; flex-direction: column; gap: 0.55rem; }
        .roster-mini-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.5rem 0.65rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .roster-avatar-mini { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        .roster-mini-info { flex: 1; }
      `}</style>
    </div>
  );
}
