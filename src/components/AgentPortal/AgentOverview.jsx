import React, { useState } from 'react';
import { 
  DollarSign, 
  Target, 
  Clock, 
  PhoneCall, 
  CheckCircle, 
  PlusCircle, 
  MessageSquare,
  Settings,
  X,
  BookOpen,
  Briefcase
} from 'lucide-react';
import { formatPKR } from '../../utils/currency';

export default function AgentOverview({ 
  currentUser, 
  sales, 
  targets, 
  callbacks, 
  attendanceStatus, 
  onClockAction,
  onOpenSaleModal,
  onOpenCallbackModal,
  onCompleteCallback,
  setActiveTab,
  selectedCampaignId,
  projects,
  onOpenChat
}) {
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  const activeProject = projects.find(p => p.id === selectedCampaignId) || projects[0];

  // Filter sales to current user AND selected campaign
  const agentSales = sales.filter(s => s.agentId === currentUser.id && s.campaignId === selectedCampaignId);
  const approvedSales = agentSales.filter(s => s.status === 'Approved');
  const pendingSales = agentSales.filter(s => s.status === 'Pending');

  const approvedRevenuePkr = approvedSales.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingRevenuePkr = pendingSales.reduce((acc, curr) => acc + Number(curr.amount), 0);

  const myTarget = targets.find(t => t.agentId === currentUser.id) || {
    dailyTargetPkr: 50000,
    dailyAchievedPkr: approvedRevenuePkr,
    monthlyTargetPkr: 1200000,
    monthlyAchievedPkr: approvedRevenuePkr * 2
  };

  const dailyPct = Math.min(Math.round((approvedRevenuePkr / myTarget.dailyTargetPkr) * 100), 100);
  const remainingDailyPkr = Math.max(0, myTarget.dailyTargetPkr - approvedRevenuePkr);

  const pendingCallbacks = callbacks.filter(c => c.agentId === currentUser.id && c.campaignId === selectedCampaignId && c.status !== 'Completed');

  return (
    <div className="agent-overview-container">
      {/* Top Header Row */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{currentUser.name}</h1>
          <p className="page-subtitle">{currentUser.designation} &bull; Active Campaign: <span className="font-bold text-accent">{activeProject?.name}</span></p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={onOpenSaleModal}>
            <PlusCircle size={15} /> Log Sale
          </button>
          <button
            className={`btn ${attendanceStatus === 'Present' ? 'btn-secondary' : 'btn-success'}`}
            onClick={() => onClockAction(attendanceStatus === 'Present' ? 'Clock Out' : 'Clock In')}
          >
            <Clock size={15} /> {attendanceStatus === 'Present' ? 'Clock Out' : 'Clock In'}
          </button>
          <button className="btn btn-secondary" onClick={onOpenChat}>
            <MessageSquare size={15} /> Chat
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAdvancedModal(true)}>
            <Settings size={15} /> Advanced
          </button>
        </div>
      </div>

      {/* 4 Minimalist Stat Cards (Campaign Specific in PKR) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head"><span>Sales Today (PKR)</span><div className="kpi-icon"><DollarSign size={16} /></div></div>
          <div className="kpi-value">{formatPKR(approvedRevenuePkr)}</div>
          <div className="kpi-sub"><span className="text-success">{approvedSales.length} Approved Deals</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Campaign Target</span><div className="kpi-icon"><Target size={16} /></div></div>
          <div className="kpi-value">{dailyPct}%</div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${dailyPct}%` }}></div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Pending QA Audit</span><div className="kpi-icon"><Clock size={16} /></div></div>
          <div className="kpi-value">{formatPKR(pendingRevenuePkr)}</div>
          <div className="kpi-sub"><span className="text-warning">{pendingSales.length} Deals Pending</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Callbacks Due</span><div className="kpi-icon"><PhoneCall size={16} /></div></div>
          <div className="kpi-value">{pendingCallbacks.length}</div>
          <div className="kpi-sub"><span>{activeProject?.name}</span></div>
        </div>
      </div>

      {/* 2 Clean Cards: Actionable Callbacks & Recent Deals */}
      <div className="grid-2">
        {/* Callbacks Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><PhoneCall size={16} className="text-blue" /> Callbacks ({activeProject?.name})</span>
            <button className="text-btn" onClick={onOpenCallbackModal}>+ New Callback</button>
          </div>
          <div className="minimal-list">
            {pendingCallbacks.length === 0 ? (
              <div className="empty-state-sm">No callbacks due for this campaign.</div>
            ) : (
              pendingCallbacks.slice(0, 3).map(cb => (
                <div key={cb.id} className="minimal-list-item">
                  <div>
                    <div className="item-title">{cb.customerName} <span className="item-sub">{cb.phone}</span></div>
                    <div className="item-desc">{cb.dueDate}</div>
                  </div>
                  <button className="btn btn-success btn-sm" onClick={() => onCompleteCallback(cb.id)}>
                    <CheckCircle size={13} /> Complete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Deals Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><DollarSign size={16} className="text-blue" /> Campaign Sales Activity</span>
            <button className="text-btn" onClick={() => setActiveTab('my-sales')}>View All</button>
          </div>
          <div className="minimal-list">
            {agentSales.length === 0 ? (
              <div className="empty-state-sm">No sales logged for this campaign yet.</div>
            ) : (
              agentSales.slice(0, 3).map(sale => (
                <div key={sale.id} className="minimal-list-item">
                  <div>
                    <div className="item-title">{sale.customerName} <span className="font-mono text-blue">{formatPKR(sale.amount)}</span></div>
                    <div className="item-desc">{sale.date}</div>
                  </div>
                  <span className={`badge ${sale.status === 'Approved' ? 'badge-success' : sale.status === 'Pending' ? 'badge-warning' : 'badge-error'}`}>
                    {sale.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Advanced Tools Modal */}
      {showAdvancedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Advanced Agent Operations</span>
              <button className="icon-btn" onClick={() => setShowAdvancedModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="advanced-options-grid">
                <button className="adv-option-card" onClick={() => { setActiveTab('my-sales'); setShowAdvancedModal(false); }}>
                  <DollarSign size={20} className="text-blue" />
                  <div className="adv-title">Sales Tracker</div>
                  <div className="adv-desc">Sale records & QA review notes</div>
                </button>

                <button className="adv-option-card" onClick={() => { setActiveTab('attendance'); setShowAdvancedModal(false); }}>
                  <Clock size={20} className="text-blue" />
                  <div className="adv-title">Shift Attendance Log</div>
                  <div className="adv-desc">Shift punch timestamps & hours</div>
                </button>

                <button className="adv-option-card" onClick={() => { setActiveTab('knowledge'); setShowAdvancedModal(false); }}>
                  <BookOpen size={20} className="text-blue" />
                  <div className="adv-title">Script Center & KB</div>
                  <div className="adv-desc">Campaign pitches & rebuttals</div>
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
        .agent-overview-container { display: flex; flex-direction: column; }
        .minimal-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .minimal-list-item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .item-title { font-size: 0.825rem; font-weight: 600; }
        .item-sub { font-size: 0.75rem; color: var(--accent); margin-left: 0.35rem; }
        .item-desc { font-size: 0.725rem; color: var(--text-subtle); }
        .empty-state-sm { font-size: 0.8rem; color: var(--text-subtle); text-align: center; padding: 0.75rem 0; }
        .advanced-options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .adv-option-card { display: flex; flex-direction: column; align-items: flex-start; padding: 1rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease; text-align: left; }
        .adv-option-card:hover { border-color: var(--accent); background: var(--bg-hover); }
        .adv-title { font-size: 0.875rem; font-weight: 700; color: var(--text-main); margin-top: 0.5rem; }
        .adv-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}
