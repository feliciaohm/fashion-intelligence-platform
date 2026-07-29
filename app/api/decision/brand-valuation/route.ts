import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const PROJECTION_YEARS = 5;
// The real observed growth rate reflects a temporary wholesale reorder ramp
// (Sept-Nov 2026, documented elsewhere in this platform) and is not a
// sustainable long-run rate -- the prefilled suggestion is capped so a DCF
// isn't built on a launch-ramp number extrapolated for 5 years.
const GROWTH_RATE_CAP_PCT = 25;

export async function GET() {
  try {
    const [monthRows] = await bigquery.query(
      `SELECT month, SUM(revenue_actual) AS revenue FROM \`${PROJECT}.finance_channel_monthly\` GROUP BY month ORDER BY month`
    );
    const [cogsRows] = await bigquery.query(
      `SELECT SAFE_DIVIDE(SUM(cost_price), SUM(retail_price)) AS ratio FROM \`${PROJECT}.product_lifecycle\``
    );
    const [returnsRows] = await bigquery.query(`SELECT SUM(refund_amount) AS total FROM \`${PROJECT}.returns\``);
    const [giftedRows] = await bigquery.query(`SELECT SUM(gifted_cost) AS total FROM \`${PROJECT}.influencer_product_performance\``);
    const [costCenterRows] = await bigquery.query(
      `SELECT SUM(actual) AS total FROM \`${PROJECT}.cost_centers\``
    );

    const totalRevenue = monthRows.reduce((s: number, r: any) => s + r.revenue, 0);
    const monthsObserved = monthRows.length;
    // Annualize the observed ~10-month revenue window to a full-year run rate.
    const annualRevenueRunRate = Math.round(totalRevenue * (12 / monthsObserved));

    const cogsRatio = cogsRows[0]?.ratio ?? 0;
    const totalReturns = returnsRows[0]?.total ?? 0;
    const totalGifted = giftedRows[0]?.total ?? 0;
    const totalOpex = costCenterRows[0]?.total ?? 0;

    const cogs = totalRevenue * cogsRatio;
    const ebitda = totalRevenue - cogs - totalReturns - totalGifted - totalOpex;
    const ebitdaMarginPct = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const annualEbitdaRunRate = Math.round(ebitda * (12 / monthsObserved));

    // Real recent monthly growth (same window/method as the Monte Carlo
    // forecast), then capped for use as a DCF input specifically.
    const recent = monthRows.slice(-6);
    const growthRates: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      if (recent[i - 1].revenue > 0) growthRates.push(recent[i].revenue / recent[i - 1].revenue - 1);
    }
    const meanMonthlyGrowth = growthRates.length > 0 ? growthRates.reduce((s, g) => s + g, 0) / growthRates.length : 0;
    const rawAnnualGrowthPct = (Math.pow(1 + meanMonthlyGrowth, 12) - 1) * 100;
    const suggestedGrowthRatePct = Math.max(-20, Math.min(GROWTH_RATE_CAP_PCT, Math.round(rawAnnualGrowthPct * 10) / 10));

    return NextResponse.json({
      annualRevenueRunRate,
      annualEbitdaRunRate,
      ebitdaMarginPct: Math.round(ebitdaMarginPct * 10) / 10,
      rawAnnualGrowthPct: Math.round(rawAnnualGrowthPct * 10) / 10,
      suggestedGrowthRatePct,
      growthRateCappedNote: rawAnnualGrowthPct > GROWTH_RATE_CAP_PCT,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { revenueGrowthPct, ebitdaMarginPct, discountRatePct, terminalGrowthPct } = await req.json();

  if (
    revenueGrowthPct === undefined ||
    ebitdaMarginPct === undefined ||
    discountRatePct === undefined ||
    terminalGrowthPct === undefined
  ) {
    return NextResponse.json({ error: "revenueGrowthPct, ebitdaMarginPct, discountRatePct, and terminalGrowthPct are required" }, { status: 400 });
  }
  if (terminalGrowthPct >= discountRatePct) {
    return NextResponse.json({ error: "Terminal growth rate must be below the discount rate, or the Gordon Growth terminal value formula diverges." }, { status: 400 });
  }

  try {
    const [monthRows] = await bigquery.query(
      `SELECT month, SUM(revenue_actual) AS revenue FROM \`${PROJECT}.finance_channel_monthly\` GROUP BY month ORDER BY month`
    );
    const totalRevenue = monthRows.reduce((s: number, r: any) => s + r.revenue, 0);
    const monthsObserved = monthRows.length;
    const baseRevenue = totalRevenue * (12 / monthsObserved);

    const g = revenueGrowthPct / 100;
    const margin = ebitdaMarginPct / 100;
    const r = discountRatePct / 100;
    const tg = terminalGrowthPct / 100;

    const years = Array.from({ length: PROJECTION_YEARS }, (_, i) => {
      const year = i + 1;
      const revenue = baseRevenue * Math.pow(1 + g, year);
      const fcf = revenue * margin;
      const pv = fcf / Math.pow(1 + r, year);
      return { year, revenue: Math.round(revenue), fcf: Math.round(fcf), pv: Math.round(pv) };
    });

    const finalYearFcf = years[years.length - 1].fcf;
    const terminalValue = (finalYearFcf * (1 + tg)) / (r - tg);
    const pvTerminalValue = terminalValue / Math.pow(1 + r, PROJECTION_YEARS);

    const sumPvFcf = years.reduce((s, y) => s + y.pv, 0);
    const enterpriseValue = sumPvFcf + pvTerminalValue;

    const impliedRevenueMultiple = baseRevenue > 0 ? enterpriseValue / baseRevenue : 0;
    const currentEbitda = baseRevenue * margin;
    const impliedEbitdaMultiple = currentEbitda > 0 ? enterpriseValue / currentEbitda : 0;

    const methodology = [
      `Free cash flow is approximated as Revenue × EBITDA margin each year — a standard simplification for this kind of illustrative valuation that ignores capex, tax, and working-capital changes (a full PE-grade DCF would model those separately; this shows the same discounting mechanics with fewer moving parts).`,
      `Starting revenue (€${Math.round(baseRevenue).toLocaleString()}/year) is Maison Lumière's real ${monthsObserved}-month revenue annualized to a full-year run rate. Years 1–${PROJECTION_YEARS} compound forward at your ${revenueGrowthPct}% growth input.`,
      `Terminal value (the value of all cash flows beyond year ${PROJECTION_YEARS}) uses the Gordon Growth Model: Year ${PROJECTION_YEARS} FCF × (1 + terminal growth) ÷ (discount rate − terminal growth) = €${Math.round(terminalValue).toLocaleString()}, then discounted back to today at €${Math.round(pvTerminalValue).toLocaleString()}.`,
      `Enterprise Value = the sum of discounted Years 1–${PROJECTION_YEARS} FCF (€${sumPvFcf.toLocaleString()}) + discounted terminal value (€${Math.round(pvTerminalValue).toLocaleString()}) = €${Math.round(enterpriseValue).toLocaleString()}. Terminal value is ${Math.round((pvTerminalValue / enterpriseValue) * 100)}% of the total — typical for a DCF (most of the value sits beyond the explicit forecast window), but also means the valuation is highly sensitive to the terminal growth and discount rate assumptions.`,
      `Implied multiples let you sanity-check this DCF output against how fashion/luxury acquisitions are actually priced in practice (typically quoted as a revenue or EBITDA multiple): ${impliedRevenueMultiple.toFixed(1)}× current annualized revenue, ${impliedEbitdaMultiple.toFixed(1)}× current annualized EBITDA.`,
    ];

    return NextResponse.json({
      inputs: { revenueGrowthPct, ebitdaMarginPct, discountRatePct, terminalGrowthPct },
      baseRevenue: Math.round(baseRevenue),
      years,
      terminalValue: Math.round(terminalValue),
      pvTerminalValue: Math.round(pvTerminalValue),
      sumPvFcf,
      enterpriseValue: Math.round(enterpriseValue),
      impliedRevenueMultiple: Math.round(impliedRevenueMultiple * 100) / 100,
      impliedEbitdaMultiple: Math.round(impliedEbitdaMultiple * 100) / 100,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
