import React, { useMemo, useState } from 'react';
import { BarChart2, CalendarRange } from 'lucide-react';
import { DATE_RANGE_PRESETS, filterByDateRange } from '../../utils/dateFilters';
import { saleUnitCount, sumSaleUnits } from '../../utils/saleUnits';
import PieChart from './PieChart';

// Org-wide performance report: every sale SUBMITTED (any status -- same definition the leaderboard
// uses) in the selected time range, broken down campaign-wise and agent-wise, as counts and as a
// percentage of the period's total. `sales` is expected to be the unscoped, org-wide list (Admin
// already receives every sale from the API with no campaign filter) -- this component does not
// itself scope by campaign, since the whole point is a combined, cross-campaign total.
export default function PerformanceReport({ sales }) {
  const [rangePreset, setRangePreset] = useState('Today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const inRange = useMemo(
    () => filterByDateRange(sales, 'saleDateIso', rangePreset, customFrom, customTo),
    [sales, rangePreset, customFrom, customTo]
  );

  const byCampaign = useMemo(() => {
    const counts = new Map();
    for (const s of inRange) {
      counts.set(s.campaignId, { label: s.projectName || s.campaignId, value: (counts.get(s.campaignId)?.value || 0) + saleUnitCount(s) });
    }
    return [...counts.values()].sort((a, b) => b.value - a.value);
  }, [inRange]);

  const byAgent = useMemo(() => {
    const counts = new Map();
    for (const s of inRange) {
      counts.set(s.agentId, { label: s.agentName || s.agentId, value: (counts.get(s.agentId)?.value || 0) + saleUnitCount(s) });
    }
    return [...counts.values()].sort((a, b) => b.value - a.value);
  }, [inRange]);

  const totalSaleUnits = useMemo(() => sumSaleUnits(inRange), [inRange]);

  return (
    <div className="card performance-report">
      <div className="card-header">
        <span className="card-title flex-align"><BarChart2 size={16} className="text-cyan" /> Performance Report</span>
        <div className="filter-box">
          <CalendarRange size={14} className="text-muted" />
          <select className="form-select text-sm" aria-label="Performance report time range" value={rangePreset} onChange={(e) => setRangePreset(e.target.value)}>
            {DATE_RANGE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {rangePreset === 'Custom' && (
            <>
              <input type="date" className="form-input text-sm" aria-label="Performance report from date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-muted text-sm">to</span>
              <input type="date" className="form-input text-sm" aria-label="Performance report to date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <div className="performance-report-total">Total sales submitted: <span className="font-bold text-accent">{totalSaleUnits}</span></div>

      <div className="grid-2">
        <div className="performance-report-section">
          <div className="performance-report-section-title">By Campaign</div>
          <PieChart data={byCampaign} />
        </div>
        <div className="performance-report-section">
          <div className="performance-report-section-title">By Agent (Individual Performance)</div>
          <PieChart data={byAgent} />
        </div>
      </div>

      <style>{`
        .performance-report-total { font-size: 0.85rem; margin: 0.75rem 0; }
        .performance-report-section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-subtle); margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}
