import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
  const query = `
    SELECT
      influencer,
      product_slug,
      gifted_cost,
      purchases,
      total_revenue,
      roi_pct,
      platform,
      content_type,
      country,
      post_date
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
    ORDER BY roi_pct DESC
  `;

  try {
    const [rows] = await bigquery.query({ query });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
