import React, { useState } from 'react';
import { Users, PlusCircle, Search, Filter, Download, Eye, XCircle, X } from 'lucide-react';

export default function LeadManagement({ leads, currentUser, users, projects, onAddLead, onUpdateLeadStatus }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    projectName: 'US Residential Solar',
    assignedAgentId: users.find(u => u.role === 'Agent')?.id || '',
    notes: ''
  });

  const isManagerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

  // Agents only see their assigned leads
  const viewableLeads = isManagerOrAdmin 
    ? leads 
    : leads.filter(l => l.assignedAgentId === currentUser.id);

  const filteredLeads = viewableLeads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.phone.includes(searchTerm) || 
                          l.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Campaign', 'Assigned Agent', 'Status', 'Last Contact', 'Notes'];
    const rows = filteredLeads.map(l => [l.id, l.name, l.phone, l.email, l.projectName, l.assignedAgentName, l.status, l.lastContact, `"${l.notes}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Blylinks_Leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateLead = (e) => {
    e.preventDefault();
    const assignedAgent = users.find(u => u.id === formData.assignedAgentId) || currentUser;
    const newLead = {
      id: `lead_${Math.floor(Math.random() * 1000)}`,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      projectName: formData.projectName,
      source: 'Manager Lead Input',
      assignedAgentId: assignedAgent.id,
      assignedAgentName: assignedAgent.name,
      status: 'New',
      lastContact: new Date().toISOString().slice(0, 10),
      nextCallback: '',
      notes: formData.notes
    };
    onAddLead(newLead);
    setShowAddModal(false);
    setFormData({ name: '', phone: '', email: '', address: '', projectName: 'US Residential Solar', assignedAgentId: users.find(u => u.role === 'Agent')?.id || '', notes: '' });
  };

  return (
    <div className="lead-management-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isManagerOrAdmin ? 'Lead CRM & Campaign Assignment' : 'My Assigned Leads'}</h1>
          <p className="page-subtitle">
            {isManagerOrAdmin 
              ? 'Manager console for creating leads, routing contacts and assigning sales agents.' 
              : 'View assigned customer contacts and update call disposition status.'}
          </p>
        </div>

        {/* Add Lead & Export options restricted to Manager/Admin */}
        {isManagerOrAdmin && (
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <PlusCircle size={15} /> Add New Lead
            </button>
          </div>
        )}
      </div>

      <div className="card margin-bottom flex-between">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search leads by name, phone or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="filter-box">
          <Filter size={15} className="text-muted" />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Dispositions</option>
            <option value="New">New Lead</option>
            <option value="Contacted">Contacted</option>
            <option value="Interested">Interested</option>
            <option value="Callback">Callback</option>
            <option value="Sale">Sale</option>
            <option value="Not Interested">Not Interested</option>
            <option value="No Answer">No Answer</option>
            <option value="Wrong Number">Wrong Number</option>
            <option value="Do Not Call">Do Not Call (DNC)</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lead Name</th>
              <th>Phone</th>
              <th>Campaign</th>
              <th>Assigned Agent</th>
              <th>Call Disposition</th>
              <th>Last Contact</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem' }}>No leads found matching criteria.</td></tr>
            ) : (
              filteredLeads.map(l => (
                <tr key={l.id}>
                  <td className="font-bold">{l.name}</td>
                  <td className="font-mono text-blue">{l.phone}</td>
                  <td>{l.projectName}</td>
                  <td>{l.assignedAgentName}</td>
                  <td>
                    <select 
                      className="form-select text-xs" 
                      value={l.status}
                      onChange={(e) => onUpdateLeadStatus(l.id, e.target.value)}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Interested">Interested</option>
                      <option value="Callback">Callback</option>
                      <option value="Sale">Sale</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="No Answer">No Answer</option>
                      <option value="Wrong Number">Wrong Number</option>
                      <option value="Do Not Call">Do Not Call</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                  <td className="text-muted">{l.lastContact}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLead(l)}>
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Lead Timeline Drawer */}
      {selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Lead Timeline — {selectedLead.name}</span>
              <button className="icon-btn" onClick={() => setSelectedLead(null)}><XCircle size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="details-grid margin-bottom">
                <div><strong>Phone:</strong> {selectedLead.phone}</div>
                <div><strong>Email:</strong> {selectedLead.email}</div>
                <div><strong>Campaign:</strong> {selectedLead.projectName}</div>
                <div><strong>Assigned Agent:</strong> {selectedLead.assignedAgentName}</div>
                <div><strong>Disposition:</strong> {selectedLead.status}</div>
              </div>
              <div className="notes-box">
                <div className="notes-header">Agent Call Notes:</div>
                <div className="notes-content">{selectedLead.notes}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSelectedLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal (Managers & Admins only) */}
      {showAddModal && isManagerOrAdmin && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Manager Add New Lead</span>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateLead}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Emily Watson" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input type="text" className="form-input" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Campaign</label>
                    <select className="form-select" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})}>
                      {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Agent</label>
                    <select className="form-select" value={formData.assignedAgentId} onChange={e => setFormData({...formData, assignedAgentId: e.target.value})}>
                      {users.filter(u => u.role === 'Agent').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Notes</label>
                  <textarea className="form-textarea" rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
