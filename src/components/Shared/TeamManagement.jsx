import React, { useState } from 'react';
import { UserPlus, Trash2, Settings, X, Users as UsersIcon } from 'lucide-react';

const ROLE_OPTIONS = ['Admin', 'Supervisor', 'Agent'];

export default function TeamManagement({ currentUser, users, projects, onAddUser, onDeactivateUser, onUpdateUserCampaigns }) {
  const isAdmin = currentUser.role === 'Admin';
  const isSupervisor = currentUser.role === 'Supervisor';

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccessFor, setEditingAccessFor] = useState(null);
  const [error, setError] = useState('');

  const ownCampaignIds = currentUser.allowedCampaignIds || [];
  const assignableCampaigns = isAdmin ? projects : projects.filter(p => ownCampaignIds.includes(p.id));

  const visibleUsers = isAdmin
    ? users
    : users.filter(u =>
        u.id === currentUser.id ||
        (u.role === 'Agent' && (u.allowedCampaignIds || []).some(id => ownCampaignIds.includes(id)))
      );

  const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'Agent', campaignIds: [] });
  const [accessCampaignIds, setAccessCampaignIds] = useState([]);

  const openAddModal = () => {
    setFormData({ name: '', username: '', password: '', role: isSupervisor ? 'Agent' : 'Agent', campaignIds: [] });
    setError('');
    setShowAddModal(true);
  };

  const openEditAccess = (user) => {
    setAccessCampaignIds(user.allowedCampaignIds || []);
    setEditingAccessFor(user);
  };

  const toggleCampaign = (campaignId, listSetter, list) => {
    listSetter(list.includes(campaignId) ? list.filter(id => id !== campaignId) : [...list, campaignId]);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onAddUser({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        role: isAdmin ? formData.role : 'Agent',
        campaignIds: formData.campaignIds
      });
      setShowAddModal(false);
    } catch (err) {
      setError(err.message || 'Could not add user.');
    }
  };

  const handleRemove = (user) => {
    onDeactivateUser(user.id);
  };

  const handleSaveAccess = async (e) => {
    e.preventDefault();
    await onUpdateUserCampaigns(editingAccessFor.id, accessCampaignIds);
    setEditingAccessFor(null);
  };

  const campaignNames = (ids) => (ids || [])
    .map(id => projects.find(p => p.id === id)?.name)
    .filter(Boolean)
    .join(', ') || '—';

  return (
    <div className="team-management-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team & Access</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Manage every account in the organization and their campaign access.'
              : 'Manage the agents assigned to your campaigns.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <UserPlus size={15} /> {isAdmin ? 'Add User' : 'Add Agent'}
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Campaign Access</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem' }}>No team members yet.</td></tr>
            ) : (
              visibleUsers.map(u => (
                <tr key={u.id}>
                  <td className="font-bold">{u.name}</td>
                  <td className="text-muted">{u.username}</td>
                  <td><span className={`badge ${u.role === 'Admin' ? 'badge-error' : u.role === 'Supervisor' ? 'badge-warning' : 'badge-neutral'}`}>{u.role}</span></td>
                  <td className="text-sm">{campaignNames(u.allowedCampaignIds)}</td>
                  <td><span className={`badge ${u.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{u.status}</span></td>
                  <td>
                    <div className="btn-group-sm">
                      {isAdmin && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditAccess(u)} title="Edit campaign access">
                          <Settings size={13} /> Access
                        </button>
                      )}
                      {u.id !== currentUser.id && u.status === 'Active' && (isAdmin || u.role === 'Agent') && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemove(u)}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
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
              <span className="modal-title flex-align"><UsersIcon size={16} /> {isAdmin ? 'Add User' : 'Add Agent'}</span>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {error && <div className="error-alert">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input type="text" className="form-input" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temporary Password *</label>
                    <input type="password" className="form-input" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                </div>

                {isAdmin && (
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}

                {(isAdmin ? formData.role !== 'Admin' : true) && (
                  <div className="form-group margin-top">
                    <label className="form-label">Campaign Access</label>
                    <div className="agent-checkboxes-list">
                      {assignableCampaigns.length === 0 ? (
                        <div className="text-subtle text-sm">No campaigns available to assign yet.</div>
                      ) : assignableCampaigns.map(p => (
                        <label key={p.id} className="agent-checkbox-item">
                          <input
                            type="checkbox"
                            checked={formData.campaignIds.includes(p.id)}
                            onChange={() => toggleCampaign(p.id, (list) => setFormData({ ...formData, campaignIds: list }), formData.campaignIds)}
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAccessFor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Edit Campaign Access — {editingAccessFor.name}</span>
              <button className="icon-btn" onClick={() => setEditingAccessFor(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveAccess}>
              <div className="modal-body">
                <div className="agent-checkboxes-list">
                  {projects.map(p => (
                    <label key={p.id} className="agent-checkbox-item">
                      <input
                        type="checkbox"
                        checked={accessCampaignIds.includes(p.id)}
                        onChange={() => toggleCampaign(p.id, setAccessCampaignIds, accessCampaignIds)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAccessFor(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Access</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .agent-checkboxes-list { display: flex; flex-direction: column; gap: 0.4rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
        .agent-checkbox-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; cursor: pointer; }
      `}</style>
    </div>
  );
}
