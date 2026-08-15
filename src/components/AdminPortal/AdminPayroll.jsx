import React, { useState } from 'react';
import { DollarSign, Printer, Clock, ShieldCheck, Eye, X } from 'lucide-react';
import { formatPKR } from '../../utils/currency';

export default function AdminPayroll({ payroll, onTogglePaymentStatus }) {
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const totalPayrollPaidPkr = payroll.reduce((sum, p) => sum + (p.status === 'Paid' ? (p.netSalaryPkr || p.netSalary || 0) : 0), 0);
  const totalPayrollPendingPkr = payroll.reduce((sum, p) => sum + (p.status === 'Pending' ? (p.netSalaryPkr || p.netSalary || 0) : 0), 0);

  return (
    <div className="admin-payroll-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary & Payroll Management (Admin Restricted)</h1>
          <p className="page-subtitle">Calculate base salary in PKR, sales commissions, attendance bonuses, deductions and generate payslips.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid margin-bottom">
        <div className="kpi-card">
          <div className="kpi-head"><span>Total Disbursed Payroll</span><div className="kpi-icon"><DollarSign size={18} /></div></div>
          <div className="kpi-value">{formatPKR(totalPayrollPaidPkr)}</div>
          <div className="kpi-sub"><span>August 2026 Pay Cycle</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Pending Payroll Approval</span><div className="kpi-icon"><Clock size={18} /></div></div>
          <div className="kpi-value">{formatPKR(totalPayrollPendingPkr)}</div>
          <div className="kpi-sub"><span>Awaiting Admin Sign-off</span></div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Pay Month</th>
              <th>Base Salary</th>
              <th>Commission</th>
              <th>Bonus</th>
              <th>Deductions</th>
              <th>Net Payout (PKR)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map(p => {
              const net = p.netSalaryPkr || p.netSalary || 0;
              const base = p.baseSalaryPkr || p.baseSalary || 0;
              const comm = p.commissionPkr || p.commission || 0;
              const bonus = p.bonusPkr || p.bonus || 0;
              const ded = p.deductionsPkr || p.deductions || 0;

              return (
                <tr key={p.id}>
                  <td className="font-bold">{p.agentName}</td>
                  <td>{p.month}</td>
                  <td className="font-mono">{formatPKR(base)}</td>
                  <td className="font-mono text-blue">{formatPKR(comm)}</td>
                  <td className="font-mono text-success">+{formatPKR(bonus)}</td>
                  <td className="font-mono text-danger">-{formatPKR(ded)}</td>
                  <td className="font-mono font-bold text-main">{formatPKR(net)}</td>
                  <td>
                    <span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group-sm">
                      <button 
                        className={`btn btn-sm ${p.status === 'Paid' ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => onTogglePaymentStatus(p.id)}
                      >
                        {p.status === 'Paid' ? 'Pending' : 'Approve & Pay'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(p)}>
                        <Eye size={13} /> Payslip
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payslip Modal */}
      {selectedPayslip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <span className="modal-title">Employee Official Payslip — Blylinks PKR</span>
              <button className="icon-btn" onClick={() => setSelectedPayslip(null)}><X size={18} /></button>
            </div>
            <div className="modal-body payslip-printable">
              <div className="payslip-header-brand">
                <div>
                  <h2 className="brand-font font-bold text-blue" style={{ fontSize: '1.3rem' }}>BLYLINKS OPERATIONS</h2>
                  <p className="text-xs text-muted">BPO Sales & Employee Compensation Statement (PKR)</p>
                </div>
                <div className="text-right">
                  <div className="font-bold">{selectedPayslip.month}</div>
                  <div className="text-xs text-subtle">ID: {selectedPayslip.id}</div>
                </div>
              </div>

              <div className="payslip-agent-info grid-2 margin-top margin-bottom">
                <div>
                  <div className="text-xs text-muted">EMPLOYEE NAME</div>
                  <div className="font-bold text-main">{selectedPayslip.agentName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">PAYMENT STATUS</div>
                  <span className={`badge ${selectedPayslip.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedPayslip.status} ({selectedPayslip.paymentDate})
                  </span>
                </div>
              </div>

              <div className="table-container margin-bottom">
                <table className="data-table">
                  <thead>
                    <tr><th>Item Description</th><th style={{ textAlign: 'right' }}>Amount (PKR)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Base Monthly Salary</td><td style={{ textAlign: 'right' }} className="font-mono">{formatPKR(selectedPayslip.baseSalaryPkr || selectedPayslip.baseSalary)}</td></tr>
                    <tr><td>Sales Incentives & Commission</td><td style={{ textAlign: 'right' }} className="font-mono text-blue">{formatPKR(selectedPayslip.commissionPkr || selectedPayslip.commission)}</td></tr>
                    <tr><td>Performance & Attendance Bonus</td><td style={{ textAlign: 'right' }} className="font-mono text-success">+{formatPKR(selectedPayslip.bonusPkr || selectedPayslip.bonus)}</td></tr>
                    <tr><td>Shift Deductions</td><td style={{ textAlign: 'right' }} className="font-mono text-danger">-{formatPKR(selectedPayslip.deductionsPkr || selectedPayslip.deductions)}</td></tr>
                    <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                      <td>NET PAYOUT AMOUNT</td>
                      <td style={{ textAlign: 'right' }} className="font-mono font-bold text-blue">{formatPKR(selectedPayslip.netSalaryPkr || selectedPayslip.netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="payslip-footer-note">
                <ShieldCheck size={15} className="text-blue" />
                <span>Verified by Blylinks PKR Operations. Confidential employee statement.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print / Save PDF
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedPayslip(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .payslip-header-brand { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
        .text-right { text-align: right; }
        .payslip-agent-info { background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
        .payslip-footer-note { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-subtle); border-top: 1px dashed var(--border-color); padding-top: 0.65rem; }
      `}</style>
    </div>
  );
}
