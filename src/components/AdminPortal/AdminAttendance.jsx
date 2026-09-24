import React, { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { DATE_RANGE_PRESETS, filterByDateOnlyRange } from '../../utils/dateFilters';

const STATUS_OPTIONS = ['Present', 'Tardy', 'Late', 'Clocked Out'];

function statusBadgeClass(status) {
  if (status === 'Present') return 'badge-success';
  if (status === 'Tardy' || status === 'Late') return 'badge-warning';
  if (status === 'Clocked Out') return 'badge-neutral';
  return 'badge-error';
}

export default function AdminAttendance({ attendanceLogs, users, onUpdateAttendance }) {
  const [selectedAgentId, setSelectedAgentId] = useState('All');
  const [dateRangePreset, setDateRangePreset] = useState('All Time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const agents = users.filter(u => u.role === 'Agent');

  const byAgent = selectedAgentId === 'All'
    ? attendanceLogs
    : attendanceLogs.filter(a => a.agentId === selectedAgentId);
  const filteredLogs = filterByDateOnlyRange(byAgent, 'date', dateRangePreset, customFrom, customTo);

  return (
    <div className="admin-attendance-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Attendance & Shift Punch Records</h1>
          <p className="page-subtitle">Real-time attendance tracking for all sales agents, late arrivals and total hours worked.</p>
        </div>
      </div>

      <div className="card margin-bottom flex-between">
        <div className="filter-box">
          <label className="form-label" htmlFor="attendance-agent-filter">Filter by Agent:</label>
          <select id="attendance-agent-filter" className="form-select" value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
            <option value="All">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="filter-box">
          <CalendarRange size={16} className="text-muted" />
          <select className="form-select" value={dateRangePreset} onChange={(e) => setDateRangePreset(e.target.value)}>
            {DATE_RANGE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {dateRangePreset === 'Custom' && (
            <>
              <input type="date" className="form-input" aria-label="From date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-muted text-sm">to</span>
              <input type="date" className="form-input" aria-label="To date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Agent Name</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Total Hours</th>
              <th>Status</th>
              <th>Admin Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No attendance records match the current filters.</td></tr>
            ) : filteredLogs.map(log => (
              <tr key={log.id}>
                <td className="font-mono">{log.date}</td>
                <td className="font-bold">{log.agentName}</td>
                <td className="font-mono text-cyan">{log.clockIn}</td>
                <td className="font-mono text-muted">{log.clockOut}</td>
                <td>{log.totalHours}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(log.status)}`}>
                    {log.status}
                  </span>
                  {log.tardy && log.status !== 'Tardy' && log.status !== 'Late' && (
                    <span className="badge badge-warning" style={{ marginLeft: '0.35rem' }} title="Clocked in after 8:15 PM PKT">Tardy</span>
                  )}
                </td>
                <td>
                  <select
                    className="form-select"
                    value={log.status}
                    onChange={(e) => onUpdateAttendance(log.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
