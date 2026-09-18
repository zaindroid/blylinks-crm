import React, { useMemo, useState } from 'react';
import { Edit3, CheckCircle, X } from 'lucide-react';
import { countMySales } from '../../utils/celebration';

// Every active agent with their monthly sales target (a number of sales), how many they have logged this month
// (Pakistan time, rejected sales excluded) and how far along they are. Admins can set anyone's target here;
// Supervisors set their own agents' targets from Team & Access.
export default function AdminTargets({ users = [], sales = [], targets = [], onUpdateSalesTarget }) {
  const [editing, setEditing] = useState(null); // the agent being edited
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => users
    .filter(u => u.role === 'Agent' && u.status === 'Active')
    .map(agent => {
      const target = targets.find(t => t.agentId === agent.id)?.monthlySalesTarget || 0;
      const done = countMySales(sales, agent.id).month;
      return {
        agent,
        target,
        done,
        remaining: Math.max(target - done, 0),
        pct: target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0
      };
    }), [users, sales, targets]);

  const openEdit = (row) => {
    setEditing(row.agent);
    setValue(String(row.target));
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return setError('Enter a whole number of sales (0 or more).');
    setSaving(true);
    setError('');
    try {
      await onUpdateSalesTarget(editing.id, n);
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Could not save the target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-targets-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Sales Targets</h1>
          <p className="page-subtitle">Set each agent&apos;s monthly target as a number of sales. Every sale they submit counts towards it, and they can see their progress on their dashboard.</p>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Monthly Sales Target</th>
              <th>Sales This Month</th>
              <th>Remaining</th>
              <th>Progress</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem' }}>No active agents yet.</td></tr>
            ) : rows.map(({ agent, target, done, remaining, pct }) => (
              <tr key={agent.id}>
                <td className="font-bold">{agent.name}</td>
                <td className="font-mono">{target > 0 ? target : <span className="text-subtle">Not set</span>}</td>
                <td className="font-mono text-cyan">{done}</td>
                <td className="font-mono">{target > 0 ? remaining : '—'}</td>
                <td>
                  {target > 0 ? (
                    <>
                      <div className="progress-bar-container" style={{ width: '120px' }}>
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-xs text-muted">{pct}%{done >= target ? ' — target reached' : ''}</span>
                    </>
                  ) : (
                    <span className="text-xs text-subtle">No target</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit({ agent, target })} aria-label={`Set target for ${agent.name}`}>
                    <Edit3 size={14} /> Set Target
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }} role="dialog" aria-label="Set sales target">
            <div className="modal-header">
              <span className="modal-title">Monthly Sales Target — {editing.name}</span>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="target-value">Number of sales per month</label>
                  <input id="target-value" type="number" min="0" step="1" className="form-input" value={value} onChange={e => setValue(e.target.value)} autoFocus placeholder="e.g. 60" />
                  <div className="text-xs text-subtle" style={{ marginTop: '0.35rem' }}>Use 0 to clear the target.</div>
                </div>
                {error && <div className="error-alert" role="alert">{error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}><CheckCircle size={16} /> Save Target</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
