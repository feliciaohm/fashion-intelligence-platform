import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const DISCOUNT_RATE = 0.1;
const YEARS = 5;

function npvAtRate(rate: number, setupCost: number, netAnnualCashFlow: number): number {
  let npv = -setupCost;
  for (let t = 1; t <= YEARS; t++) npv += netAnnualCashFlow / Math.pow(1 + rate, t);
  return npv;
}

// Bisection: NPV(r) is monotonically decreasing in r for this cash-flow
// shape (one outflow at t=0, constant positive inflows after), so a unique
// root exists whenever NPV(0) > 0 and NPV(high rate) < 0.
function solveIrr(setupCost: number, netAnnualCashFlow: number): number | null {
  if (netAnnualCashFlow <= 0) return null;
  let lo = -0.99;
  let hi = 10;
  let npvLo = npvAtRate(lo, setupCost, netAnnualCashFlow);
  let npvHi = npvAtRate(hi, setupCost, netAnnualCashFlow);
  if (npvLo <= 0 || npvHi >= 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npvAtRate(mid, setupCost, netAnnualCashFlow);
    if (Math.abs(npvMid) < 1) return mid;
    if (npvMid > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

async function getComparableAvgAnnualRevenue() {
  const [rows] = await bigquery.query(
    `SELECT AVG(revenue) AS avg_monthly FROM \`${PROJECT}.store_performance\``
  );
  return Math.round((rows[0]?.avg_monthly ?? 0) * 12);
}

export async function GET() {
  try {
    const comparableStoreAvgAnnualRevenue = await getComparableAvgAnnualRevenue();
    return NextResponse.json({ comparableStoreAvgAnnualRevenue });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { city, annualRevenue, setupCost, annualOperatingCost } = await req.json();

  if (!city || !annualRevenue || !setupCost || annualOperatingCost === undefined) {
    return NextResponse.json(
      { error: "city, annualRevenue, setupCost, and annualOperatingCost are required" },
      { status: 400 }
    );
  }

  try {
    const comparableStoreAvgAnnualRevenue = await getComparableAvgAnnualRevenue();

    const netAnnualCashFlow = annualRevenue - annualOperatingCost;
    const npv = npvAtRate(DISCOUNT_RATE, setupCost, netAnnualCashFlow);
    const paybackMonths = netAnnualCashFlow > 0 ? Math.round((setupCost / netAnnualCashFlow) * 12) : null;
    const irr = solveIrr(setupCost, netAnnualCashFlow);
    const createsValue = npv > 0;

    const methodology = [
      `Net annual cash flow = estimated annual revenue (€${annualRevenue.toLocaleString()}) − annual operating cost (€${annualOperatingCost.toLocaleString()}) = €${netAnnualCashFlow.toLocaleString()}/year. Held constant across all ${YEARS} years — this is a simplified model, not a ramp-curve projection like the Store Viability calculator above.`,
      `NPV = −setup cost + Σ (net annual cash flow ÷ (1 + ${(DISCOUNT_RATE * 100).toFixed(0)}%)^year) for years 1–${YEARS}, using a ${(DISCOUNT_RATE * 100).toFixed(0)}% discount rate — a standard corporate-finance hurdle rate, not derived from this dataset. Result: €${Math.round(npv).toLocaleString()}. ${createsValue ? "Positive NPV means the investment is projected to create more value than the discount rate requires." : "Negative NPV means the investment is projected to destroy value at this discount rate — the discounted returns don't clear the 10% hurdle."}`,
      paybackMonths !== null
        ? `Simple payback period (undiscounted): setup cost ÷ (net annual cash flow ÷ 12) = ${paybackMonths} months. This ignores the time value of money — NPV above is the more rigorous figure.`
        : `Payback period is undefined: net annual cash flow is zero or negative, so the investment never pays back at this revenue/cost level.`,
      irr !== null
        ? `IRR (the discount rate at which NPV = 0), found by numerical solving: ${(irr * 100).toFixed(1)}%. Compare this to the ${(DISCOUNT_RATE * 100).toFixed(0)}% discount rate used above — IRR ${irr > DISCOUNT_RATE ? "exceeding" : "falling short of"} it agrees with the NPV sign.`
        : `IRR could not be computed (cash flows never produce a break-even discount rate in a reasonable range) — this happens when the investment never generates enough positive cash flow to recover the setup cost at all.`,
      `For reference, existing Maison Lumière stores average €${comparableStoreAvgAnnualRevenue.toLocaleString()}/year in real revenue — a real comparable figure, shown for context, not used directly in this calculation since you supplied your own revenue estimate for ${city}.`,
    ];

    return NextResponse.json({
      inputs: { city, annualRevenue, setupCost, annualOperatingCost },
      netAnnualCashFlow,
      npv: Math.round(npv),
      paybackMonths,
      irrPct: irr !== null ? Math.round(irr * 1000) / 10 : null,
      createsValue,
      comparableStoreAvgAnnualRevenue,
      discountRatePct: DISCOUNT_RATE * 100,
      years: YEARS,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
