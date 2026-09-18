import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPayroll from './AdminPayroll';
import * as payrollApi from '../../api/payroll';

vi.mock('../../api/payroll');

const ROW = {
  id: 'pay_a1_2026-03', agentId: 'usr_a1', agentName: 'Ayesha Khan', month: '2026-03',
  baseSalaryPkr: 24000, workingDays: 10, perDayPkr: 1000, commissionPkr: 1500, bonusPkr: 500,
  tardyWeeks: 1, tardyDeductionPkr: 500, advanceDeductionPkr: 2000, deductionsPkr: 0, netSalaryPkr: 9500,
  status: 'Pending', paymentDate: 'Pending Approval'
};
const AGENTS = [{ id: 'usr_a1', name: 'Ayesha Khan', role: 'Agent', status: 'Active' }];
const ADVANCE = { id: 'adv_1', agentId: 'usr_a1', agentName: 'Ayesha Khan', amountPkr: 5000, recoveredPkr: 0, outstandingPkr: 5000, givenOn: '2026-03-01', note: 'medical' };

const setup = (props = {}) => render(
  <AdminPayroll
    payroll={[ROW]}
    users={AGENTS}
    onTogglePaymentStatus={vi.fn().mockResolvedValue(undefined)}
    onGeneratePayroll={vi.fn().mockResolvedValue(undefined)}
    onUpdatePayrollAdjustments={vi.fn().mockResolvedValue(undefined)}
    {...props}
  />
);

describe('AdminPayroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payrollApi.fetchAdvances.mockResolvedValue([ADVANCE]);
    payrollApi.addAdvance.mockResolvedValue(ADVANCE);
    payrollApi.deleteAdvance.mockResolvedValue({ status: 'deleted' });
  });

  it('shows the full breakdown: days worked, earned, commission, tardy, advance and net', async () => {
    setup();
    const row = (await screen.findByText('Ayesha Khan', { selector: 'td' })).closest('tr');
    expect(within(row).getByText('10')).toBeInTheDocument(); // days worked
    expect(row).toHaveTextContent('1 tardy week');
    expect(row.textContent).toMatch(/9,?500/); // net
  });

  it('calculating payroll for the chosen month calls the handler and refreshes advance balances', async () => {
    const onGeneratePayroll = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onGeneratePayroll });
    await screen.findByText('medical');
    payrollApi.fetchAdvances.mockClear();

    await user.click(screen.getByRole('button', { name: /calculate payroll/i }));
    await waitFor(() => expect(onGeneratePayroll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(payrollApi.fetchAdvances).toHaveBeenCalled());
  });

  it('adds commission through Adjust and sends it to the server', async () => {
    const onUpdatePayrollAdjustments = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onUpdatePayrollAdjustments });

    await user.click(screen.getByRole('button', { name: /adjust/i }));
    const commission = screen.getByLabelText(/commission/i);
    await user.clear(commission);
    await user.type(commission, '2500');
    await user.click(screen.getByRole('button', { name: /save adjustments/i }));

    expect(onUpdatePayrollAdjustments).toHaveBeenCalledWith(ROW.id, expect.objectContaining({ commissionPkr: 2500, workingDays: 10 }));
  });

  it('a Paid payroll cannot be adjusted (revert it first)', async () => {
    setup({ payroll: [{ ...ROW, status: 'Paid' }] });
    expect(screen.getByRole('button', { name: /adjust/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /revert to pending/i })).toBeInTheDocument();
  });

  it('shows a server refusal instead of failing silently', async () => {
    const onTogglePaymentStatus = vi.fn().mockRejectedValue(new Error('Payroll record not found'));
    const user = userEvent.setup();
    setup({ onTogglePaymentStatus });
    await user.click(screen.getByRole('button', { name: /approve & pay/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/payroll record not found/i);
  });

  it('records an advance for an agent', async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText(/^agent$/i), 'usr_a1');
    await user.type(screen.getByLabelText(/advance amount/i), '3000');
    await user.type(screen.getByLabelText(/note/i), 'rent');
    await user.click(screen.getByRole('button', { name: /add advance/i }));

    await waitFor(() => expect(payrollApi.addAdvance).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'usr_a1', amountPkr: 3000, note: 'rent' })));
  });

  it('will not submit an advance without an agent or with a non-positive amount', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/advance amount/i), '3000');
    await user.click(screen.getByRole('button', { name: /add advance/i }));
    expect(await screen.findByText(/choose the agent/i)).toBeInTheDocument();
    expect(payrollApi.addAdvance).not.toHaveBeenCalled();
  });

  it('lists advances with recovered / outstanding, and locks deletion once part has been recovered', async () => {
    payrollApi.fetchAdvances.mockResolvedValue([
      ADVANCE,
      { ...ADVANCE, id: 'adv_2', agentName: 'Bilal', recoveredPkr: 1000, outstandingPkr: 500, amountPkr: 1500 }
    ]);
    setup();
    expect(await screen.findByLabelText('Delete advance for Ayesha Khan')).toBeEnabled();
    expect(screen.getByLabelText('Delete advance for Bilal')).toBeDisabled();
  });

  it('deleting an unrecovered advance calls the API', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByLabelText('Delete advance for Ayesha Khan'));
    await waitFor(() => expect(payrollApi.deleteAdvance).toHaveBeenCalledWith('adv_1'));
  });
});
