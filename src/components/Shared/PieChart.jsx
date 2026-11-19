import React from 'react';

// A small set of distinct, readable slice colors, cycled if there are more slices than colors.
const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

// `data` is [{ label, value }], already non-negative. No charting library dependency -- just plain
// SVG arcs, kept deliberately simple since this never needs animation, tooltips or zooming.
export default function PieChart({ data, size = 150 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const nonZero = data.filter(d => d.value > 0);
  const r = size / 2;

  let cursor = 0;
  const slices = nonZero.map((d, i) => {
    const fraction = total > 0 ? d.value / total : 0;
    const startAngle = cursor * 360;
    cursor += fraction;
    const endAngle = cursor * 360;
    return { ...d, color: PALETTE[i % PALETTE.length], startAngle, endAngle, pct: Math.round(fraction * 100) };
  });

  return (
    <div className="pie-chart-widget">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
        {total === 0 ? (
          <circle cx={r} cy={r} r={r - 1} fill="var(--bg-tertiary)" />
        ) : slices.length === 1 ? (
          // A single 100% slice degenerates the arc path (start === end angle), so draw a plain circle.
          <circle cx={r} cy={r} r={r - 1} fill={slices[0].color} />
        ) : (
          slices.map(s => <path key={s.label} d={arcPath(r, r, r - 1, s.startAngle, s.endAngle)} fill={s.color} />)
        )}
      </svg>
      <div className="pie-chart-legend">
        {slices.length === 0 ? (
          <div className="text-xs text-subtle">No data for this period.</div>
        ) : (
          slices.map(s => (
            <div key={s.label} className="pie-chart-legend-row">
              <span className="pie-chart-legend-swatch" style={{ background: s.color }} />
              <span className="pie-chart-legend-label">{s.label}</span>
              <span className="pie-chart-legend-value">{s.value} ({s.pct}%)</span>
            </div>
          ))
        )}
      </div>

      <style>{`
        .pie-chart-widget { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .pie-chart-legend { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 140px; }
        .pie-chart-legend-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; }
        .pie-chart-legend-swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
        .pie-chart-legend-label { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pie-chart-legend-value { color: var(--text-subtle); white-space: nowrap; }
      `}</style>
    </div>
  );
}
