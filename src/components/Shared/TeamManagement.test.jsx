import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamManagement from './TeamManagement';

const ADMIN = { id: 'usr_admin', name: 'Boss', role: 'Admin', allowedCampaignIds: [] };
const SUPERVISOR = { id: 'usr_sup', name: 'Sup', role: 'Supervisor', allowedCampaignIds: ['camp_1'] };
const AGENT = { id: 'usr_a1', name: 'Ayesha Khan', username: 'ayesha', role: 'Agent', status: 'Active', allowedCampaignIds: ['camp_1'], baseSalaryPkr: 0 };
const OTHER_AGENT = { id: 'usr_a2', name: 'Bilal Raza', username: 'bilal', role: 'Agent', status: 'Active', allowedCampaignIds: ['camp_2'], baseSalaryPkr: 0 };
const PROJECTS = [{ id: 'camp_1', name: 'Solar' }, { id: 'camp_2', name: 'Gas' }];

const setup = (currentUser, extra = {}) => render(
  <TeamManagement
    currentUser={currentUser}
    users={[ADMIN, SUPERVISOR, AGENT, OTHER_AGENT]}
    projects={PROJECTS}
    targets={[{ agentId: 'usr_a1', monthlySalesTarget: 45 }]}
    onAddUser={vi.fn()}
    onDeactivateUser={vi.fn()}
    onUpdateUserCampaigns={vi.fn()}
    onUpdateBaseSalary={vi.fn()}
    onResetPassword={vi.fn()}
    onChangeRole={vi.fn()}
    onUpdateSalesTarget={vi.fn().mockResolvedValue(undefined)}
    {...extra}
  />
);

const rowOf = (name) => screen.getByText(name).closest('tr');

describe('TeamManagement sales targets', () => {
  it('shows each agent monthly sales target, or "Not set"', () => {
    setup(ADMIN);
    expect(within(rowOf('Ayesha Khan')).getByText('45 sales')).toBeInTheDocument();
    expect(within(rowOf('Bilal Raza')).getByText('Not set')).toBeInTheDocument();
  });

  it('an Admin can set an agent target', async () => {
    const onUpdateSalesTarget = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup(ADMIN, { onUpdateSalesTarget });

    await user.click(within(rowOf('Bilal Raza')).getByRole('button', { name: /target/i }));
    const input = screen.getByLabelText(/number of sales per month/i);
    await user.clear(input);
    await user.type(input, '80');
    await user.click(screen.getByRole('button', { name: /save target/i }));

    expect(onUpdateSalesTarget).toHaveBeenCalledWith('usr_a2', 80);
  });

  it('a Supervisor can set the target for an agent they manage, and only sees their own agents', async () => {
    const onUpdateSalesTarget = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup(SUPERVISOR, { onUpdateSalesTarget });

    expect(screen.queryByText('Bilal Raza')).not.toBeInTheDocument(); // other campaign: not visible at all
    await user.click(within(rowOf('Ayesha Khan')).getByRole('button', { name: /target/i }));
    const input = screen.getByLabelText(/number of sales per month/i);
    expect(input.value).toBe('45'); // pre-filled with the current target
    await user.clear(input);
    await user.type(input, '50');
    await user.click(screen.getByRole('button', { name: /save target/i }));
    expect(onUpdateSalesTarget).toHaveBeenCalledWith('usr_a1', 50);
  });

  it('refuses a fractional or negative target without calling the server', async () => {
    const onUpdateSalesTarget = vi.fn();
    const user = userEvent.setup();
    setup(ADMIN, { onUpdateSalesTarget });
    await user.click(within(rowOf('Ayesha Khan')).getByRole('button', { name: /target/i }));
    const input = screen.getByLabelText(/number of sales per month/i);
    for (const bad of ['2.5', '-3']) {
      await user.clear(input);
      await user.type(input, bad);
      await user.click(screen.getByRole('button', { name: /save target/i }));
    }
    // The input's own min/step constraints block submission (as in a real browser);
    // the server, which validates independently, is never reached.
    expect(onUpdateSalesTarget).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/number of sales per month/i)).toBeInTheDocument();
  });

  it('surfaces a server error and keeps the modal open', async () => {
    const onUpdateSalesTarget = vi.fn().mockRejectedValue(new Error('This agent is outside your campaign access'));
    const user = userEvent.setup();
    setup(ADMIN, { onUpdateSalesTarget });
    await user.click(within(rowOf('Ayesha Khan')).getByRole('button', { name: /target/i }));
    await user.click(screen.getByRole('button', { name: /save target/i }));
    expect(await screen.findByText(/outside your campaign access/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of sales per month/i)).toBeInTheDocument();
  });

  it('there is no Target button for non-agents', () => {
    setup(ADMIN);
    expect(within(rowOf('Sup')).queryByRole('button', { name: /^target$/i })).not.toBeInTheDocument();
  });
});

describe('TeamManagement role changes', () => {
  it('an Admin gets a role dropdown for other users and can change it', async () => {
    const onChangeRole = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup(ADMIN, { onChangeRole });
    await user.selectOptions(screen.getByLabelText('Role for Ayesha Khan'), 'Supervisor');
    expect(onChangeRole).toHaveBeenCalledWith('usr_a1', 'Supervisor');
  });

  it('an Admin cannot change their own role (no dropdown for themselves)', () => {
    setup(ADMIN);
    expect(screen.queryByLabelText('Role for Boss')).not.toBeInTheDocument();
  });

  it('a Supervisor sees plain role badges, no dropdown', () => {
    setup(SUPERVISOR);
    expect(screen.queryByLabelText(/^Role for/)).not.toBeInTheDocument();
  });

  it('shows the reason when a change is refused', async () => {
    const onChangeRole = vi.fn().mockRejectedValue(new Error('You cannot change your own role'));
    const user = userEvent.setup();
    setup(ADMIN, { onChangeRole });
    await user.selectOptions(screen.getByLabelText('Role for Ayesha Khan'), 'Admin');
    expect(await screen.findByText(/cannot change your own role/i)).toBeInTheDocument();
  });
});
