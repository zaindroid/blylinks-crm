import React, { useState } from 'react';
import { DollarSign, Search, Filter, CheckCircle, Clock, XCircle, PlusCircle, Eye } from 'lucide-react';

export default function AgentSalesTracker({ currentUser, sales, onOpenSaleModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedSale, setSelectedSale] = useState(null);

  const mySales = sales.filter(s => s.agentId === currentUser.id);

  const filteredSales = mySales.filter(s => {
    const matchesSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="sales-tracker-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Personal Sales Tracker</h1>
          <p className="page-subtitle">View your total submitted sales, QA review statuses and agent notes.</p>
        </div>
        <button className="btn btn-primary" onClick={onOpenSaleModal}>
          <PlusCircle size={16} /> Submit New Sale
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card margin-bottom flex-between">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by customer name, sale ID, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="filter-box">
          <Filter size={16} className="text-muted" />
          <select 
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending QA</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sales Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Customer Name</th>
              <th>Campaign</th>
              <th>Amount ($)</th>
              <th>Status</th>
              <th>Date & Time</th>
              <th>QA Verified By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                  No sales records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="font-mono">{sale.id}</td>
                  <td className="font-bold">{sale.customerName}</td>
                  <td>{sale.projectName}</td>
                  <td className="font-mono text-cyan">${sale.amount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${
                      sale.status === 'Approved' ? 'badge-success' :
                      sale.status === 'Pending' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="text-muted">{sale.date}</td>
                  <td>{sale.verifiedBy || '--'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSale(sale)}>
                      <Eye size={14} /> Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Sale Audit Details — {selectedSale.id}</span>
              <button className="icon-btn" onClick={() => setSelectedSale(null)}><XCircle size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="details-grid">
                <div><strong>Customer Name:</strong> {selectedSale.customerName}</div>
                <div><strong>Phone:</strong> {selectedSale.phone}</div>
                <div><strong>Email:</strong> {selectedSale.email}</div>
                <div><strong>Campaign:</strong> {selectedSale.projectName}</div>
                <div><strong>Sale Amount:</strong> ${selectedSale.amount}</div>
                <div><strong>Status:</strong> {selectedSale.status}</div>
              </div>

              <div className="notes-box margin-top">
                <div className="notes-header">Agent Submission Notes:</div>
                <div className="notes-content">{selectedSale.agentNotes}</div>
              </div>

              {selectedSale.qaNotes && (
                <div className="notes-box margin-top qa-notes-bg">
                  <div className="notes-header">QA / Management Notes:</div>
                  <div className="notes-content">{selectedSale.qaNotes}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSale(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
