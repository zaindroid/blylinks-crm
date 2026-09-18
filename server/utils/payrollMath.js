// The salary formula, kept free of any database or HTTP so it can be tested and audited on its own.
//
//   per-day rate     = monthly base salary / 24
//   earned base      = per-day rate x working days
//   tardy deduction  = (number of weeks with 3+ tardies) x half a day's pay
//   gross            = earned base + commission + bonus
//   advance recovery = the lesser of (outstanding advances) and (what is left after other deductions),
//                      so an advance can never push pay below zero -- any remainder stays outstanding
//                      and is recovered from the next payroll
//   net              = gross - tardy deduction - other deductions - advance recovery

const DAYS_IN_PAY_MONTH = 24;
const TARDIES_PER_PENALTY_WEEK = 3;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

function computePayroll({
  baseSalary = 0,
  workingDays = 0,
  commission = 0,
  bonus = 0,
  otherDeductions = 0,
  tardyWeeks = 0,
  outstandingAdvances = 0
}) {
  const perDay = round2(money(baseSalary) / DAYS_IN_PAY_MONTH);
  const earnedBase = round2(perDay * Math.max(0, money(workingDays)));
  const tardyDeduction = round2(Math.max(0, money(tardyWeeks)) * (perDay / 2));
  const gross = round2(earnedBase + money(commission) + money(bonus));
  const afterOtherDeductions = round2(gross - tardyDeduction - money(otherDeductions));
  const advanceDeduction = round2(Math.min(Math.max(0, money(outstandingAdvances)), Math.max(0, afterOtherDeductions)));
  const net = round2(afterOtherDeductions - advanceDeduction);

  return { perDay, earnedBase, tardyDeduction, gross, advanceDeduction, net };
}

// Splits a recovery across advances oldest-first. `advances` is [{ id, outstanding }] already in
// the order they should be recovered; returns [{ advanceId, amount }] for those that receive some.
function allocateRecovery(advances, totalToRecover) {
  let remaining = round2(totalToRecover);
  const out = [];
  for (const adv of advances) {
    if (remaining <= 0) break;
    const take = round2(Math.min(remaining, money(adv.outstanding)));
    if (take > 0) {
      out.push({ advanceId: adv.id, amount: take });
      remaining = round2(remaining - take);
    }
  }
  return out;
}

module.exports = { computePayroll, allocateRecovery, DAYS_IN_PAY_MONTH, TARDIES_PER_PENALTY_WEEK, round2 };
