import React, { useMemo, useState } from 'react';
import { filterByDateRange } from '../../utils/dateFilters';
import { formatPKR } from '../../utils/currency';

const RANK_STYLES = ['gold', 'silver', 'bronze'];

export default function SalesLeaderboard({ sales, campaignId }) {
  const [scope, setScope] = useState('Today');

  const ranked = useMemo(() => {
    const scoped = campaignId ? sales.filter(s => s.campaignId === campaignId) : sales;
    const approved = scoped.filter(s => s.status === 'Approved');
    const inRange = filterByDateRange(approved, 'saleDateIso', scope);

    const byAgent = {};
    for (const s of inRange) {
      if (!byAgent[s.agentId]) byAgent[s.agentId] = { agentId: s.agentId, agentName: s.agentName, revenue: 0, count: 0 };
      byAgent[s.agentId].revenue += Number(s.amount);
      byAgent[s.agentId].count += 1;
    }
    return Object.values(byAgent).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [sales, campaignId, scope]);

  return (
    <div className="card sales-leaderboard">
      <div className="card-header">
        <span className="card-title">Sales Board</span>
        <div className="leaderboard-scope-toggle">
          {['Today', 'This Month'].map(s => (
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

      {ranked.length === 0 ? (
        <div className="leaderboard-empty">No approved sales in this period yet.</div>
      ) : (
        <div className="leaderboard-list">
          {ranked.map((row, idx) => (
            <div key={row.agentId} className="leaderboard-row">
              <div className={`leaderboard-rank ${RANK_STYLES[idx] || ''}`}>
                {idx + 1}
              </div>
              <div className="leaderboard-name">{row.agentName}</div>
              <div className="leaderboard-stats">
                <span className="font-mono text-accent">{formatPKR(row.revenue)}</span>
                <span className="leaderboard-count">{row.count} sale{row.count === 1 ? '' : 's'}</span>
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
        .leaderboard-rank { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 50%; background: var(--bg-tertiary); color: var(--text-muted); flex-shrink: 0; }
        .leaderboard-rank.gold { background: #fef3c7; color: #b45309; }
        .leaderboard-rank.silver { background: #e5e7eb; color: #4b5563; }
        .leaderboard-rank.bronze { background: #fed7aa; color: #9a3412; }
        .leaderboard-name { flex: 1; font-size: 0.8rem; font-weight: 600; }
        .leaderboard-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
        .leaderboard-count { font-size: 0.65rem; color: var(--text-subtle); }
      `}</style>
    </div>
  );
}
