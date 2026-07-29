import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

function addMonth(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Average month-over-month growth rate across whatever consecutive data points
// exist (the dataset has real gaps, e.g. ecommerce has no purchases in some
// months) -- clamped to +/-50% so a single sparse-data jump can't blow up a
// 3-month compounding projection.
function trendGrowthRate(series: { month: string; revenue: number }[]): number {
  const sorted = [...series].sort((a, b) => (a.month < b.month ? -1 : 1));
  const changes: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].revenue > 0) {
      changes.push(sorted[i].revenue / sorted[i - 1].revenue - 1);
    }
  }
  if (changes.length === 0) return 0;
  const avg = changes.reduce((s, c) => s + c, 0) / changes.length;
  return Math.max(-0.5, Math.min(0.5, avg));
}

export async function GET() {
  try {
    const [rows] = await bigquery.query(
      `SELECT * FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month`
    );

    const channels = Array.from(new Set(rows.map((r: any) => r.channel))) as string[];
    const latestMonth = rows.reduce((max: string, r: any) => (r.month > max ? r.month : max), rows[0]?.month ?? "");

    const forecast = channels.map((channel) => {
      const series = rows
        .filter((r: any) => r.channel === channel)
        .map((r: any) => ({ month: r.month, revenue: r.revenue_actual }));
      const sorted = [...series].sort((a, b) => (a.month < b.month ? -1 : 1));
      const lastActual = sorted[sorted.length - 1]?.revenue ?? 0;
      const growthRate = trendGrowthRate(series);

      const projections = [1, 2, 3].map((i) => {
        const base = lastActual * Math.pow(1 + growthRate, i);
        return {
          month: addMonth(latestMonth, i),
          conservative: Math.round(base * 0.85),
          base: Math.round(base),
          optimistic: Math.round(base * 1.15),
        };
      });

      return {
        channel,
        lastActual,
        growthRatePct: Math.round(growthRate * 1000) / 10,
        history: sorted,
        projections,
      };
    });

    const totals = [1, 2, 3].map((i, idx) => ({
      month: forecast[0]?.projections[idx]?.month,
      conservative: forecast.reduce((s, f) => s + f.projections[idx].conservative, 0),
      base: forecast.reduce((s, f) => s + f.projections[idx].base, 0),
      optimistic: forecast.reduce((s, f) => s + f.projections[idx].optimistic, 0),
    }));

    return NextResponse.json({ latestMonth, channels: forecast, totals });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
