import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Luxury-fashion rule of thumb: retail margin under 50% is flagged for review.
const MARGIN_THRESHOLD_PCT = 50;

export async function GET() {
  const productsQuery = `
    SELECT * FROM \`${PROJECT}.product_lifecycle\` ORDER BY revenue_direct DESC
  `;
  const trendQuery = `
    SELECT
      product_slug,
      FORMAT_TIMESTAMP('%Y-%m', event_timestamp) AS month,
      SUM(revenue) AS revenue
    FROM \`${PROJECT}.sales_events\`
    WHERE event_name = 'purchase' AND revenue > 0
    GROUP BY product_slug, month
    ORDER BY month
  `;

  try {
    const [[products], [trendRows]] = await Promise.all([
      bigquery.query(productsQuery),
      bigquery.query(trendQuery),
    ]);

    const months = Array.from(new Set(trendRows.map((r: any) => r.month))).sort() as string[];
    const recentMonths = months.slice(-3);

    const trendByProduct: Record<string, Record<string, number>> = {};
    trendRows.forEach((r: any) => {
      if (!trendByProduct[r.product_slug]) trendByProduct[r.product_slug] = {};
      trendByProduct[r.product_slug][r.month] = r.revenue;
    });

    const enriched = products.map((p: any) => ({
      ...p,
      below_threshold: p.retail_margin_pct < MARGIN_THRESHOLD_PCT,
      trend: recentMonths.map((m) => ({
        month: m,
        revenue: trendByProduct[p.product_slug]?.[m] ?? 0,
      })),
    }));

    return NextResponse.json({
      marginThresholdPct: MARGIN_THRESHOLD_PCT,
      recentMonths,
      products: enriched,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
