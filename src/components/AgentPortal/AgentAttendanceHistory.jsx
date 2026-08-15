import React from 'react';
import { Clock, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AgentAttendanceHistory({ currentUser, attendanceLogs, attendanceStatus, onClockAction }) {
  const myLogs = attendanceLogs.filter(a => a.agentId === currentUser.id);

  return (
    <div className="attendance-history-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Personal Attendance & Shift Log</h1>
          <p className="page-subtitle">Track your clock-in, clock-out timestamps, daily hours worked and attendance status.</p>
        </div>
        <div className="header-actions">
          {attendanceStatus === 'Clocked Out' ? (
            <button className="btn btn-success" onClick={() => onClockAction('Clock In')}>
              <Clock size={16} /> Clock In Now
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => onClockAction('Clock Out')}>
              Clock Out
            </button>
          )}
        </div>
      </div>

      <div className="card margin-bottom flex-between">
        <div>
          <div className="text-muted text-sm">Assigned Shift Schedule:</div>
          <div className="font-bold text-main">{currentUser.shift || '08:00 AM - 04:00 PM EST'}</div>
        </div>
        <div>
          <div className="text-muted text-sm">Today Status:</div>
          <span className={`badge ${attendanceStatus === 'Present' ? 'badge-success' : 'badge-warning'}`}>
            {attendanceStatus}
          </span>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In Time</th>
              <th>Clock Out Time</th>
              <th>Total Hours Worked</th>
              <th>Attendance Status</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {myLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No attendance history recorded yet.</td>
              </tr>
            ) : (
              myLogs.map(log => (
                <tr key={log.id}>
                  <td className="font-bold">{log.date}</td>
                  <td className="font-mono text-cyan">{log.clockIn}</td>
                  <td className="font-mono text-muted">{log.clockOut}</td>
                  <td>{log.totalHours}</td>
                  <td>
                    <span className={`badge ${log.status === 'Present' ? 'badge-success' : log.status === 'Late' ? 'badge-warning' : 'badge-error'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="text-subtle text-sm flex-align">
                    <ShieldCheck size={14} className="text-cyan" /> Verified Log
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
