import React, { useState } from 'react';
import { FileSpreadsheet, Download, TrendingUp, DollarSign, Users, CheckCircle, BarChart2 } from 'lucide-react';
import { DATE_RANGE_PRESETS, filterByDateRange } from '../../utils/dateFilters';

export default function ReportsAnalytics({ sales, attendanceLogs, leads, payroll }) {
  const [salesRangePreset, setSalesRangePreset] = useState('All Time');
  const [salesFrom, setSalesFrom] = useState('');
  const [salesTo, setSalesTo] = useState('');
  const salesInRange = filterByDateRange(sales, 'saleDateIso', salesRangePreset, salesFrom, salesTo);

  // A bare `.join(',')` breaks the moment any free-text field (a customer name, an agent note)
  // happens to contain a comma, quote or newline -- which the comprehensive sales report is full
  // of (addresses, notes). Quote every field and escape embedded quotes, the standard CSV rule.
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const exportReportCSV = (reportType) => {
    let headers = [];
    let rows = [];

    if (reportType === 'sales') {
      headers = [
        'Sale ID', 'Customer Name', 'Phone', 'Phone 2', 'Email',
        'Address', 'Apt/Unit', 'City', 'State', 'Zip Code',
        'Campaign', 'Agent Name', 'Closer Name', 'Amount ($)', 'Status', 'Sale Date',
        'Supplier Name', 'Electric Utility', 'Electric Account Type', 'Electric Account Number', 'Electric Rate',
        'Gas Utility', 'Gas Account Type', 'Gas Account Number', 'Confirmation Number',
        'Agent Notes', 'QA Notes', 'Verified By'
      ];
      rows = salesInRange.map(s => [
        s.id, s.customerName, s.phone, s.phone2, s.email,
        s.address, s.apt, s.city, s.state, s.zipCode,
        s.projectName, s.agentName, s.closerName, s.amount, s.status, s.date,
        s.supplierName, s.electricUtility, s.electricAccountType, s.electricAccountNumber, s.electricRate,
        s.gasUtility, s.gasAccountType, s.gasAccountNumber, s.confirmationNumber,
        s.agentNotes, s.qaNotes, s.verifiedBy
      ]);
    } else if (reportType === 'attendance') {
      headers = ['Log ID', 'Agent Name', 'Date', 'Clock In', 'Clock Out', 'Hours Worked', 'Status'];
      rows = attendanceLogs.map(a => [a.id, a.agentName, a.date, a.clockIn, a.clockOut, a.totalHours, a.status]);
    } else if (reportType === 'payroll') {
      headers = ['Payroll ID', 'Agent Name', 'Month', 'Base Salary', 'Commission', 'Bonus', 'Deductions', 'Net Payout', 'Status'];
      rows = payroll.map(p => [p.id, p.agentName, p.month, p.baseSalary, p.commission, p.bonus, p.deductions, p.netSalary, p.status]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.map(csvCell).join(','), ...rows.map(e => e.map(csvCell).join(','))].join('\n');
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
          <p className="text-muted text-sm margin-bottom">Full order detail per sale: contact info, address, campaign/agent, utility & account numbers, amount, status and all notes.</p>
          <div className="sales-report-range-row margin-bottom">
            <select className="form-select text-sm" aria-label="Sales report date range" value={salesRangePreset} onChange={(e) => setSalesRangePreset(e.target.value)}>
              {DATE_RANGE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {salesRangePreset === 'Custom' && (
              <>
                <input type="date" className="form-input text-sm" aria-label="Sales report from date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} />
                <span className="text-muted text-sm">to</span>
                <input type="date" className="form-input text-sm" aria-label="Sales report to date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} />
              </>
            )}
          </div>
          <div className="kpi-sub font-mono">Total Tracked Submissions: {salesInRange.length} Sales Records</div>
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

      <style>{`
        .sales-report-range-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
      `}</style>
    </div>
  );
}
