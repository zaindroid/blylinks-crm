// The agent picks exactly one Sale Type on the order form -- Electric, Gas, or Electric and Gas.
// "Electric and Gas" is two utility enrollments in one submission, so it counts as 2 sales; the
// other two options (and any legacy sale from before this field existed) count as 1. This is the
// counting basis for every "number of sales" metric (leaderboard, dashboard totals, performance
// report), not for record/queue counts (QA review queue, CSV row counts), which still mean "one
// submission" regardless of sale type.
export function saleUnitCount(sale) {
  return sale?.saleType === 'Electric and Gas' ? 2 : 1;
}

export function sumSaleUnits(sales) {
  return sales.reduce((total, s) => total + saleUnitCount(s), 0);
}
