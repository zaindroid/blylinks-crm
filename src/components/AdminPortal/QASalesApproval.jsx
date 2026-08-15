import React, { useState } from 'react';
import { CheckCircle, XCircle, Search, Filter, AlertCircle, FileText, Check, X, ShieldAlert } from 'lucide-react';

export default function QASalesApproval({ sales, currentUser, onApproveSale, onRejectSale }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [activeSaleModal, setActiveSaleModal] = useState(null);
  const [qaActionType, setQaActionType] = useState('Approve'); // Approve or Reject
  const [qaNote, setQaNote] = useState('');

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenActionModal = (sale, action) => {
    setActiveSaleModal(sale);
    setQaActionType(action);
    setQaNote(action === 'Approve' ? 'Audio recording & customer contract verified clean.' : 'Disqualified: Call verification failed.');
  };

  const handleConfirmAction = () => {
    if (!activeSaleModal) return;
    if (qaActionType === 'Approve') {
      onApproveSale(activeSaleModal.id, qaNote);
    } else {
      onRejectSale(activeSaleModal.id, qaNote);
    }
    setActiveSaleModal(null);
  };

  return (
    <div className="qa-approval-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">QA Sales Quality Control & Approval Queue</h1>
          <p className="page-subtitle">Review agent submitted deals, audit audio recordings, approve commissions or reject invalid entries.</p>
        </div>
      </div>

      <div className="card margin-bottom flex-between">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by sale ID, agent or customer..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="filter-box">
          <Filter size={16} className="text-muted" />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending QA Only</option>
            <option value="Approved">Approved Deals</option>
            <option value="Rejected">Rejected Deals</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Agent Name</th>
              <th>Customer Name</th>
              <th>Campaign</th>
              <th>Amount ($)</th>
              <th>Date</th>
              <th>Status</th>
              <th>Agent Notes</th>
              <th>QA Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No sales found in QA queue matching criteria.</td>
              </tr>
            ) : (
              filteredSales.map(sale => (
                <tr key={sale.id}>
                  <td className="font-mono">{sale.id}</td>
                  <td className="font-bold">{sale.agentName}</td>
                  <td>{sale.customerName} <span className="text-subtle text-sm">({sale.phone})</span></td>
                  <td>{sale.projectName}</td>
                  <td className="font-mono text-cyan">${sale.amount.toLocaleString()}</td>
                  <td className="text-muted">{sale.date}</td>
                  <td>
                    <span className={`badge ${
                      sale.status === 'Approved' ? 'badge-success' :
                      sale.status === 'Pending' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="text-subtle text-sm" style={{ maxWidth: '220px' }}>{sale.agentNotes}</td>
                  <td>
                    {sale.status === 'Pending' ? (
                      <div className="btn-group-sm">
                        <button className="btn btn-success btn-sm" onClick={() => handleOpenActionModal(sale, 'Approve')}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleOpenActionModal(sale, 'Reject')}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-subtle text-xs">QA Done by {sale.verifiedBy || 'Admin'}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* QA Confirmation Modal */}
      {activeSaleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                {qaActionType === 'Approve' ? 'Confirm Sale Approval' : 'Reject Sale Record'} — {activeSaleModal.id}
              </span>
              <button className="icon-btn" onClick={() => setActiveSaleModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="sale-summary-box margin-bottom">
                <div><strong>Agent:</strong> {activeSaleModal.agentName}</div>
                <div><strong>Customer:</strong> {activeSaleModal.customerName} ({activeSaleModal.phone})</div>
                <div><strong>Campaign:</strong> {activeSaleModal.projectName}</div>
                <div><strong>Amount:</strong> ${activeSaleModal.amount.toLocaleString()}</div>
              </div>

              <div className="form-group">
                <label className="form-label">QA Review Note & Rejection/Approval Reason *</label>
                <textarea 
                  className="form-textarea"
                  rows="3"
                  value={qaNote}
                  onChange={(e) => setQaNote(e.target.value)}
                  placeholder="Enter reason for audit status update..."
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveSaleModal(null)}>Cancel</button>
              <button 
                className={`btn ${qaActionType === 'Approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleConfirmAction}
              >
                {qaActionType === 'Approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sale-summary-box {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          padding: 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}
