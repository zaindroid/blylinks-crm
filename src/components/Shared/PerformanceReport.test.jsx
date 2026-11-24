import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PerformanceReport from './PerformanceReport';

// Wed 2026-08-19, matching the fixed-clock convention used in dateFilters.test.js.
const FIXED_NOW = new Date(2026, 7, 19, 15, 0, 0);

const sale = (over) => ({
  id: 'S1', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan',
  status: 'Approved', saleDateIso: FIXED_NOW.toISOString(), ...over
});

describe('PerformanceReport', () => {
  it('defaults to Today and counts every sale submitted today regardless of status', () => {
    // Scoped to just this test -- userEvent interactions elsewhere in this file don't mix well
    // with a faked clock, so the other tests use fireEvent and the real clock instead.
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    try {
      render(<PerformanceReport sales={[
        sale({ id: 'S1', status: 'Approved' }),
        sale({ id: 'S2', status: 'Pending' }),
        sale({ id: 'S3', status: 'Rejected', saleDateIso: new Date(2026, 6, 1).toISOString() }) // last month -- excluded
      ]} />);

      expect(screen.getByText('2')).toBeInTheDocument(); // total sales submitted today
    } finally {
      vi.useRealTimers();
    }
  });

  it('combines campaigns and agents, not scoped to any single one', () => {
    // The default range is "Today", so these need the real current time -- FIXED_NOW is a fixed
    // point in the past under the real (unmocked) clock this test runs with.
    const now = new Date().toISOString();
    render(<PerformanceReport sales={[
      sale({ id: 'S1', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', saleDateIso: now }),
      sale({ id: 'S2', campaignId: 'c2', projectName: 'Gas', agentId: 'a2', agentName: 'Bilal Raza', saleDateIso: now })
    ]} />);

    expect(screen.getByText('Solar')).toBeInTheDocument();
    expect(screen.getByText('Gas')).toBeInTheDocument();
    expect(screen.getByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByText('Bilal Raza')).toBeInTheDocument();
  });

  it('switching the time range changes which sales are counted', () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    render(<PerformanceReport sales={[
      sale({ id: 'S1', saleDateIso: now.toISOString() }), // today
      sale({ id: 'S2', saleDateIso: lastMonth.toISOString() }) // outside "Today"
    ]} />);

    expect(screen.getByText(/total sales submitted:/i).parentElement).toHaveTextContent('1');

    fireEvent.change(screen.getByLabelText(/performance report time range/i), { target: { value: 'All Time' } });
    expect(screen.getByText(/total sales submitted:/i).parentElement).toHaveTextContent('2');
  });

  it('counts a sale with both electric AND gas account info as 2 sales, not 1', () => {
    const now = new Date().toISOString();
    render(<PerformanceReport sales={[
      sale({ id: 'S1', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', saleDateIso: now, electricAccountNumber: 'EL-1' }), // electric only -> 1
      sale({ id: 'S2', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', saleDateIso: now, gasAccountNumber: 'GAS-1' }), // gas only -> 1
      sale({ id: 'S3', campaignId: 'c1', projectName: 'Solar', agentId: 'a1', agentName: 'Ayesha Khan', saleDateIso: now, electricAccountNumber: 'EL-2', gasAccountNumber: 'GAS-2' }) // both -> 2
    ]} />);

    // 1 + 1 + 2 = 4, not 3 rows.
    expect(screen.getByText(/total sales submitted:/i).parentElement).toHaveTextContent('4');
  });

  it('shows From/To date fields only when Custom is selected', () => {
    render(<PerformanceReport sales={[]} />);
    expect(screen.queryByLabelText(/performance report from date/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/performance report time range/i), { target: { value: 'Custom' } });
    expect(screen.getByLabelText(/performance report from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/performance report to date/i)).toBeInTheDocument();
  });
});
