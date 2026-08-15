import React, { useState } from 'react';
import { Clock, ShieldCheck, Edit3, CheckCircle, AlertTriangle } from 'lucide-react';

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
                  <span className={`badge ${log.status === 'Present' ? 'badge-success' : log.status === 'Late' ? 'badge-warning' : 'badge-error'}`}>
                    {log.status}
                  </span>
                </td>
                <td>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const newStatus = log.status === 'Present' ? 'Late' : 'Present';
                      onUpdateAttendance(log.id, newStatus);
                    }}
                  >
                    <Edit3 size={14} /> Set {log.status === 'Present' ? 'Late' : 'Present'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
