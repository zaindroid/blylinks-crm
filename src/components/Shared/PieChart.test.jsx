import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PieChart from './PieChart';

describe('PieChart', () => {
  it('shows each slice label, its raw value and its percentage of the total', () => {
    render(<PieChart data={[{ label: 'Solar', value: 3 }, { label: 'Gas', value: 1 }]} />);
    expect(screen.getByText('Solar')).toBeInTheDocument();
    expect(screen.getByText('3 (75%)')).toBeInTheDocument();
    expect(screen.getByText('Gas')).toBeInTheDocument();
    expect(screen.getByText('1 (25%)')).toBeInTheDocument();
  });

  it('omits zero-value entries from the legend', () => {
    render(<PieChart data={[{ label: 'Solar', value: 5 }, { label: 'Gas', value: 0 }]} />);
    expect(screen.getByText('Solar')).toBeInTheDocument();
    expect(screen.queryByText('Gas')).not.toBeInTheDocument();
  });

  it('shows a no-data message when everything is zero', () => {
    render(<PieChart data={[{ label: 'Solar', value: 0 }]} />);
    expect(screen.getByText(/no data for this period/i)).toBeInTheDocument();
  });

  it('renders a single 100% slice without crashing (the degenerate full-circle case)', () => {
    render(<PieChart data={[{ label: 'Solar', value: 10 }]} />);
    expect(screen.getByText('Solar')).toBeInTheDocument();
    expect(screen.getByText('10 (100%)')).toBeInTheDocument();
  });
});
