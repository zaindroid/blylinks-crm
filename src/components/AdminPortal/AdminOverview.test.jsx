import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import AdminOverview from './AdminOverview';
import { renderWithChat } from '../../test/chatTestUtils';
import * as salesApi from '../../api/sales';

vi.mock('../../api/sales');

const CURRENT_USER = { id: 'admin1', name: 'Boss', role: 'Admin' };
const USERS = [
  { id: 'admin1', name: 'Boss', role: 'Admin' },
  { id: 'a1', name: 'Ayesha Khan', role: 'Agent' },
  { id: 'a2', name: 'Bilal Raza', role: 'Agent' }
];
const PROJECTS = [
  { id: 'camp_solar', name: 'Solar', monthSalesCount: 2, monthlySalesGoal: 10, assignedAgentIds: ['a1'] },
  { id: 'camp_gas', name: 'Gas', monthSalesCount: 1, monthlySalesGoal: 10, assignedAgentIds: ['a2'] }
];

const sale = (over) => ({
  id: 'S1', agentId: 'a1', agentName: 'Ayesha Khan', customerName: 'Cust', campaignId: 'camp_solar',
  projectName: 'Solar', amount: 1000, status: 'Approved', saleDateIso: new Date().toISOString(), ...over
});

const setup = (props = {}) => renderWithChat(
  <AdminOverview
    currentUser={CURRENT_USER}
    sales={[]}
    users={USERS}
    projects={PROJECTS}
    attendanceLogs={[]}
    onApproveSale={vi.fn()}
    onRejectSale={vi.fn()}
    setActiveTab={vi.fn()}
    selectedCampaignId="camp_solar"
    onSendMessage={vi.fn()}
    {...props}
  />
);

describe('AdminOverview combined (not campaign-scoped) totals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // SalesLeaderboard self-fetches on mount; it's embedded in this page, not under test here.
    salesApi.fetchLeaderboard.mockResolvedValue([]);
  });

  it('counts approved/pending sales combined across every campaign, not just the selected one', () => {
    setup({
      sales: [
        sale({ id: 'S1', campaignId: 'camp_solar', status: 'Approved' }),
        sale({ id: 'S2', campaignId: 'camp_gas', status: 'Approved' }), // a different campaign than selectedCampaignId
        sale({ id: 'S3', campaignId: 'camp_gas', status: 'Pending' })
      ]
    });

    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    const totalSalesCard = screen.getByText('Total Sales').closest('.kpi-card');
    expect(totalSalesCard).toHaveTextContent('2'); // both Approved sales, from both campaigns

    const pendingCard = screen.getByText('Pending Review').closest('.kpi-card');
    expect(pendingCard).toHaveTextContent('1');
  });

  it('shows the total agent count, not just the selected campaign\'s assigned agents', () => {
    setup();
    const agentsCard = screen.getByText('Total Agents').closest('.kpi-card');
    expect(agentsCard).toHaveTextContent('2'); // both Agents in USERS, not just camp_solar's one
  });

  it('includes the Performance Report with a combined total across campaigns', () => {
    setup({
      sales: [
        sale({ id: 'S1', campaignId: 'camp_solar' }),
        sale({ id: 'S2', campaignId: 'camp_gas' })
      ]
    });
    expect(screen.getByText('Performance Report')).toBeInTheDocument();
    expect(screen.getByText(/total sales submitted:/i).parentElement).toHaveTextContent('2');
  });
});
