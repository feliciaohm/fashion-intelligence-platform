export function simulateMarketingSpend(spendIncreasePct: number) {
  const baseRevenue = 250000;
  const multiplier = 1 + spendIncreasePct / 100 * 0.6;
  return Math.round(baseRevenue * multiplier);
}
