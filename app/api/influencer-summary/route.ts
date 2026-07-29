import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");

  const query = `
    SELECT
      influencer,
      COUNT(*) AS campaign_count,
      SUM(gifted_cost) AS total_gifted_cost,
      SUM(purchases) AS total_purchases,
      SUM(total_revenue) AS total_revenue,
      ROUND(AVG(roi_pct), 1) AS avg_roi_pct,
      STRING_AGG(DISTINCT product_slug, ', ') AS products,
      STRING_AGG(DISTINCT platform, ', ') AS platforms
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
    WHERE @country IS NULL OR country = @country
    GROUP BY influencer
    ORDER BY avg_roi_pct DESC
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: { country },
      types: { country: "STRING" },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
