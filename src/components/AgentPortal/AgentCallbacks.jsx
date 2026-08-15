import React, { useState } from 'react';
import { PhoneCall, PlusCircle, CheckCircle, Clock, AlertTriangle, Trash2, Calendar, X } from 'lucide-react';

export default function AgentCallbacks({ currentUser, callbacks, onAddCallback, onCompleteCallback }) {
  const [filter, setFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    projectName: 'US Solar Direct',
    dueDate: '',
    priority: 'Medium',
    notes: ''
  });

  const myCallbacks = callbacks.filter(c => c.agentId === currentUser.id);

  const filteredCallbacks = myCallbacks.filter(c => {
    if (filter === 'Pending') return c.status === 'Pending';
    if (filter === 'Overdue') return c.status === 'Overdue';
    if (filter === 'Completed') return c.status === 'Completed';
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newCb = {
      id: `cb_${Math.floor(Math.random() * 1000)}`,
      customerName: formData.customerName,
      phone: formData.phone,
      projectName: formData.projectName,
      agentId: currentUser.id,
      dueDate: formData.dueDate || new Date().toLocaleString(),
      priority: formData.priority,
      status: 'Pending',
      notes: formData.notes
    };
    onAddCallback(newCb);
    setShowAddModal(false);
    setFormData({ customerName: '', phone: '', projectName: 'US Solar Direct', dueDate: '', priority: 'Medium', notes: '' });
  };

  return (
    <div className="callbacks-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Callbacks & Task Reminders</h1>
          <p className="page-subtitle">Manage customer callback schedules, follow-up priority and overdue alerts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <PlusCircle size={16} /> Schedule Callback
        </button>
      </div>

      <div className="card margin-bottom flex-between">
        <div className="tabs-header">
          <button className={`tab-btn ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')}>All</button>
          <button className={`tab-btn ${filter === 'Pending' ? 'active' : ''}`} onClick={() => setFilter('Pending')}>Pending</button>
          <button className={`tab-btn ${filter === 'Overdue' ? 'active' : ''}`} onClick={() => setFilter('Overdue')}>Overdue</button>
          <button className={`tab-btn ${filter === 'Completed' ? 'active' : ''}`} onClick={() => setFilter('Completed')}>Completed</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Campaign</th>
              <th>Due Date & Time</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCallbacks.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No callbacks scheduled.</td>
              </tr>
            ) : (
              filteredCallbacks.map(cb => (
                <tr key={cb.id}>
                  <td className="font-bold">{cb.customerName}</td>
                  <td className="text-cyan font-mono">{cb.phone}</td>
                  <td>{cb.projectName}</td>
                  <td>{cb.dueDate}</td>
                  <td>
                    <span className={`badge ${cb.priority === 'High' ? 'badge-error' : cb.priority === 'Medium' ? 'badge-warning' : 'badge-neutral'}`}>
                      {cb.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${cb.status === 'Completed' ? 'badge-success' : cb.status === 'Overdue' ? 'badge-error' : 'badge-warning'}`}>
                      {cb.status}
                    </span>
                  </td>
                  <td className="text-muted" style={{ maxWidth: '240px' }}>{cb.notes}</td>
                  <td>
                    {cb.status !== 'Completed' && (
                      <button className="btn btn-success btn-sm" onClick={() => onCompleteCallback(cb.id)}>
                        <CheckCircle size={14} /> Done
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Schedule New Callback</span>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input type="text" className="form-input" required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input type="text" className="form-input" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Due Date / Time *</label>
                    <input type="datetime-local" className="form-input" required value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
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
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Callback</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
