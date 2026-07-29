import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  const channelQuery = `
    SELECT *
    FROM \`${PROJECT}.finance_channel\`
    ORDER BY quarter, channel
  `;

  const waterfallQuery = `
    WITH revenue_cogs AS (
      SELECT SUM(revenue_actual) AS revenue, SUM(cogs) AS cogs
      FROM \`${PROJECT}.finance_channel\`
    ),
    returns_total AS (
      SELECT SUM(refund_amount) AS returns
      FROM \`${PROJECT}.returns\`
    ),
    gifting_total AS (
      SELECT SUM(gifted_cost) AS gifting
      FROM \`${PROJECT}.influencer_product_performance\`
    )
    SELECT
      rc.revenue,
      rc.cogs,
      rt.returns,
      gt.gifting,
      rc.revenue - rc.cogs - rt.returns - gt.gifting AS net_margin
    FROM revenue_cogs rc, returns_total rt, gifting_total gt
  `;

  try {
    const [[channels], [waterfallRows]] = await Promise.all([
      bigquery.query(channelQuery),
      bigquery.query(waterfallQuery),
    ]);
    return NextResponse.json({ channels, waterfall: waterfallRows[0] });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
