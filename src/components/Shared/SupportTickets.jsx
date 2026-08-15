import React, { useState } from 'react';
import { LifeBuoy, PlusCircle, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

export default function SupportTickets({ currentUser, tickets, onAddTicket, onResolveTicket }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ subject: '', category: 'Payroll & Incentives', priority: 'Medium', description: '' });

  const myTickets = currentUser.role === 'Admin' ? tickets : tickets.filter(t => t.agentId === currentUser.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newT = {
      id: `TICK-${Math.floor(Math.random() * 1000)}`,
      agentId: currentUser.id,
      agentName: currentUser.name,
      subject: formData.subject,
      category: formData.category,
      priority: formData.priority,
      status: 'Open',
      date: new Date().toISOString().slice(0, 10),
      description: formData.description
    };
    onAddTicket(newT);
    setShowAddModal(false);
    setFormData({ subject: '', category: 'Payroll & Incentives', priority: 'Medium', description: '' });
  };

  return (
    <div className="support-tickets-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Internal HR & IT Support Request Tickets</h1>
          <p className="page-subtitle">Submit requests regarding hardware setup, commission inquiries, leave requests or softphone issues.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <PlusCircle size={16} /> Submit Support Request
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Agent Name</th>
              <th>Subject</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {myTickets.map(t => (
              <tr key={t.id}>
                <td className="font-mono">{t.id}</td>
                <td className="font-bold">{t.agentName}</td>
                <td>{t.subject}</td>
                <td>{t.category}</td>
                <td>
                  <span className={`badge ${t.priority === 'High' ? 'badge-error' : 'badge-warning'}`}>{t.priority}</span>
                </td>
                <td>
                  <span className={`badge ${t.status === 'Resolved' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span>
                </td>
                <td className="text-muted">{t.date}</td>
                <td>
                  {currentUser.role === 'Admin' && t.status !== 'Resolved' && (
                    <button className="btn btn-success btn-sm" onClick={() => onResolveTicket(t.id)}>
                      <CheckCircle size={14} /> Resolve Ticket
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Submit New Internal Request</span>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Subject Title *</label>
                  <input type="text" className="form-input" required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} placeholder="e.g. Commission Query for July" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="Payroll & Incentives">Payroll & Incentives</option>
                      <option value="IT & Hardware">IT & Hardware</option>
                      <option value="Attendance & Leave">Attendance & Leave</option>
                      <option value="QA Audit Request">QA Audit Request</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Detailed Description *</label>
                  <textarea className="form-textarea" rows="3" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Explain your request in detail..."></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
