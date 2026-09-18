import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleCelebration from './SaleCelebration';

vi.mock('../../utils/sound', () => ({ playBlylinksTone: vi.fn() }));

const celebration = {
  headline: 'Rockstar move, Sarah! 🎸',
  message: 'That is how it is done.',
  stats: [{ label: 'Today', value: 4 }, { label: 'This month', value: 17 }],
  tracker: { goal: 150, current: 130, remaining: 20, pct: 87, reached: false, line: "20 more sales to hit this month's goal of 150. You've got this!" },
  intensity: 'normal'
};

describe('SaleCelebration', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the headline, message, personal stats and the remaining-to-goal tracker', () => {
    render(<SaleCelebration celebration={celebration} onDone={vi.fn()} />);
    expect(screen.getByText(/Rockstar move, Sarah/)).toBeInTheDocument();
    expect(screen.getByText('That is how it is done.')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText(/20 more sales to hit this month's goal of 150/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: /monthly sales goal progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '130');
    expect(bar).toHaveAttribute('aria-valuemax', '150');
  });

  it('omits the tracker when there is no goal', () => {
    render(<SaleCelebration celebration={{ ...celebration, tracker: null }} onDone={vi.fn()} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('draws confetti (decorative, hidden from assistive tech)', () => {
    const { container } = render(<SaleCelebration celebration={celebration} onDone={vi.fn()} />);
    const pieces = container.querySelectorAll('.confetti-piece');
    expect(pieces.length).toBeGreaterThanOrEqual(60);
    pieces.forEach(p => expect(p).toHaveAttribute('aria-hidden', 'true'));
  });

  it('bigger moments get more confetti', () => {
    const { container: normal } = render(<SaleCelebration celebration={celebration} onDone={vi.fn()} />);
    const { container: epic } = render(<SaleCelebration celebration={{ ...celebration, intensity: 'epic' }} onDone={vi.fn()} />);
    expect(epic.querySelectorAll('.confetti-piece').length).toBeGreaterThan(normal.querySelectorAll('.confetti-piece').length);
  });

  it('can be closed with the button', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<SaleCelebration celebration={celebration} onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /close celebration/i }));
    expect(onDone).toHaveBeenCalled();
  });

  it('can be closed with Escape', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<SaleCelebration celebration={celebration} onDone={onDone} />);
    await user.keyboard('{Escape}');
    expect(onDone).toHaveBeenCalled();
  });

  it('dismisses itself after enough time to read it, but not immediately', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SaleCelebration celebration={celebration} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stays open while the mouse is over the card', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SaleCelebration celebration={celebration} onDone={onDone} />);
    const card = screen.getByRole('status');
    act(() => { card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    // React's onMouseEnter is driven by mouseover; advance well past the normal timeout
    act(() => { vi.advanceTimersByTime(30000); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('skips the confetti for people who prefer reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { container } = render(<SaleCelebration celebration={celebration} onDone={vi.fn()} />);
    expect(container.querySelectorAll('.confetti-piece')).toHaveLength(0);
    expect(screen.getByText(/Rockstar move/)).toBeInTheDocument(); // the message still shows
    window.matchMedia = original;
  });
});
