import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminProjects from './AdminProjects';

const ADMIN = { id: 'admin1', name: 'Boss', role: 'Admin' };
const SUPERVISOR = { id: 's1', name: 'Sana Sup', role: 'Supervisor', allowedCampaignIds: ['camp_1'] };
const USERS = [
  { id: 'a1', name: 'Ayesha Khan', role: 'Agent', designation: 'Agent', allowedCampaignIds: ['camp_1'] },
  { id: 'a2', name: 'Other Team', role: 'Agent', designation: 'Agent', allowedCampaignIds: ['camp_2'] }
];
const PROJECTS = [
  { id: 'camp_1', name: 'Solar', client: 'EcoPower', category: 'Energy', monthlySalesGoal: 50, monthSalesCount: 10, status: 'Active', assignedAgentIds: ['a1'] }
];

const setup = (currentUser, props = {}) => render(
  <AdminProjects
    currentUser={currentUser}
    projects={PROJECTS}
    users={USERS}
    onAddProject={vi.fn()}
    onUpdateProject={vi.fn()}
    onToggleProjectStatus={vi.fn()}
    {...props}
  />
);

describe('AdminProjects role-based access', () => {
  it('an Admin sees Create Campaign and Activate/Deactivate controls', () => {
    setup(ADMIN);
    expect(screen.getByRole('button', { name: /create new campaign/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
  });

  it('a Supervisor does not see Create Campaign or the Activate/Deactivate toggle', () => {
    setup(SUPERVISOR);
    expect(screen.queryByRole('button', { name: /create new campaign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deactivate|activate/i })).not.toBeInTheDocument();
  });

  it('a Supervisor can still open Edit / Assign Agents', () => {
    setup(SUPERVISOR);
    expect(screen.getByRole('button', { name: /edit \/ assign agents/i })).toBeInTheDocument();
  });

  it('a Supervisor\'s agent-assignment list only offers agents who share their own campaigns', async () => {
    const user = userEvent.setup();
    setup(SUPERVISOR);
    await user.click(screen.getByRole('button', { name: /edit \/ assign agents/i }));
    expect(screen.getByText(/Ayesha Khan/)).toBeInTheDocument();
    expect(screen.queryByText(/Other Team/)).not.toBeInTheDocument();
  });

  it('an Admin\'s agent-assignment list offers every agent', async () => {
    const user = userEvent.setup();
    setup(ADMIN);
    await user.click(screen.getByRole('button', { name: /edit \/ assign agents/i }));
    expect(screen.getByText(/Ayesha Khan/)).toBeInTheDocument();
    expect(screen.getByText(/Other Team/)).toBeInTheDocument();
  });

  it('saving an edit submits the updated fields', async () => {
    const onUpdateProject = vi.fn();
    const user = userEvent.setup();
    setup(ADMIN, { onUpdateProject });
    await user.click(screen.getByRole('button', { name: /edit \/ assign agents/i }));
    await user.click(screen.getByRole('button', { name: /save campaign settings/i }));
    expect(onUpdateProject).toHaveBeenCalledWith('camp_1', expect.objectContaining({ name: 'Solar', assignedAgentIds: ['a1'] }));
  });
});
