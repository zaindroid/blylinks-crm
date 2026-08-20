import React, { useState } from 'react';

const STATUS_OPTIONS = ['Present', 'Tardy', 'Late', 'Clocked Out'];

function statusBadgeClass(status) {
  if (status === 'Present') return 'badge-success';
  if (status === 'Tardy' || status === 'Late') return 'badge-warning';
  if (status === 'Clocked Out') return 'badge-neutral';
  return 'badge-error';
}

export default function AdminAttendance({ attendanceLogs, users, onUpdateAttendance }) {
  const [selectedAgentId, setSelectedAgentId] = useState('All');
  const agents = users.filter(u => u.role === 'Agent');

  const filteredLogs = selectedAgentId === 'All' 
    ? attendanceLogs 
    : attendanceLogs.filter(a => a.agentId === selectedAgentId);

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
          <label className="form-label">Filter by Agent:</label>
          <select className="form-select" value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
            <option value="All">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
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
            {filteredLogs.map(log => (
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
