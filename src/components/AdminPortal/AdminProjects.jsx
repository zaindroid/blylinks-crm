import React, { useState } from 'react';
import { Briefcase, PlusCircle, CheckCircle, Edit3, Trash2, Users, ShieldCheck, X } from 'lucide-react';

export default function AdminProjects({ projects, users, onAddProject, onUpdateProject, onToggleProjectStatus }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const agents = users.filter(u => u.role === 'Agent');

  const [formData, setFormData] = useState({
    name: '',
    client: '',
    category: 'Outbound Telesales',
    monthlySalesGoal: '',
    assignedAgentIds: []
  });

  const handleOpenCreate = () => {
    setFormData({ name: '', client: '', category: 'Outbound Telesales', monthlySalesGoal: '', assignedAgentIds: [] });
    setShowAddModal(true);
  };

  const handleOpenEdit = (proj) => {
    setEditingProject(proj);
    setFormData({
      name: proj.name,
      client: proj.client,
      category: proj.category,
      monthlySalesGoal: proj.monthlySalesGoal ?? '',
      assignedAgentIds: proj.assignedAgentIds || []
    });
  };

  const handleToggleAgentAssignment = (agentId) => {
    const current = formData.assignedAgentIds || [];
    if (current.includes(agentId)) {
      setFormData({ ...formData, assignedAgentIds: current.filter(id => id !== agentId) });
    } else {
      setFormData({ ...formData, assignedAgentIds: [...current, agentId] });
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const newProj = {
      id: `camp_${Math.floor(Math.random() * 1000)}`,
      name: formData.name,
      client: formData.client,
      category: formData.category,
      monthlySalesGoal: Number(formData.monthlySalesGoal),
      status: 'Active',
      assignedAgentIds: formData.assignedAgentIds,
      totalSalesCount: 0,
      monthSalesCount: 0
    };
    onAddProject(newProj);
    setShowAddModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingProject) return;
    onUpdateProject(editingProject.id, {
      name: formData.name,
      client: formData.client,
      category: formData.category,
      monthlySalesGoal: Number(formData.monthlySalesGoal),
      assignedAgentIds: formData.assignedAgentIds
    });
    setEditingProject(null);
  };

  return (
    <div className="admin-projects-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaign & Project Controls</h1>
          <p className="page-subtitle">Configure outbound & inbound call center campaigns, set PKR targets and assign allowed agent access.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <PlusCircle size={15} /> Create New Campaign
        </button>
      </div>

      <div className="grid-2 margin-bottom">
        {projects.map(p => {
          const assignedAgents = agents.filter(a => p.assignedAgentIds?.includes(a.id));
          const pct = p.monthlySalesGoal > 0 ? Math.min(Math.round((p.monthSalesCount / p.monthlySalesGoal) * 100), 100) : 0;

          return (
            <div key={p.id} className="card">
              <div className="card-header">
                <span className="card-title"><Briefcase size={16} className="text-blue" /> {p.name}</span>
                <span className={`badge ${p.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{p.status}</span>
              </div>

              <div className="project-details-grid margin-bottom">
                <div><span className="text-muted text-xs">CLIENT:</span> <span className="font-bold">{p.client}</span></div>
                <div><span className="text-muted text-xs">CATEGORY:</span> <span>{p.category}</span></div>
                <div><span className="text-muted text-xs">ASSIGNED AGENTS:</span> <span className="font-bold">{assignedAgents.length} Agents</span></div>
              </div>

              <div className="target-progress-block">
                <div className="target-labels">
                  <span className="label-text">Monthly Sales Goal Progress</span>
                  <span className="val-text">{p.monthSalesCount} / {p.monthlySalesGoal} sales this month</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                </div>
              </div>

              <div className="project-actions margin-top">
                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(p)}>
                  <Edit3 size={13} /> Edit / Assign Agents
                </button>
                <button 
                  className={`btn btn-sm ${p.status === 'Active' ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => onToggleProjectStatus(p.id)}
                >
                  {p.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Campaign Modal */}
      {(showAddModal || editingProject) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">{editingProject ? `Edit ${editingProject.name}` : 'Create New Campaign'}</span>
              <button className="icon-btn" onClick={() => { setShowAddModal(false); setEditingProject(null); }}><X size={18} /></button>
            </div>
            <form onSubmit={editingProject ? handleEditSubmit : handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Campaign Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Solar Campaign PKR" />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input type="text" className="form-input" required value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})} placeholder="e.g. EcoPower Pakistan" />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Sales Goal (No. of Sales) *</label>
                  <input type="number" className="form-input" required min="0" step="1" value={formData.monthlySalesGoal} onChange={e => setFormData({...formData, monthlySalesGoal: e.target.value})} placeholder="e.g. 150" />
                </div>

                {/* Agent Access Assignment List */}
                <div className="form-group margin-top">
                  <label className="form-label flex-align"><Users size={13} /> Allowed Agents (Who can see & work on this campaign):</label>
                  <div className="agent-checkboxes-list">
                    {agents.map(a => {
                      const isChecked = formData.assignedAgentIds?.includes(a.id);
                      return (
                        <label key={a.id} className="agent-checkbox-item">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleToggleAgentAssignment(a.id)} 
                          />
                          <span>{a.name} ({a.designation})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditingProject(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary"><CheckCircle size={15} /> Save Campaign Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .project-details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.8rem; }
        .project-actions { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.65rem; }
        .agent-checkboxes-list { display: flex; flex-direction: column; gap: 0.4rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
        .agent-checkbox-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; cursor: pointer; }
      `}</style>
    </div>
  );
}
