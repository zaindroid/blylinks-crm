import React, { useState } from 'react';
import { Target, Edit3, CheckCircle, X } from 'lucide-react';

export default function AdminTargets({ targets, onUpdateTarget }) {
  const [editingTarget, setEditingTarget] = useState(null);
  const [formData, setFormData] = useState({ dailyTarget: '', weeklyTarget: '', monthlyTarget: '' });

  const handleEditClick = (t) => {
    setEditingTarget(t);
    setFormData({ dailyTarget: t.dailyTarget, weeklyTarget: t.weeklyTarget, monthlyTarget: t.monthlyTarget });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!editingTarget) return;
    onUpdateTarget(editingTarget.agentId, {
      dailyTarget: Number(formData.dailyTarget),
      weeklyTarget: Number(formData.weeklyTarget),
      monthlyTarget: Number(formData.monthlyTarget)
    });
    setEditingTarget(null);
  };

  return (
    <div className="admin-targets-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent & Project Target Matrix</h1>
          <p className="page-subtitle">Configure daily, weekly and monthly sales target goals for individual agents.</p>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Daily Target ($)</th>
              <th>Daily Achieved ($)</th>
              <th>Weekly Target ($)</th>
              <th>Monthly Target ($)</th>
              <th>Monthly Progress</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {targets.map(t => {
              const monthlyPct = Math.min(Math.round((t.monthlyAchieved / t.monthlyTarget) * 100), 100);
              return (
                <tr key={t.agentId}>
                  <td className="font-bold">{t.agentName}</td>
                  <td className="font-mono">${t.dailyTarget.toLocaleString()}</td>
                  <td className="font-mono text-cyan">${t.dailyAchieved.toLocaleString()}</td>
                  <td className="font-mono">${t.weeklyTarget.toLocaleString()}</td>
                  <td className="font-mono">${t.monthlyTarget.toLocaleString()}</td>
                  <td>
                    <div className="progress-bar-container" style={{ width: '120px' }}>
                      <div className="progress-bar-fill" style={{ width: `${monthlyPct}%` }}></div>
                    </div>
                    <span className="text-xs text-muted">{monthlyPct}% (${t.monthlyAchieved.toLocaleString()})</span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(t)}>
                      <Edit3 size={14} /> Edit Targets
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Edit Targets for {editingTarget.agentName}</span>
              <button className="icon-btn" onClick={() => setEditingTarget(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Daily Target ($)</label>
                  <input type="number" className="form-input" value={formData.dailyTarget} onChange={e => setFormData({...formData, dailyTarget: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Weekly Target ($)</label>
                  <input type="number" className="form-input" value={formData.weeklyTarget} onChange={e => setFormData({...formData, weeklyTarget: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Target ($)</label>
                  <input type="number" className="form-input" value={formData.monthlyTarget} onChange={e => setFormData({...formData, monthlyTarget: e.target.value})} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
