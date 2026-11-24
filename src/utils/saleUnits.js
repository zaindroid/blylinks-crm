// A sale with ONLY electric account info, or ONLY gas account info, is 1 sale. A sale with BOTH
// is 2 sales -- two separate utility enrollments submitted together. This is the counting basis
// for every "number of sales" metric (leaderboard, dashboard totals, performance report), not for
// record/queue counts (QA review queue, CSV row counts), which still mean "one submission".
export function saleUnitCount(sale) {
  const hasElectric = Boolean(String(sale?.electricAccountNumber || '').trim());
  const hasGas = Boolean(String(sale?.gasAccountNumber || '').trim());
  return hasElectric && hasGas ? 2 : 1;
}

export function sumSaleUnits(sales) {
  return sales.reduce((total, s) => total + saleUnitCount(s), 0);
}
