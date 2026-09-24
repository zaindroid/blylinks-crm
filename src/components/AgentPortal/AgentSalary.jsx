import React, { useMemo, useState } from 'react';
import { Wallet, Printer, ShieldCheck, X } from 'lucide-react';
import { formatPKR } from '../../utils/currency';

// An agent's own read-only earnings: the same base/24 x days + commission + bonus - deductions
// breakdown Admin sees on the Payroll screen, but scoped to just this agent's own records (the
// server already only ever returns an Agent's own payroll rows; this filter is belt-and-braces).
export default function AgentSalary({ currentUser, payroll = [] }) {
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const myPayroll = useMemo(
    () => payroll.filter(p => p.agentId === currentUser.id).sort((a, b) => b.month.localeCompare(a.month)),
    [payroll, currentUser.id]
  );
  const latest = myPayroll[0];

  return (
    <div className="agent-salary-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Salary</h1>
          <p className="page-subtitle">Your earnings, month by month: base salary for days worked, commission, bonus and any deductions.</p>
        </div>
      </div>

      {!latest ? (
        <div className="card">
          <div className="text-muted">Your salary will appear here once payroll has been calculated for a month you&apos;ve worked.</div>
        </div>
      ) : (
        <div className="kpi-grid margin-bottom">
          <div className="kpi-card">
            <div className="kpi-head"><span>Latest Payout ({latest.month})</span><div className="kpi-icon"><Wallet size={18} /></div></div>
            <div className="kpi-value">{formatPKR(latest.netSalaryPkr)}</div>
            <div className="kpi-sub"><span className={latest.status === 'Paid' ? 'text-success' : 'text-warning'}>{latest.status}</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-head"><span>Days Worked</span></div>
            <div className="kpi-value">{latest.workingDays}</div>
            <div className="kpi-sub"><span>{formatPKR(latest.perDayPkr)} / day</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-head"><span>Commission + Bonus</span></div>
            <div className="kpi-value">{formatPKR(latest.commissionPkr + latest.bonusPkr)}</div>
            <div className="kpi-sub"><span>This pay period</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-head"><span>Deductions</span></div>
            <div className="kpi-value">{formatPKR(latest.tardyDeductionPkr + latest.advanceDeductionPkr + latest.deductionsPkr)}</div>
            <div className="kpi-sub"><span>Tardy, advance &amp; other</span></div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Base Salary</th>
              <th>Days Worked</th>
              <th>Earned</th>
              <th>Commission</th>
              <th>Bonus</th>
              <th>Deductions</th>
              <th>Net Payout</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {myPayroll.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '1.5rem' }}>No payroll history yet.</td></tr>
            ) : myPayroll.map(p => {
              const earned = Math.round(p.perDayPkr * p.workingDays * 100) / 100;
              const deductions = p.tardyDeductionPkr + p.advanceDeductionPkr + p.deductionsPkr;
              return (
                <tr key={p.id}>
                  <td className="font-bold">{p.month}</td>
                  <td className="font-mono">{formatPKR(p.baseSalaryPkr)}</td>
                  <td className="font-mono">{p.workingDays}</td>
                  <td className="font-mono">{formatPKR(earned)}</td>
                  <td className="font-mono text-blue">+{formatPKR(p.commissionPkr)}</td>
                  <td className="font-mono text-success">+{formatPKR(p.bonusPkr)}</td>
                  <td className="font-mono text-danger">-{formatPKR(deductions)}</td>
                  <td className="font-mono font-bold text-main">{formatPKR(p.netSalaryPkr)}</td>
                  <td><span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(p)}>View Payslip</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPayslip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <span className="modal-title">Employee Official Payslip — Blylinks PKR</span>
              <button className="icon-btn" onClick={() => setSelectedPayslip(null)} aria-label="Close payslip"><X size={18} /></button>
            </div>
            <div className="modal-body payslip-printable">
              <div className="payslip-header-brand">
                <div>
                  <h2 className="brand-font font-bold text-blue" style={{ fontSize: '1.3rem' }}>BLYLINKS OPERATIONS</h2>
                  <p className="text-xs text-muted">BPO Sales &amp; Employee Compensation Statement (PKR)</p>
                </div>
                <div className="text-right">
                  <div className="font-bold">{selectedPayslip.month}</div>
                  <div className="text-xs text-subtle">ID: {selectedPayslip.id}</div>
                </div>
              </div>

              <div className="payslip-agent-info grid-2 margin-top margin-bottom">
                <div>
                  <div className="text-xs text-muted">EMPLOYEE NAME</div>
                  <div className="font-bold text-main">{currentUser.name}</div>
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
                    <tr><td>Monthly Base Salary</td><td style={{ textAlign: 'right' }} className="font-mono">{formatPKR(selectedPayslip.baseSalaryPkr)}</td></tr>
                    <tr><td>Per-Day Rate (Base ÷ 24)</td><td style={{ textAlign: 'right' }} className="font-mono">{formatPKR(selectedPayslip.perDayPkr)}</td></tr>
                    <tr><td>Days Worked</td><td style={{ textAlign: 'right' }} className="font-mono">{selectedPayslip.workingDays}</td></tr>
                    <tr><td>Earned Salary ({selectedPayslip.workingDays} days)</td><td style={{ textAlign: 'right' }} className="font-mono">{formatPKR(Math.round(selectedPayslip.perDayPkr * selectedPayslip.workingDays * 100) / 100)}</td></tr>
                    <tr><td>Commission</td><td style={{ textAlign: 'right' }} className="font-mono text-blue">+{formatPKR(selectedPayslip.commissionPkr)}</td></tr>
                    <tr><td>Bonus</td><td style={{ textAlign: 'right' }} className="font-mono text-success">+{formatPKR(selectedPayslip.bonusPkr)}</td></tr>
                    <tr><td>Tardy Deduction ({selectedPayslip.tardyWeeks} {selectedPayslip.tardyWeeks === 1 ? 'week' : 'weeks'} with 3+ tardies, half day each)</td><td style={{ textAlign: 'right' }} className="font-mono text-danger">-{formatPKR(selectedPayslip.tardyDeductionPkr)}</td></tr>
                    <tr><td>Advance Recovered</td><td style={{ textAlign: 'right' }} className="font-mono text-danger">-{formatPKR(selectedPayslip.advanceDeductionPkr)}</td></tr>
                    <tr><td>Other Deductions</td><td style={{ textAlign: 'right' }} className="font-mono text-danger">-{formatPKR(selectedPayslip.deductionsPkr)}</td></tr>
                    <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                      <td>NET PAYOUT AMOUNT</td>
                      <td style={{ textAlign: 'right' }} className="font-mono font-bold text-blue">{formatPKR(selectedPayslip.netSalaryPkr)}</td>
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
