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

  it('counts sales combined across every campaign, not just the selected one', () => {
    setup({
      sales: [
        sale({ id: 'S1', campaignId: 'camp_solar', status: 'Approved' }),
        sale({ id: 'S2', campaignId: 'camp_gas', status: 'Approved' }), // a different campaign than selectedCampaignId
        sale({ id: 'S3', campaignId: 'camp_gas', status: 'Pending' })
      ]
    });

    // Total Sales counts every sale SUBMITTED (any status), the same basis as the leaderboard
    // and Performance Report use -- not Approved-only.
    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    const totalSalesCard = screen.getByText('Total Sales').closest('.kpi-card');
    expect(totalSalesCard).toHaveTextContent('3');

    const pendingCard = screen.getByText('Pending Review').closest('.kpi-card');
    expect(pendingCard).toHaveTextContent('1');
  });

  it('Approval Rate shows the approved count against the total, not a redundant repeat of Total Sales', () => {
    setup({
      sales: [
        sale({ id: 'S1', status: 'Approved' }),
        sale({ id: 'S2', status: 'Pending' })
      ]
    });
    const approvalCard = screen.getByText('Approval Rate').closest('.kpi-card');
    expect(approvalCard).toHaveTextContent('50%');
    expect(approvalCard).toHaveTextContent('1 of 2 Approved');
  });

  it('shows the total agent count, not just the selected campaign\'s assigned agents', () => {
    setup();
    const agentsCard = screen.getByText('Total Agents').closest('.kpi-card');
    expect(agentsCard).toHaveTextContent('2'); // both Agents in USERS, not just camp_solar's one
  });

  it('"Sales Today by Campaign" counts every sale submitted today, not just Approved ones', () => {
    const today = new Date().toISOString();
    setup({
      sales: [
        sale({ id: 'S1', campaignId: 'camp_solar', status: 'Approved', saleDateIso: today }),
        sale({ id: 'S2', campaignId: 'camp_solar', status: 'Pending', saleDateIso: today }),
        sale({ id: 'S3', campaignId: 'camp_solar', status: 'Rejected', saleDateIso: today })
      ]
    });
    const card = screen.getByText('Sales Today by Campaign').closest('.card');
    expect(card).toHaveTextContent('3 submitted today');
  });

  it('counts an "Electric and Gas" Sale Type as 2 sales, for Total Sales and Approval Rate alike', () => {
    setup({
      sales: [
        sale({ id: 'S1', status: 'Approved', saleType: 'Electric' }), // 1
        sale({ id: 'S2', status: 'Approved', saleType: 'Gas' }), // 1
        sale({ id: 'S3', status: 'Approved', saleType: 'Electric and Gas' }) // 2
      ]
    });

    // 1 + 1 + 2 = 4 sales total, all Approved -> 100%, "4 of 4 Approved".
    const totalSalesCard = screen.getByText('Total Sales').closest('.kpi-card');
    expect(totalSalesCard).toHaveTextContent('4');
    const approvalCard = screen.getByText('Approval Rate').closest('.kpi-card');
    expect(approvalCard).toHaveTextContent('100%');
    expect(approvalCard).toHaveTextContent('4 of 4 Approved');
  });

  it('"Sales Today by Campaign" counts an "Electric and Gas" sale as 2, not 1', () => {
    const today = new Date().toISOString();
    setup({
      sales: [
        sale({ id: 'S1', campaignId: 'camp_solar', status: 'Approved', saleDateIso: today, saleType: 'Electric and Gas' })
      ]
    });
    const card = screen.getByText('Sales Today by Campaign').closest('.card');
    expect(card).toHaveTextContent('2 submitted today');
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
