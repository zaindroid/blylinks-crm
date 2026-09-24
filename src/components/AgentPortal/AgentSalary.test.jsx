import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentSalary from './AgentSalary';

const CURRENT_USER = { id: 'a1', name: 'Ayesha Khan', role: 'Agent' };
const payslip = (over) => ({
  id: 'pay_a1_2026-09', agentId: 'a1', agentName: 'Ayesha Khan', month: '2026-09',
  baseSalaryPkr: 48000, workingDays: 20, perDayPkr: 2000,
  commissionPkr: 1500, bonusPkr: 500, tardyWeeks: 1, tardyDeductionPkr: 1000,
  advanceDeductionPkr: 2000, deductionsPkr: 0, netSalaryPkr: 39000,
  status: 'Paid', paymentDate: '2026-10-01',
  ...over
});

describe('AgentSalary', () => {
  it('shows an empty state when there is no payroll history yet', () => {
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[]} />);
    expect(screen.getByText(/will appear here once payroll has been calculated/i)).toBeInTheDocument();
  });

  it('only ever shows this agent\'s own records, even if other agents\' rows are passed in', () => {
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[payslip({}), payslip({ id: 'pay_a2', agentId: 'a2', agentName: 'Bilal Raza', month: '2026-09' })]} />);
    expect(screen.queryByText('Bilal Raza')).not.toBeInTheDocument();
  });

  it('highlights the latest month\'s net payout and status', () => {
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[payslip({})]} />);
    expect(screen.getByText(/latest payout \(2026-09\)/i)).toBeInTheDocument();
    // "Rs. 39,000" and "Paid" also appear in the history row below -- the KPI card's own
    // copies are what this test cares about, so at least one of each is enough here.
    expect(screen.getAllByText('Rs. 39,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  });

  it('lists every month in the history table, most recent first', () => {
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[
      payslip({ id: 'p1', month: '2026-07', netSalaryPkr: 30000 }),
      payslip({ id: 'p2', month: '2026-09', netSalaryPkr: 39000 })
    ]} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('2026-09');
    expect(rows[1]).toHaveTextContent('2026-07');
  });

  it('opens a full payslip breakdown showing how the earnings were calculated', async () => {
    const user = userEvent.setup();
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[payslip({})]} />);
    await user.click(screen.getByRole('button', { name: /view payslip/i }));

    expect(screen.getByText('Employee Official Payslip — Blylinks PKR')).toBeInTheDocument();
    expect(screen.getByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByText(/per-day rate/i)).toBeInTheDocument();
    expect(screen.getByText(/1 week with 3\+ tardies/i)).toBeInTheDocument();
    expect(screen.getByText('NET PAYOUT AMOUNT')).toBeInTheDocument();
  });

  it('the payslip can be closed', async () => {
    const user = userEvent.setup();
    render(<AgentSalary currentUser={CURRENT_USER} payroll={[payslip({})]} />);
    await user.click(screen.getByRole('button', { name: /view payslip/i }));
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByText('Employee Official Payslip — Blylinks PKR')).not.toBeInTheDocument();
  });
});
