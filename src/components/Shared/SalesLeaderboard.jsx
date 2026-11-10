import React, { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../../api/sales';
import { formatPKR } from '../../utils/currency';

const RANK_STYLES = ['gold', 'silver', 'bronze'];

// Org-wide, every role sees the same board -- a Supervisor/Agent's own `sales` list is already
// scoped server-side to their own campaign/their own deals, so ranking off it client-side could
// never show real peers. This instead calls GET /api/sales/leaderboard, which returns only
// agent name + aggregate counts/revenue (no customer PII), safe to show to anyone logged in.
export default function SalesLeaderboard({ currentUser }) {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [scope, setScope] = useState('This Month');

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError(err.message || 'Could not load the leaderboard.'); });
    return () => { cancelled = true; };
  }, []);

  const countOf = (r) => (scope === 'This Month' ? r.monthSubmittedCount : r.submittedCount);
  const ranked = (rows || [])
    .filter(r => countOf(r) > 0)
    .slice()
    .sort((a, b) => countOf(b) - countOf(a))
    .slice(0, 8);

  return (
    <div className="card sales-leaderboard">
      <div className="card-header">
        <span className="card-title">Sales Board — by Number of Sales Submitted</span>
        <div className="leaderboard-scope-toggle">
          {['This Month', 'All Time'].map(s => (
            <button
              key={s}
              className={`leaderboard-scope-btn ${scope === s ? 'active' : ''}`}
              onClick={() => setScope(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="leaderboard-empty">{error}</div>}
      {!error && rows === null && <div className="leaderboard-empty">Loading…</div>}
      {!error && rows !== null && ranked.length === 0 && (
        <div className="leaderboard-empty">No sales submitted in this period yet.</div>
      )}

      {!error && ranked.length > 0 && (
        <div className="leaderboard-list">
          {ranked.map((row, idx) => (
            <div key={row.agentId} className={`leaderboard-row ${currentUser && row.agentId === currentUser.id ? 'leaderboard-row-me' : ''}`}>
              <div className={`leaderboard-rank ${RANK_STYLES[idx] || ''}`}>
                {idx + 1}
              </div>
              <div className="leaderboard-name">{row.agentName}{currentUser && row.agentId === currentUser.id ? ' (You)' : ''}</div>
              <div className="leaderboard-stats">
                <span className="leaderboard-count">{countOf(row)} submitted</span>
                <span className="font-mono text-accent">{formatPKR(row.approvedRevenuePkr)} approved, all-time</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sales-leaderboard { display: flex; flex-direction: column; }
        .leaderboard-scope-toggle { display: flex; gap: 0.25rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 2px; }
        .leaderboard-scope-btn { border: none; background: transparent; font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.55rem; border-radius: 6px; cursor: pointer; color: var(--text-muted); }
        .leaderboard-scope-btn.active { background: var(--accent); color: #fff; }
        .leaderboard-empty { font-size: 0.8rem; color: var(--text-subtle); padding: 0.75rem 0; text-align: center; }
        .leaderboard-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .leaderboard-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .leaderboard-row-me { border-color: var(--accent); }
        .leaderboard-rank { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 50%; background: var(--bg-tertiary); color: var(--text-muted); flex-shrink: 0; }
        .leaderboard-rank.gold { background: #fef3c7; color: #b45309; }
        .leaderboard-rank.silver { background: #e5e7eb; color: #4b5563; }
        .leaderboard-rank.bronze { background: #fed7aa; color: #9a3412; }
        .leaderboard-name { flex: 1; font-size: 0.8rem; font-weight: 600; }
        .leaderboard-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
        .leaderboard-count { font-size: 0.7rem; font-weight: 700; color: var(--text-blue, #2563eb); }
      `}</style>
    </div>
  );
}
