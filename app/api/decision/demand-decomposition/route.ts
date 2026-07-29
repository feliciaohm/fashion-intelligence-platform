import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const FORECAST_MONTHS = 3;

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function addMonth(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// OLS regression of ln(revenue) on month index -- an exponential (constant
// monthly growth rate) trend line, fit to every real month available.
function olsLogLinear(points: { t: number; y: number }[]) {
  const n = points.length;
  const sumT = points.reduce((s, p) => s + p.t, 0);
  const sumLnY = points.reduce((s, p) => s + Math.log(p.y), 0);
  const sumTLnY = points.reduce((s, p) => s + p.t * Math.log(p.y), 0);
  const sumT2 = points.reduce((s, p) => s + p.t * p.t, 0);
  const b = (n * sumTLnY - sumT * sumLnY) / (n * sumT2 - sumT * sumT);
  const a = (sumLnY - b * sumT) / n;

  const meanLnY = sumLnY / n;
  const ssTot = points.reduce((s, p) => s + (Math.log(p.y) - meanLnY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (Math.log(p.y) - (a + b * p.t)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return { a, b, rSquared };
}

export async function GET() {
  try {
    const [rows] = await bigquery.query(
      `SELECT month, SUM(revenue_actual) AS revenue FROM \`${PROJECT}.finance_channel_monthly\` GROUP BY month ORDER BY month`
    );

    if (rows.length < 4) {
      return NextResponse.json({ error: "Not enough months of real data to decompose a trend." }, { status: 400 });
    }

    const series = rows.map((r: any, i: number) => ({ t: i, month: r.month, revenue: r.revenue }));
    const { a, b, rSquared } = olsLogLinear(series.map((s) => ({ t: s.t, y: s.revenue })));

    const months = series.map((s) => {
      const trend = Math.exp(a + b * s.t);
      const residualPct = Math.round(((s.revenue / trend - 1) * 1000)) / 10;
      return { month: s.month, monthLabel: monthLabel(s.month), actual: s.revenue, trend: Math.round(trend), residualPct };
    });

    const monthlyGrowthRatePct = Math.round((Math.exp(b) - 1) * 1000) / 10;
    const lastMonth = series[series.length - 1].month;
    const forecastMonths = Array.from({ length: FORECAST_MONTHS }, (_, i) => {
      const t = series.length + i;
      const month = addMonth(lastMonth, i + 1);
      return { month, monthLabel: monthLabel(month), trendOnly: Math.round(Math.exp(a + b * t)) };
    });

    const strongMonths = [...months].filter((m) => m.residualPct > 5).sort((a2, b2) => b2.residualPct - a2.residualPct);
    const weakMonths = [...months].filter((m) => m.residualPct < -5).sort((a2, b2) => a2.residualPct - b2.residualPct);

    const methodology = [
      `This is a classical trend/residual decomposition, not a fitted ARIMA model — a true (S)ARIMA needs multiple full seasonal cycles (2+ years of monthly data) to estimate its parameters reliably, and this dataset only has ${series.length} months, all from a single year. Building one anyway would produce a model that looks sophisticated but is fit to noise.`,
      `Trend is a log-linear regression (constant monthly growth rate ${monthlyGrowthRatePct}%) fit to real company-wide monthly revenue from finance_channel_monthly, R² = ${rSquared.toFixed(3)} (${rSquared > 0.7 ? "the trend explains most of the month-to-month variation" : "a meaningful share of month-to-month variation is NOT explained by a smooth trend — expect the residual pattern below to be large"}).`,
      `Residual (%) = how far each real month landed from the fitted trend line — this is what's shown as "the seasonal pattern." With only one observed year, it is impossible to tell which of these deviations are genuinely recurring seasonality (e.g. a real December luxury spending spike) versus one-off events (like the real Sept–Nov wholesale reorder ramp already documented elsewhere in this platform). Treat the pattern below as "months that ran hot or cold this year," not confirmed seasonality — that requires a second year of data to validate.`,
      `The 3-month forecast extends the trend line only — no seasonal adjustment is applied, specifically because doing so would bake an unvalidated one-year pattern into a forward projection. For a probabilistic range around this trend, see the Monte Carlo Revenue Forecast above.`,
    ];

    return NextResponse.json({
      months,
      monthlyGrowthRatePct,
      rSquared: Math.round(rSquared * 1000) / 1000,
      forecastMonths,
      strongMonths,
      weakMonths,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
