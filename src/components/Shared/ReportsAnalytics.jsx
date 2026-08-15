import React from 'react';
import { FileSpreadsheet, Download, TrendingUp, DollarSign, Users, CheckCircle, BarChart2 } from 'lucide-react';

export default function ReportsAnalytics({ sales, attendanceLogs, leads, payroll }) {
  const exportReportCSV = (reportType) => {
    let headers = [];
    let rows = [];

    if (reportType === 'sales') {
      headers = ['Sale ID', 'Customer Name', 'Agent Name', 'Campaign', 'Amount ($)', 'Status', 'Date'];
      rows = sales.map(s => [s.id, s.customerName, s.agentName, s.projectName, s.amount, s.status, s.date]);
    } else if (reportType === 'attendance') {
      headers = ['Log ID', 'Agent Name', 'Date', 'Clock In', 'Clock Out', 'Hours Worked', 'Status'];
      rows = attendanceLogs.map(a => [a.id, a.agentName, a.date, a.clockIn, a.clockOut, a.totalHours, a.status]);
    } else if (reportType === 'payroll') {
      headers = ['Payroll ID', 'Agent Name', 'Month', 'Base Salary', 'Commission', 'Bonus', 'Deductions', 'Net Payout', 'Status'];
      rows = payroll.map(p => [p.id, p.agentName, p.month, p.baseSalary, p.commission, p.bonus, p.deductions, p.netSalary, p.status]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Blylinks_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="reports-analytics-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Reporting & CSV Export Center</h1>
          <p className="page-subtitle">One-click data export for sales performance, attendance audit sheets, payroll statements and leads.</p>
        </div>
      </div>

      <div className="grid-2 margin-bottom">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><DollarSign size={18} className="text-cyan" /> Comprehensive Sales Report</span>
            <button className="btn btn-primary btn-sm" onClick={() => exportReportCSV('sales')}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <p className="text-muted text-sm margin-bottom">Includes deal IDs, verified customer names, agent submissions, sale amounts and QA approval notes.</p>
          <div className="kpi-sub font-mono">Total Tracked Submissions: {sales.length} Sales Records</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Users size={18} className="text-cyan" /> Attendance & Shift Punch Log</span>
            <button className="btn btn-primary btn-sm" onClick={() => exportReportCSV('attendance')}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <p className="text-muted text-sm margin-bottom">Complete breakdown of agent clock-in times, clock-out timestamps, late penalties and total shift hours.</p>
          <div className="kpi-sub font-mono">Total Recorded Shifts: {attendanceLogs.length} Entries</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FileSpreadsheet size={18} className="text-cyan" /> Monthly Payroll & Salary Export</span>
            <button className="btn btn-primary btn-sm" onClick={() => exportReportCSV('payroll')}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <p className="text-muted text-sm margin-bottom">Admin-level breakdown of base salaries, sales incentive commissions, attendance bonuses and net payouts.</p>
          <div className="kpi-sub font-mono">Pay Periods Logged: {payroll.length} Employee Statements</div>
        </div>
      </div>
    </div>
  );
}
