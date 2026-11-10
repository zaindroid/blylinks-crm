import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthKey(year, month) {
  return `${year}-${pad2(month + 1)}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function statusBadgeClass(status) {
  if (status === 'Present') return 'badge-success';
  if (status === 'Tardy' || status === 'Late') return 'badge-warning';
  if (status === 'Clocked Out') return 'badge-neutral';
  return 'badge-error';
}

// Builds the calendar grid for a given year/month: an array of weeks, each a 7-length array of
// { dateStr, inMonth } cells (Sun-Sat), padded with the trailing/leading days of neighboring
// months so every week row is a complete 7-day strip.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells = [];
  // 6 weeks x 7 days always covers any month's layout.
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    cells.push({ dateStr, inMonth: d.getMonth() === month, dayNum: d.getDate() });
  }
  // Trim trailing weeks that are entirely outside the month.
  while (cells.length > 7 && cells.slice(-7).every(c => !c.inMonth)) {
    cells.splice(-7, 7);
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, daysInMonth };
}

export default function AttendanceCalendar({ logs, agents, selectedAgentId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const goPrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); }
  };

  const { weeks, daysInMonth } = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const thisMonthKey = monthKey(year, month);

  // Logs for the displayed month only, grouped by date -> (single agent) one log, or (combined) a list.
  const logsByDate = useMemo(() => {
    const map = {};
    for (const log of logs) {
      if (!log.date || !log.date.startsWith(thisMonthKey)) continue;
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [logs, thisMonthKey]);

  // Stats only make sense pinned to one person -- "22 working days" is meaningless averaged
  // across a whole team, so they're hidden entirely for the combined/"All Agents" view.
  const stats = useMemo(() => {
    if (selectedAgentId === 'All') return null;
    const monthLogs = logs.filter(l => l.date && l.date.startsWith(thisMonthKey));
    const workingDays = new Set(monthLogs.map(l => l.date)).size;
    const tardyDays = new Set(monthLogs.filter(l => l.tardy).map(l => l.date)).size;
    // Can't be absent on a day that hasn't happened yet: cap the "expected" days at today for
    // the current month, and use the full month for any month already in the past.
    const isCurrentMonth = thisMonthKey === monthKey(now.getFullYear(), now.getMonth());
    const expectedDays = isCurrentMonth ? now.getDate() : daysInMonth;
    const absentDays = Math.max(0, expectedDays - workingDays);
    return { workingDays, tardyDays, absentDays };
  }, [logs, thisMonthKey, selectedAgentId, daysInMonth, now]);

  const agentName = (id) => agents.find(a => a.id === id)?.name || id;

  return (
    <div className="attendance-calendar">
      {stats && (
        <div className="kpi-grid margin-bottom">
          <div className="kpi-card">
            <div className="kpi-head"><span>Working Days</span></div>
            <div className="kpi-value">{stats.workingDays}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-head"><span>Tardies</span></div>
            <div className="kpi-value">{stats.tardyDays}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-head"><span>Absents</span></div>
            <div className="kpi-value">{stats.absentDays}</div>
          </div>
        </div>
      )}

      <div className="calendar-nav-row">
        <button type="button" className="icon-btn" onClick={goPrevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <span className="calendar-month-label">{new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="icon-btn" onClick={goNextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
        {weeks.flat().map(cell => {
          const dayLogs = logsByDate[cell.dateStr] || [];
          const isToday = cell.dateStr === todayStr();
          return (
            <div key={cell.dateStr} className={`calendar-cell ${cell.inMonth ? '' : 'calendar-cell-outside'} ${isToday ? 'calendar-cell-today' : ''}`}>
              <div className="calendar-cell-daynum">{cell.dayNum}</div>
              {selectedAgentId === 'All' ? (
                <div className="calendar-cell-summary">
                  {dayLogs.length > 0 && (
                    <>
                      <span className="badge badge-success calendar-cell-badge">{dayLogs.filter(l => l.status === 'Present').length}P</span>
                      {dayLogs.some(l => l.tardy) && (
                        <span className="badge badge-warning calendar-cell-badge">{dayLogs.filter(l => l.tardy).length}T</span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                dayLogs[0] && (
                  <div className="calendar-cell-summary">
                    <span className={`badge ${statusBadgeClass(dayLogs[0].status)} calendar-cell-badge`}>{dayLogs[0].status}</span>
                    <div className="calendar-cell-time">{dayLogs[0].clockIn}</div>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {selectedAgentId === 'All' && (
        <p className="text-xs text-subtle margin-top">Showing every agent. Pick one from "Filter by Agent" above to see their day-by-day status and time.</p>
      )}

      <style>{`
        .calendar-nav-row { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.75rem; }
        .calendar-month-label { font-weight: 700; font-size: 0.95rem; min-width: 160px; text-align: center; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .calendar-weekday { text-align: center; font-size: 0.7rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase; padding: 0.25rem 0; }
        .calendar-cell { min-height: 72px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.35rem; background: var(--bg-primary); display: flex; flex-direction: column; gap: 0.25rem; }
        .calendar-cell-outside { opacity: 0.35; }
        .calendar-cell-today { border-color: var(--text-blue, #2563eb); border-width: 2px; }
        .calendar-cell-daynum { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); }
        .calendar-cell-summary { display: flex; flex-wrap: wrap; gap: 0.2rem; align-items: center; }
        .calendar-cell-badge { font-size: 0.6rem; padding: 0.1rem 0.35rem; }
        .calendar-cell-time { font-size: 0.65rem; color: var(--text-muted); font-family: monospace; }
      `}</style>
    </div>
  );
}
