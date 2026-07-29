import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { riskFreeRatePct, marketReturnPct, beta } = await req.json();

  if (riskFreeRatePct === undefined || marketReturnPct === undefined || beta === undefined) {
    return NextResponse.json({ error: "riskFreeRatePct, marketReturnPct, and beta are required" }, { status: 400 });
  }

  const equityRiskPremium = marketReturnPct - riskFreeRatePct;
  const expectedReturnPct = riskFreeRatePct + beta * equityRiskPremium;

  const methodology = [
    `Expected Return = Risk-free rate + Beta × (Market return − Risk-free rate) = ${riskFreeRatePct}% + ${beta} × (${marketReturnPct}% − ${riskFreeRatePct}%) = ${riskFreeRatePct}% + ${beta} × ${equityRiskPremium.toFixed(2)}% = ${expectedReturnPct.toFixed(2)}%.`,
    `Unlike almost every other calculator on this platform, CAPM has no real data from Maison Lumière's own operations to draw on — all three inputs (risk-free rate, market return, beta) are external market/industry benchmarks, not computed from BigQuery. Treat the output the same way: as a benchmark-based estimate, not a company-specific measurement.`,
    `Beta measures volatility relative to the overall market: beta = 1 moves with the market, beta < 1 moves less than the market, beta > 1 moves more. A beta of ${beta} means this business's returns are assumed to move ${beta < 1 ? `less than the market (${Math.round((1 - beta) * 100)}% less sensitive to market swings)` : beta > 1 ? `more than the market (${Math.round((beta - 1) * 100)}% more sensitive to market swings)` : "in line with the market"} — for luxury goods, a resilient/loyal customer base is often cited as a reason for lower-than-market volatility, though this varies a great deal by brand and price tier.`,
    `This expected return is designed to feed the WACC calculator below as the cost of equity input.`,
  ];

  return NextResponse.json({
    inputs: { riskFreeRatePct, marketReturnPct, beta },
    equityRiskPremiumPct: Math.round(equityRiskPremium * 100) / 100,
    expectedReturnPct: Math.round(expectedReturnPct * 100) / 100,
    methodology,
  });
}
