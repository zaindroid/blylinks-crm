const { computePayroll, allocateRecovery } = require('../utils/payrollMath');

// The formula on its own, with hand-calculated numbers -- no database, no HTTP.
describe('computePayroll', () => {
  it('per-day = base / 24; pay = per-day x working days', () => {
    const r = computePayroll({ baseSalary: 48000, workingDays: 20 });
    expect(r.perDay).toBe(2000);
    expect(r.earnedBase).toBe(40000);
    expect(r.net).toBe(40000);
  });

  it('adds commission and bonus, subtracts other deductions', () => {
    const r = computePayroll({ baseSalary: 24000, workingDays: 10, commission: 2500, bonus: 500, otherDeductions: 1000 });
    expect(r.gross).toBe(13000);
    expect(r.net).toBe(12000);
  });

  it('half a day\'s pay per penalty week', () => {
    expect(computePayroll({ baseSalary: 24000, workingDays: 10, tardyWeeks: 1 }).tardyDeduction).toBe(500);
    expect(computePayroll({ baseSalary: 24000, workingDays: 10, tardyWeeks: 3 }).tardyDeduction).toBe(1500);
  });

  it('deducts an advance in full when the pay can cover it', () => {
    const r = computePayroll({ baseSalary: 24000, workingDays: 10, outstandingAdvances: 4000 });
    expect(r.advanceDeduction).toBe(4000);
    expect(r.net).toBe(6000);
  });

  it('caps the advance recovery at what is left, so net is never negative', () => {
    const r = computePayroll({ baseSalary: 24000, workingDays: 2, outstandingAdvances: 50000 });
    expect(r.advanceDeduction).toBe(2000);
    expect(r.net).toBe(0);
  });

  it('when the Admin\'s own deductions exceed the pay, no advance is recovered and the shortfall shows as a negative net (visible, not silently hidden)', () => {
    const r = computePayroll({ baseSalary: 24000, workingDays: 1, otherDeductions: 5000, outstandingAdvances: 100 });
    expect(r.advanceDeduction).toBe(0);
    expect(r.net).toBe(-4000);
  });

  it('treats junk input as zero rather than producing NaN', () => {
    const r = computePayroll({ baseSalary: 'abc', workingDays: undefined, commission: null, tardyWeeks: -2, outstandingAdvances: NaN });
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
    expect(r.net).toBe(0);
  });

  it('a zero base salary yields zero pay however many days were worked', () => {
    expect(computePayroll({ baseSalary: 0, workingDays: 24 }).net).toBe(0);
  });
});

describe('allocateRecovery', () => {
  it('spreads a recovery over advances in the order given', () => {
    const out = allocateRecovery([{ id: 'a', outstanding: 2000 }, { id: 'b', outstanding: 2000 }], 3000);
    expect(out).toEqual([{ advanceId: 'a', amount: 2000 }, { advanceId: 'b', amount: 1000 }]);
  });

  it('recovers nothing when there is nothing to recover, and never over-recovers', () => {
    expect(allocateRecovery([{ id: 'a', outstanding: 500 }], 0)).toEqual([]);
    expect(allocateRecovery([{ id: 'a', outstanding: 500 }], 9999)).toEqual([{ advanceId: 'a', amount: 500 }]);
  });
});
