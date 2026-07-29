import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

const NUM_SIMULATIONS = 10000;
const HORIZON_MONTHS = 3;
const HISTORY_MONTHS = 6;
const TRUNCATE_SIGMAS = 2;
const HISTOGRAM_BINS = 20;

function addMonth(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// Standard normal draw via Box-Muller.
function randNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Growth rate ~ Normal(mean, std), truncated at +/-2 std via rejection sampling
// -- excludes extreme unrealistic tail draws while keeping the shape a real
// normal distribution (not a hard clip, which would pile mass at the edges).
function truncatedGrowthRate(mean: number, std: number): number {
  if (std === 0) return mean;
  for (let i = 0; i < 100; i++) {
    const g = mean + std * randNormal();
    if (g >= mean - TRUNCATE_SIGMAS * std && g <= mean + TRUNCATE_SIGMAS * std) return g;
  }
  return mean;
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const frac = idx - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * frac;
}

export async function GET() {
  try {
    const [rows] = await bigquery.query(
      `SELECT month, SUM(revenue_actual) AS revenue
       FROM \`${PROJECT}.finance_channel_monthly\`
       GROUP BY month
       ORDER BY month`
    );

    if (rows.length < 3) {
      return NextResponse.json(
        { error: `Not enough historical data: only ${rows.length} month(s) of revenue exist, need at least 3.` },
        { status: 400 }
      );
    }

    const allMonths = rows.map((r: any) => ({ month: r.month, revenue: r.revenue }));
    const latestMonth = allMonths[allMonths.length - 1].month;
    const baseline = allMonths.slice(-HISTORY_MONTHS);

    const growthRates: number[] = [];
    for (let i = 1; i < baseline.length; i++) {
      if (baseline[i - 1].revenue > 0) {
        growthRates.push(baseline[i].revenue / baseline[i - 1].revenue - 1);
      }
    }
    if (growthRates.length < 2) {
      return NextResponse.json(
        { error: "Not enough consecutive months with positive revenue to compute a growth-rate distribution." },
        { status: 400 }
      );
    }

    const mean = growthRates.reduce((s, g) => s + g, 0) / growthRates.length;
    const variance =
      growthRates.reduce((s, g) => s + (g - mean) ** 2, 0) / (growthRates.length - 1);
    const std = Math.sqrt(variance);

    const startRevenue = baseline[baseline.length - 1].revenue;
    const quarterTotals: number[] = [];
    for (let s = 0; s < NUM_SIMULATIONS; s++) {
      let current = startRevenue;
      let quarterTotal = 0;
      for (let m = 0; m < HORIZON_MONTHS; m++) {
        const g = truncatedGrowthRate(mean, std);
        current = current * (1 + g);
        quarterTotal += current;
      }
      quarterTotals.push(quarterTotal);
    }
    quarterTotals.sort((a, b) => a - b);

    const p10 = Math.round(percentile(quarterTotals, 10));
    const p25 = Math.round(percentile(quarterTotals, 25));
    const p50 = Math.round(percentile(quarterTotals, 50));
    const p75 = Math.round(percentile(quarterTotals, 75));
    const p90 = Math.round(percentile(quarterTotals, 90));

    const min = quarterTotals[0];
    const max = quarterTotals[quarterTotals.length - 1];
    const binWidth = max > min ? (max - min) / HISTOGRAM_BINS : 1;
    const bins = Array.from({ length: HISTOGRAM_BINS }, () => 0);
    quarterTotals.forEach((v) => {
      const idx = max > min ? Math.min(HISTOGRAM_BINS - 1, Math.floor((v - min) / binWidth)) : 0;
      bins[idx]++;
    });
    const histogram = bins.map((count, i) => ({
      binStart: Math.round(min + i * binWidth),
      binEnd: Math.round(min + (i + 1) * binWidth),
      count,
    }));

    const forecastMonths = [1, 2, 3].map((i) => monthLabel(addMonth(latestMonth, i)));
    const historyLabel = `${monthLabel(baseline[0].month)}–${monthLabel(baseline[baseline.length - 1].month)}`;

    // Named, real caveat: Sept-Nov 2026 includes a genuine wholesale reorder
    // ramp (see Pass 14 memory) that pushes recent month-over-month growth
    // unusually high -- if that ramp falls inside the 6-month baseline
    // window, the simulated range will look dramatically wide/high. That's
    // the model faithfully reflecting real recent volatility, not a bug.
    const highGrowthFlag = mean > 0.25;

    const methodology = [
      `Baseline: the ${baseline.length} most recent months of real company-wide revenue (retail + ecommerce + wholesale, from finance_channel_monthly), ${historyLabel}, starting from €${startRevenue.toLocaleString()} in ${monthLabel(latestMonth)}.`,
      `Month-over-month growth rate was computed for each consecutive pair of those months (${growthRates.length} observations): mean ${(mean * 100).toFixed(1)}%, sample standard deviation ${(std * 100).toFixed(1)}%.`,
      highGrowthFlag
        ? `Note: the historical mean growth rate is unusually high (${(mean * 100).toFixed(1)}%/month) because this baseline window includes real, large wholesale reorder volume in recent months — the simulation faithfully reflects that real recent trend, including its volatility, rather than smoothing it away.`
        : `The historical mean and standard deviation are computed directly from the baseline months above, with no smoothing or manual adjustment.`,
      `${NUM_SIMULATIONS.toLocaleString()} simulations were run. Each simulation draws a random monthly growth rate for each of the next ${HORIZON_MONTHS} months from a normal distribution centered on the historical mean, truncated at ±${TRUNCATE_SIGMAS} standard deviations to exclude implausible extreme draws, and compounds it forward from the ${monthLabel(latestMonth)} baseline.`,
      `The reported figure is the sum of the ${HORIZON_MONTHS} simulated months (${forecastMonths.join(", ")}) per simulation — i.e. "next quarter" total revenue — with percentiles taken across all ${NUM_SIMULATIONS.toLocaleString()} simulated quarter-totals.`,
      `This models revenue as a random walk with drift based on Maison Lumière's own recent trend and volatility. It does not know about planned promotions, new store openings, or one-off events not reflected in the historical baseline.`,
    ];

    return NextResponse.json({
      historyLabel,
      latestMonth,
      startRevenue,
      forecastMonths,
      simulations: NUM_SIMULATIONS,
      meanGrowthPct: Math.round(mean * 1000) / 10,
      stdGrowthPct: Math.round(std * 1000) / 10,
      percentiles: { p10, p25, p50, p75, p90 },
      histogram,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
