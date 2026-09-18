import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminTargets from './AdminTargets';

const USERS = [
  { id: 'a1', name: 'Ayesha Khan', role: 'Agent', status: 'Active' },
  { id: 'a2', name: 'Bilal Raza', role: 'Agent', status: 'Active' },
  { id: 'a3', name: 'Gone Person', role: 'Agent', status: 'Inactive' },
  { id: 's1', name: 'Sana Sup', role: 'Supervisor', status: 'Active' }
];
const NOW = new Date().toISOString();
const sale = (over) => ({ agentId: 'a1', status: 'Pending', saleDateIso: NOW, ...over });
const rowOf = (name) => screen.getByText(name).closest('tr');

const setup = (props = {}) => render(
  <AdminTargets users={USERS} sales={[]} targets={[]} onUpdateSalesTarget={vi.fn().mockResolvedValue(undefined)} {...props} />
);

describe('AdminTargets (sales-count targets)', () => {
  // Regression: this page used to read fields the API never sends (t.dailyTarget...) and crashed the whole app
  // the moment any target row existed.
  it('renders without crashing when the API returns real target rows', () => {
    const targets = [{ agentId: 'a1', agentName: 'Ayesha Khan', dailyTargetPkr: 0, monthlyTargetPkr: 0, monthlyAchievedPkr: 0, monthlySalesTarget: 10 }];
    expect(() => setup({ targets })).not.toThrow();
    expect(rowOf('Ayesha Khan')).toHaveTextContent('10');
    expect(within(rowOf('Bilal Raza')).getByText('Not set')).toBeInTheDocument();
  });

  it('lists only active agents (not supervisors or removed users)', () => {
    setup();
    expect(screen.getByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByText('Bilal Raza')).toBeInTheDocument();
    expect(screen.queryByText('Gone Person')).not.toBeInTheDocument();
    expect(screen.queryByText('Sana Sup')).not.toBeInTheDocument();
  });

  it('shows target, sales this month, remaining and progress', () => {
    setup({
      targets: [{ agentId: 'a1', monthlySalesTarget: 10 }],
      sales: [sale({}), sale({}), sale({}), sale({ status: 'Rejected' }), sale({ agentId: 'a2' })]
    });
    const row = rowOf('Ayesha Khan');
    expect(row).toHaveTextContent('10'); // target
    expect(row).toHaveTextContent('3'); // sales this month (rejected excluded, others\' sales excluded)
    expect(row).toHaveTextContent('7'); // remaining
    expect(row).toHaveTextContent('30%');
  });

  it('says so when a target is reached, and shows "Not set" when there is none', () => {
    setup({ targets: [{ agentId: 'a1', monthlySalesTarget: 2 }], sales: [sale({}), sale({}), sale({})] });
    expect(rowOf('Ayesha Khan')).toHaveTextContent(/target reached/i);
    expect(rowOf('Ayesha Khan')).toHaveTextContent('100%');
    expect(within(rowOf('Bilal Raza')).getByText('Not set')).toBeInTheDocument();
  });

  it('an Admin can set a target', async () => {
    const onUpdateSalesTarget = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onUpdateSalesTarget });

    await user.click(screen.getByLabelText('Set target for Bilal Raza'));
    const input = screen.getByLabelText(/number of sales per month/i);
    await user.clear(input);
    await user.type(input, '45');
    await user.click(screen.getByRole('button', { name: /save target/i }));
    expect(onUpdateSalesTarget).toHaveBeenCalledWith('a2', 45);
  });

  it('pre-fills the current target, and shows the server\'s error if saving fails', async () => {
    const onUpdateSalesTarget = vi.fn().mockRejectedValue(new Error('Targets can only be set for Agents'));
    const user = userEvent.setup();
    setup({ targets: [{ agentId: 'a1', monthlySalesTarget: 12 }], onUpdateSalesTarget });
    await user.click(screen.getByLabelText('Set target for Ayesha Khan'));
    expect(screen.getByLabelText(/number of sales per month/i).value).toBe('12');
    await user.click(screen.getByRole('button', { name: /save target/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/only be set for agents/i);
  });

  it('empty state when there are no agents', () => {
    setup({ users: [] });
    expect(screen.getByText(/no active agents yet/i)).toBeInTheDocument();
  });
});
