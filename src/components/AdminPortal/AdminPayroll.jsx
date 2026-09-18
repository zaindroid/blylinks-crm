import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, Printer, Clock, ShieldCheck, Eye, X, RefreshCw, Edit3, Wallet, Trash2 } from 'lucide-react';
import { formatPKR } from '../../utils/currency';
import { fetchAdvances, addAdvance, deleteAdvance } from '../../api/payroll';

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_ADVANCE = { agentId: '', amountPkr: '', givenOn: '', note: '' };

export default function AdminPayroll({ payroll, users = [], onTogglePaymentStatus, onGeneratePayroll, onUpdatePayrollAdjustments }) {
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [generateMonth, setGenerateMonth] = useState(currentMonthValue());
  const [generating, setGenerating] = useState(false);
  const [adjustingFor, setAdjustingFor] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ commissionPkr: '', bonusPkr: '', deductionsPkr: '', workingDays: '' });
  const [error, setError] = useState('');

  const [advances, setAdvances] = useState([]);
  const [advanceForm, setAdvanceForm] = useState(EMPTY_ADVANCE);
  const [advanceError, setAdvanceError] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);

  const agents = users.filter(u => u.role === 'Agent' && u.status === 'Active');

  const loadAdvances = useCallback(async () => {
    try {
      setAdvances(await fetchAdvances());
    } catch (err) {
      console.error('Failed to load advances', err);
    }
  }, []);

  useEffect(() => { loadAdvances(); }, [loadAdvances]);

  const totalPayrollPaidPkr = payroll.reduce((sum, p) => sum + (p.status === 'Paid' ? (p.netSalaryPkr || 0) : 0), 0);
  const totalPayrollPendingPkr = payroll.reduce((sum, p) => sum + (p.status === 'Pending' ? (p.netSalaryPkr || 0) : 0), 0);
  const totalOutstandingAdvances = advances.reduce((sum, a) => sum + a.outstandingPkr, 0);

  // Advance balances change whenever a payroll is generated, paid or reverted, so refresh them afterwards.
  const runPayrollAction = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'That payroll action failed.');
    }
    await loadAdvances();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await runPayrollAction(() => onGeneratePayroll(generateMonth));
    } finally {
      setGenerating(false);
    }
  };

  const openAdjust = (p) => {
    setAdjustForm({
      commissionPkr: String(p.commissionPkr || 0),
      bonusPkr: String(p.bonusPkr || 0),
      deductionsPkr: String(p.deductionsPkr || 0),
      workingDays: String(p.workingDays || 0)
    });
    setError('');
    setAdjustingFor(p);
  };

  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    try {
      await onUpdatePayrollAdjustments(adjustingFor.id, {
        commissionPkr: Number(adjustForm.commissionPkr) || 0,
        bonusPkr: Number(adjustForm.bonusPkr) || 0,
        deductionsPkr: Number(adjustForm.deductionsPkr) || 0,
        workingDays: Number(adjustForm.workingDays) || 0
      });
      setAdjustingFor(null);
      await loadAdvances();
    } catch (err) {
      setError(err.message || 'Could not save the adjustments.');
    }
  };

  const handleAddAdvance = async (e) => {
    e.preventDefault();
    setAdvanceError('');
    const amount = Number(advanceForm.amountPkr);
    if (!advanceForm.agentId) return setAdvanceError('Choose the agent who received the advance.');
    if (!Number.isFinite(amount) || amount <= 0) return setAdvanceError('Enter an advance amount greater than zero.');
    setSavingAdvance(true);
    try {
      await addAdvance({
        agentId: advanceForm.agentId,
        amountPkr: amount,
        givenOn: advanceForm.givenOn || today(),
        note: advanceForm.note
      });
      setAdvanceForm(EMPTY_ADVANCE);
      await loadAdvances();
    } catch (err) {
      setAdvanceError(err.message || 'Could not record the advance.');
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDeleteAdvance = async (advance) => {
    setAdvanceError('');
    try {
      await deleteAdvance(advance.id);
      await loadAdvances();
    } catch (err) {
      setAdvanceError(err.message || 'Could not delete the advance.');
    }
  };

  return (
    <div className="admin-payroll-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary & Payroll Management (Admin Restricted)</h1>
          <p className="page-subtitle">
            Pay = (base salary ÷ 24) × days worked. Half a day is deducted for each week with 3 or more tardies, and any advance is
            deducted automatically. Add commission, bonus or other deductions with Adjust before paying.
          </p>
        </div>
        <div className="page-header-actions">
          <input
            type="month"
            className="form-input"
            style={{ width: '160px' }}
            value={generateMonth}
            onChange={(e) => setGenerateMonth(e.target.value)}
            aria-label="Pay month"
          />
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            <RefreshCw size={15} /> {generating ? 'Calculating…' : 'Calculate Payroll'}
          </button>
        </div>
      </div>

      {error && <div className="error-alert margin-bottom" role="alert">{error}</div>}

      {/* KPI Cards */}
      <div className="kpi-grid margin-bottom">
        <div className="kpi-card">
          <div className="kpi-head"><span>Total Disbursed Payroll</span><div className="kpi-icon"><DollarSign size={18} /></div></div>
          <div className="kpi-value">{formatPKR(totalPayrollPaidPkr)}</div>
          <div className="kpi-sub"><span>Across All Pay Cycles</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Pending Payroll Approval</span><div className="kpi-icon"><Clock size={18} /></div></div>
          <div className="kpi-value">{formatPKR(totalPayrollPendingPkr)}</div>
          <div className="kpi-sub"><span>Awaiting Admin Sign-off</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head"><span>Advances Outstanding</span><div className="kpi-icon"><Wallet size={18} /></div></div>
          <div className="kpi-value">{formatPKR(totalOutstandingAdvances)}</div>
          <div className="kpi-sub"><span>To be recovered from upcoming pay</span></div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container margin-bottom">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Pay Month</th>
              <th>Base Salary</th>
              <th>Days Worked</th>
              <th>Earned (Base ÷ 24 × Days)</th>
              <th>Commission</th>
              <th>Bonus</th>
              <th>Tardy Deduction</th>
              <th>Advance Deduction</th>
              <th>Other Deductions</th>
              <th>Net Payout (PKR)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payroll.length === 0 ? (
              <tr><td colSpan="13" style={{ textAlign: 'center', padding: '1.5rem' }}>No payroll calculated yet. Pick a month and press Calculate Payroll.</td></tr>
            ) : payroll.map(p => {
              const earned = Math.round((p.perDayPkr * p.workingDays) * 100) / 100;
              const isPaid = p.status === 'Paid';
              return (
                <tr key={p.id}>
                  <td className="font-bold">{p.agentName}</td>
                  <td>{p.month}</td>
                  <td className="font-mono">{formatPKR(p.baseSalaryPkr)}</td>
                  <td className="font-mono">{p.workingDays}</td>
                  <td className="font-mono">{formatPKR(earned)}</td>
                  <td className="font-mono text-blue">+{formatPKR(p.commissionPkr)}</td>
                  <td className="font-mono text-success">+{formatPKR(p.bonusPkr)}</td>
                  <td className="font-mono text-danger">
                    -{formatPKR(p.tardyDeductionPkr)}
                    {p.tardyWeeks > 0 && <div className="text-xs text-subtle">{p.tardyWeeks} tardy {p.tardyWeeks === 1 ? 'week' : 'weeks'}</div>}
                  </td>
                  <td className="font-mono text-danger">-{formatPKR(p.advanceDeductionPkr)}</td>
                  <td className="font-mono text-danger">-{formatPKR(p.deductionsPkr)}</td>
                  <td className="font-mono font-bold text-main">{formatPKR(p.netSalaryPkr)}</td>
                  <td>
                    <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="btn-group-sm">
                      <button
                        className={`btn btn-sm ${isPaid ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => runPayrollAction(() => onTogglePaymentStatus(p.id))}
                      >
                        {isPaid ? 'Revert to Pending' : 'Approve & Pay'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openAdjust(p)}
                        disabled={isPaid}
                        title={isPaid ? 'Revert to Pending to change a paid payroll' : 'Add commission, bonus or deductions'}
                      >
                        <Edit3 size={13} /> Adjust
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

      {/* Salary advances */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Wallet size={16} className="text-accent" /> Salary Advances</span>
        </div>

        <form className="advance-form" onSubmit={handleAddAdvance}>
          <div className="form-group">
            <label className="form-label" htmlFor="advance-agent">Agent</label>
            <select id="advance-agent" className="form-select" value={advanceForm.agentId} onChange={e => setAdvanceForm({ ...advanceForm, agentId: e.target.value })}>
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="advance-amount">Advance amount (PKR)</label>
            <input id="advance-amount" type="number" min="1" step="any" className="form-input" value={advanceForm.amountPkr} onChange={e => setAdvanceForm({ ...advanceForm, amountPkr: e.target.value })} placeholder="e.g. 5000" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="advance-date">Date given</label>
            <input id="advance-date" type="date" className="form-input" value={advanceForm.givenOn} onChange={e => setAdvanceForm({ ...advanceForm, givenOn: e.target.value })} />
          </div>
          <div className="form-group advance-note">
            <label className="form-label" htmlFor="advance-note">Note (optional)</label>
            <input id="advance-note" type="text" className="form-input" maxLength={300} value={advanceForm.note} onChange={e => setAdvanceForm({ ...advanceForm, note: e.target.value })} placeholder="e.g. medical emergency" />
          </div>
          <button type="submit" className="btn btn-primary advance-submit" disabled={savingAdvance}>Add Advance</button>
        </form>
        {advanceError && <div className="error-alert" role="alert">{advanceError}</div>}

        <div className="table-container" style={{ marginTop: '0.85rem' }}>
          <table className="data-table">
            <thead>
              <tr><th>Agent</th><th>Date</th><th>Advance</th><th>Recovered</th><th>Outstanding</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {advances.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.25rem' }}>No advances recorded.</td></tr>
              ) : advances.map(a => (
                <tr key={a.id}>
                  <td className="font-bold">{a.agentName}</td>
                  <td>{a.givenOn}</td>
                  <td className="font-mono">{formatPKR(a.amountPkr)}</td>
                  <td className="font-mono text-success">{formatPKR(a.recoveredPkr)}</td>
                  <td className="font-mono text-danger">{formatPKR(a.outstandingPkr)}</td>
                  <td className="text-sm text-muted">{a.note || '—'}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdvance(a)} disabled={a.recoveredPkr > 0} title={a.recoveredPkr > 0 ? 'Already partly recovered from a paid payroll' : 'Delete this advance'} aria-label={`Delete advance for ${a.agentName}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
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

      {adjustingFor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Adjust Payroll — {adjustingFor.agentName} ({adjustingFor.month})</span>
              <button className="icon-btn" onClick={() => setAdjustingFor(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveAdjust}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="adj-commission">Commission (PKR)</label>
                    <input id="adj-commission" type="number" min="0" step="any" className="form-input" value={adjustForm.commissionPkr} onChange={e => setAdjustForm({ ...adjustForm, commissionPkr: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="adj-bonus">Bonus (PKR)</label>
                    <input id="adj-bonus" type="number" min="0" step="any" className="form-input" value={adjustForm.bonusPkr} onChange={e => setAdjustForm({ ...adjustForm, bonusPkr: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="adj-deductions">Other deductions (PKR)</label>
                    <input id="adj-deductions" type="number" min="0" step="any" className="form-input" value={adjustForm.deductionsPkr} onChange={e => setAdjustForm({ ...adjustForm, deductionsPkr: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="adj-days">Days worked</label>
                    <input id="adj-days" type="number" min="0" max="31" step="1" className="form-input" value={adjustForm.workingDays} onChange={e => setAdjustForm({ ...adjustForm, workingDays: e.target.value })} />
                  </div>
                </div>
                <div className="text-xs text-subtle">
                  Days worked comes from attendance; change it only to correct a mistake (Calculate Payroll resets it to attendance).
                  Advances and tardy deductions are applied automatically.
                </div>
                {error && <div className="error-alert" role="alert">{error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustingFor(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Adjustments</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .payslip-header-brand { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
        .text-right { text-align: right; }
        .payslip-agent-info { background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
        .payslip-footer-note { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-subtle); border-top: 1px dashed var(--border-color); padding-top: 0.65rem; }
        .advance-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; align-items: end; }
        .advance-form .advance-note { grid-column: span 2; }
        .advance-submit { height: 38px; }
        @media (max-width: 640px) { .advance-form .advance-note { grid-column: span 1; } }
      `}</style>
    </div>
  );
}
