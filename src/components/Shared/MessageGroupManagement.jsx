import React, { useState } from 'react';
import { Plus, Trash2, Users as UsersIcon, X } from 'lucide-react';

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function MessageGroupManagement({ currentUser, users, groups, onCreateGroup, onUpdateMembers, onDeleteGroup }) {
  const isAdmin = currentUser.role === 'Admin';
  const ownCampaignIds = currentUser.allowedCampaignIds || [];

  // Who this user is allowed to add: Admin -> anyone active; Supervisor -> self + agents sharing their campaigns.
  const assignableUsers = isAdmin
    ? users.filter(u => u.status === 'Active')
    : users.filter(u => u.status === 'Active' && (u.id === currentUser.id || (u.role === 'Agent' && (u.allowedCampaignIds || []).some(id => ownCampaignIds.includes(id)))));

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', memberIds: [] });
  const [error, setError] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [editMemberIds, setEditMemberIds] = useState([]);

  const openCreate = () => {
    setCreateForm({ name: '', memberIds: [] });
    setError('');
    setShowCreateModal(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setEditMemberIds(group.memberIds);
  };

  const toggle = (userId, list, setList) => {
    setList(list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!createForm.name.trim()) {
      setError('Group name is required.');
      return;
    }
    const id = `grp_${slugify(createForm.name)}_${Date.now()}`;
    try {
      await onCreateGroup({ id, name: createForm.name, memberIds: createForm.memberIds });
      setShowCreateModal(false);
    } catch (err) {
      setError(err.message || 'Could not create group.');
    }
  };

  const handleSaveMembers = async (e) => {
    e.preventDefault();
    await onUpdateMembers(editingGroup.id, editMemberIds);
    setEditingGroup(null);
  };

  return (
    <div className="message-group-management-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Message Groups</h1>
          <p className="page-subtitle">Control which broadcast channels exist and exactly who belongs to each one.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} /> New Group
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Members</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem' }}>No message groups yet.</td></tr>
            ) : (
              groups.map(g => (
                <tr key={g.id}>
                  <td className="font-bold">{g.name}</td>
                  <td className="text-sm">{g.members.map(m => m.name).join(', ') || '—'}</td>
                  <td>
                    <div className="btn-group-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(g)}>
                        <UsersIcon size={13} /> Edit Members
                      </button>
                      {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => onDeleteGroup(g.id)}>
                          <Trash2 size={13} /> Delete
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

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">New Message Group</span>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {error && <div className="error-alert">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Group Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Night Shift Team"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Members</label>
                  <div className="agent-checkboxes-list">
                    {assignableUsers.length === 0 ? (
                      <div className="text-subtle text-sm">No users available to add.</div>
                    ) : assignableUsers.map(u => (
                      <label key={u.id} className="agent-checkbox-item">
                        <input
                          type="checkbox"
                          checked={createForm.memberIds.includes(u.id)}
                          onChange={() => toggle(u.id, createForm.memberIds, (list) => setCreateForm({ ...createForm, memberIds: list }))}
                        />
                        <span>{u.name} ({u.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingGroup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Edit Members — {editingGroup.name}</span>
              <button className="icon-btn" onClick={() => setEditingGroup(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveMembers}>
              <div className="modal-body">
                <div className="agent-checkboxes-list">
                  {assignableUsers.length === 0 ? (
                    <div className="text-subtle text-sm">No users available to add.</div>
                  ) : assignableUsers.map(u => (
                    <label key={u.id} className="agent-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editMemberIds.includes(u.id)}
                        onChange={() => toggle(u.id, editMemberIds, setEditMemberIds)}
                      />
                      <span>{u.name} ({u.role})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingGroup(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Members</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .agent-checkboxes-list { display: flex; flex-direction: column; gap: 0.4rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); max-height: 260px; overflow-y: auto; }
        .agent-checkbox-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; cursor: pointer; }
      `}</style>
    </div>
  );
}
