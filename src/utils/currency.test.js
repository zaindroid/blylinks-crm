import { describe, it, expect } from 'vitest';
import { formatPKR } from './currency';

describe('formatPKR', () => {
  it('formats a positive number with thousands separators and the Rs. prefix', () => {
    expect(formatPKR(1500000)).toBe('Rs. 1,500,000');
  });

  it('formats zero', () => {
    expect(formatPKR(0)).toBe('Rs. 0');
  });

  it('treats null/undefined/NaN as zero instead of throwing or printing NaN', () => {
    expect(formatPKR(null)).toBe('Rs. 0');
    expect(formatPKR(undefined)).toBe('Rs. 0');
    expect(formatPKR('not a number')).toBe('Rs. 0');
  });

  it('coerces numeric strings (as returned by the API for NUMERIC columns)', () => {
    expect(formatPKR('2500.00')).toBe('Rs. 2,500');
  });

  it('formats negative numbers', () => {
    expect(formatPKR(-500)).toBe('Rs. -500');
  });
});
