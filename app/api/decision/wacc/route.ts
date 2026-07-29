import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { equityValue, debtValue, costOfEquityPct, costOfDebtPct, taxRatePct } = await req.json();

  if (
    equityValue === undefined ||
    debtValue === undefined ||
    costOfEquityPct === undefined ||
    costOfDebtPct === undefined ||
    taxRatePct === undefined
  ) {
    return NextResponse.json(
      { error: "equityValue, debtValue, costOfEquityPct, costOfDebtPct, and taxRatePct are required" },
      { status: 400 }
    );
  }
  const totalValue = equityValue + debtValue;
  if (totalValue <= 0) {
    return NextResponse.json({ error: "Equity value plus debt value must be greater than zero" }, { status: 400 });
  }

  const equityWeight = equityValue / totalValue;
  const debtWeight = debtValue / totalValue;
  const afterTaxCostOfDebt = costOfDebtPct * (1 - taxRatePct / 100);
  const waccPct = equityWeight * costOfEquityPct + debtWeight * afterTaxCostOfDebt;

  const methodology = [
    `WACC = (E/V × Re) + (D/V × Rd × (1 − Tax)) = (${(equityWeight * 100).toFixed(1)}% × ${costOfEquityPct}%) + (${(debtWeight * 100).toFixed(1)}% × ${costOfDebtPct}% × (1 − ${taxRatePct}%)) = ${(equityWeight * costOfEquityPct).toFixed(2)}% + ${(debtWeight * afterTaxCostOfDebt).toFixed(2)}% = ${waccPct.toFixed(2)}%.`,
    `E/V (${(equityWeight * 100).toFixed(1)}%) and D/V (${(debtWeight * 100).toFixed(1)}%) are the equity and debt shares of total capitalization (€${equityValue.toLocaleString()} equity + €${debtValue.toLocaleString()} debt = €${totalValue.toLocaleString()}) — both are figures you provide, not derived from Maison Lumière's real financials (this platform has no real balance-sheet or capital-structure table).`,
    `Debt is tax-advantaged relative to equity because interest payments are tax-deductible, which is why the cost of debt is multiplied by (1 − tax rate) but the cost of equity isn't.`,
    `What this means for investment decisions: WACC is the minimum return any investment (a new store, a market entry, an acquisition) needs to clear to be worth funding — it's the "hurdle rate." A project returning less than ${waccPct.toFixed(1)}% destroys value even if it's profitable in absolute terms, because the capital could have earned ${waccPct.toFixed(1)}% doing something else at the same risk.`,
    `This WACC is designed to automatically replace the Brand Valuation (DCF) calculator's discount rate above, once calculated — the two are wired together on this page.`,
  ];

  return NextResponse.json({
    inputs: { equityValue, debtValue, costOfEquityPct, costOfDebtPct, taxRatePct },
    equityWeightPct: Math.round(equityWeight * 1000) / 10,
    debtWeightPct: Math.round(debtWeight * 1000) / 10,
    afterTaxCostOfDebtPct: Math.round(afterTaxCostOfDebt * 100) / 100,
    waccPct: Math.round(waccPct * 100) / 100,
    methodology,
  });
}
