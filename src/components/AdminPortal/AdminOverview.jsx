import React, { useState } from 'react';
import { 
  DollarSign, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Briefcase, 
  ChevronRight,
  Settings,
  X,
  FileSpreadsheet,
  Target
} from 'lucide-react';
import { formatPKR } from '../../utils/currency';

export default function AdminOverview({ 
  sales, 
  users, 
  projects, 
  attendanceLogs, 
  onApproveSale, 
  onRejectSale, 
  setActiveTab,
  selectedCampaignId
}) {
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  const activeProject = projects.find(p => p.id === selectedCampaignId) || projects[0];

  // Filter sales to selected campaign
  const campaignSales = sales.filter(s => s.campaignId === selectedCampaignId);
  const approvedSales = campaignSales.filter(s => s.status === 'Approved');
  const pendingSales = campaignSales.filter(s => s.status === 'Pending');

  const totalRevenuePkr = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalSubmissions = campaignSales.length;
  const approvalRate = totalSubmissions > 0 ? Math.round((approvedSales.length / totalSubmissions) * 100) : 0;

  const assignedAgentsCount = activeProject?.assignedAgentIds?.length || users.filter(u => u.role === 'Agent').length;

  return (
    <div className="admin-overview-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Operations Console</h1>
          <p className="page-subtitle">BlyLinks Call Center Oversight &bull; Active Campaign: <span className="font-bold text-accent">{activeProject?.name}</span></p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setActiveTab('qa-approval')}>
            <CheckCircle size={15} /> QA Audit Queue ({pendingSales.length})
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('team-attendance')}>
            <Clock size={15} /> Shift Roster
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAdvancedModal(true)}>
            <Settings size={15} /> Advanced
          </button>
        </div>
      </div>

      {/* 4 Visual KPI Cards (PKR Currency) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head"><span>Campaign Sales Revenue</span><div className="kpi-icon"><DollarSign size={16} /></div></div>
          <div className="kpi-value">{formatPKR(totalRevenuePkr)}</div>
          <div className="kpi-sub"><span className="text-success">{approvedSales.length} Approved Deals</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Pending QA Audit</span><div className="kpi-icon"><Clock size={16} /></div></div>
          <div className="kpi-value">{pendingSales.length}</div>
          <div className="kpi-sub"><span className="text-warning">Awaiting Audit</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>QA Approval Rate</span><div className="kpi-icon"><TrendingUp size={16} /></div></div>
          <div className="kpi-value">{approvalRate}%</div>
          <div className="kpi-sub"><span>{totalSubmissions} Campaign Submissions</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Assigned Agents</span><div className="kpi-icon"><Users size={16} /></div></div>
          <div className="kpi-value">{assignedAgentsCount}</div>
          <div className="kpi-sub"><span>Allowed Access</span></div>
        </div>
      </div>

      {/* 2 Clean Cards: QA Audit Queue & Active Campaign Details */}
      <div className="grid-2">
        {/* Urgent Pending QA Audit Queue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} className="text-warning" /> Urgent QA Audit Queue ({pendingSales.length})</span>
            <button className="text-btn" onClick={() => setActiveTab('qa-approval')}>View All</button>
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
                    <button className="btn btn-success btn-sm" onClick={() => onApproveSale(s.id, 'Approved by QA Operations')}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onRejectSale(s.id, 'Disqualified by QA Audit')}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Progress */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Briefcase size={16} className="text-blue" /> Campaign Status Summary</span>
            <button className="text-btn" onClick={() => setActiveTab('projects')}>Manage</button>
          </div>
          <div className="minimal-list">
            {projects.map(p => {
              const pct = Math.min(Math.round((p.totalRevenuePkr / p.monthlyTargetPkr) * 100), 100);
              return (
                <div key={p.id} className="minimal-list-item">
                  <div>
                    <div className="item-title">{p.name}</div>
                    <div className="item-desc">{formatPKR(p.totalRevenuePkr)} / {formatPKR(p.monthlyTargetPkr)}</div>
                  </div>
                  <span className={`badge ${pct >= 80 ? 'badge-success' : 'badge-warning'}`}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Management Modal */}
      {showAdvancedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Advanced Operations Management</span>
              <button className="icon-btn" onClick={() => setShowAdvancedModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="advanced-options-grid">
                <button className="adv-option-card" onClick={() => { setActiveTab('payroll'); setShowAdvancedModal(false); }}>
                  <FileSpreadsheet size={20} className="text-blue" />
                  <div className="adv-title">Salary & Payroll Engine</div>
                  <div className="adv-desc">PKR base pay, commissions & payslips</div>
                </button>

                <button className="adv-option-card" onClick={() => { setActiveTab('targets'); setShowAdvancedModal(false); }}>
                  <Target size={20} className="text-blue" />
                  <div className="adv-title">Target Matrix Editor</div>
                  <div className="adv-desc">Configure agent PKR targets</div>
                </button>

                <button className="adv-option-card" onClick={() => { setActiveTab('projects'); setShowAdvancedModal(false); }}>
                  <Briefcase size={20} className="text-blue" />
                  <div className="adv-title">Campaign Controls</div>
                  <div className="adv-desc">Create campaigns & assign agents</div>
                </button>

                <button className="adv-option-card" onClick={() => { setActiveTab('reports'); setShowAdvancedModal(false); }}>
                  <Settings size={20} className="text-blue" />
                  <div className="adv-title">Reports & CSV Export</div>
                  <div className="adv-desc">Export sales, attendance & payroll CSVs</div>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowAdvancedModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-overview-container { display: flex; flex-direction: column; }
        .empty-qa-box { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem; background: var(--status-success-bg); border: 1px solid var(--status-success-border); border-radius: var(--radius-sm); color: var(--status-success); font-size: 0.8rem; }
        .minimal-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .minimal-list-item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .item-title { font-size: 0.825rem; font-weight: 600; }
        .item-desc { font-size: 0.725rem; color: var(--text-subtle); }
        .btn-group-sm { display: flex; gap: 0.35rem; }
        .advanced-options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .adv-option-card { display: flex; flex-direction: column; align-items: flex-start; padding: 1rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease; text-align: left; }
        .adv-option-card:hover { border-color: var(--accent); background: var(--bg-hover); }
        .adv-title { font-size: 0.875rem; font-weight: 700; color: var(--text-main); margin-top: 0.5rem; }
        .adv-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}
