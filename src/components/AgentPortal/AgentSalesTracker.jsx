import React, { useState } from 'react';
import { Search, Filter, PlusCircle, Eye, CalendarRange } from 'lucide-react';
import { DATE_RANGE_PRESETS, filterByDateRange } from '../../utils/dateFilters';
import SaleDetailModal from '../Shared/SaleDetailModal';

export default function AgentSalesTracker({ currentUser, sales, onOpenSaleModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRangePreset, setDateRangePreset] = useState('All Time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);

  const mySales = sales.filter(s => s.agentId === currentUser.id);

  const filteredSales = filterByDateRange(mySales, 'saleDateIso', dateRangePreset, customFrom, customTo).filter(s => {
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
          <p className="page-subtitle">View your total submitted orders, review statuses and agent notes.</p>
        </div>
        <button className="btn btn-primary" onClick={onOpenSaleModal}>
          <PlusCircle size={16} /> Submit New Order
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card margin-bottom">
        <div className="flex-between">
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
              <option value="Pending">Pending Review</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="filter-box margin-top">
          <CalendarRange size={16} className="text-muted" />
          <select className="form-select" value={dateRangePreset} onChange={(e) => setDateRangePreset(e.target.value)}>
            {DATE_RANGE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {dateRangePreset === 'Custom' && (
            <>
              <input type="date" className="form-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-muted text-sm">to</span>
              <input type="date" className="form-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
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
              <th>Verified By</th>
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

      {selectedSale && (
        <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
}
