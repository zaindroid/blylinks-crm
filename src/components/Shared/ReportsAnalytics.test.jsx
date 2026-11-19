import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsAnalytics from './ReportsAnalytics';

const sale = (over) => ({
  id: 'S1', customerName: 'Cust', agentName: 'Ayesha', projectName: 'Solar', amount: 100,
  status: 'Approved', date: '9/1/2026', saleDateIso: '2026-09-01T10:00:00.000Z', ...over
});

const setup = (props = {}) => render(
  <ReportsAnalytics sales={[]} attendanceLogs={[]} leads={[]} payroll={[]} {...props} />
);

describe('ReportsAnalytics sales report custom date range', () => {
  it('defaults to All Time, showing every sale', () => {
    setup({ sales: [sale({ id: 'S1', saleDateIso: '2026-01-01T00:00:00.000Z' }), sale({ id: 'S2', saleDateIso: '2026-09-01T00:00:00.000Z' })] });
    expect(screen.getByText(/Total Tracked Submissions: 2 Sales Records/i)).toBeInTheDocument();
  });

  it('narrows the count to a custom date range', async () => {
    const user = userEvent.setup();
    setup({
      sales: [
        sale({ id: 'S1', saleDateIso: '2026-08-01T00:00:00.000Z' }),
        sale({ id: 'S2', saleDateIso: '2026-09-15T00:00:00.000Z' }),
        sale({ id: 'S3', saleDateIso: '2026-10-01T00:00:00.000Z' })
      ]
    });

    await user.selectOptions(screen.getByLabelText(/sales report date range/i), 'Custom');
    fireEvent.change(screen.getByLabelText(/sales report from date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/sales report to date/i), { target: { value: '2026-09-30' } });

    expect(screen.getByText(/Total Tracked Submissions: 1 Sales Records/i)).toBeInTheDocument();
  });

  it('only shows the custom from/to date inputs when Custom is selected', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByLabelText(/sales report from date/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/sales report date range/i), 'Custom');
    expect(screen.getByLabelText(/sales report from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sales report to date/i)).toBeInTheDocument();
  });

  it('exporting the sales report CSV does not throw, even with an active custom range', async () => {
    const user = userEvent.setup();
    setup({ sales: [sale()] });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await user.selectOptions(screen.getByLabelText(/sales report date range/i), 'This Month');
    const exportButtons = screen.getAllByRole('button', { name: /export csv/i });
    expect(() => fireEvent.click(exportButtons[0])).not.toThrow();

    clickSpy.mockRestore();
  });
});
