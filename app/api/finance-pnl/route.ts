import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
  const query = `
    WITH product_id_crosswalk AS (
      SELECT DISTINCT product_id AS legacy_product_id, product_slug
      FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
    )
    SELECT
      pd.product_slug,
      pd.product_name,
      fp.period,
      fp.revenue,
      fp.cogs,
      fp.gross_margin,
      fp.opex,
      fp.staff_cost,
      fp.marketing_spend,
      fp.net_margin,
      fp.budget_revenue,
      fp.budget_margin,
      fp.variance
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.finance_pnl\` fp
    JOIN product_id_crosswalk x ON fp.product_id = x.legacy_product_id
    JOIN \`project-cb954e13-3b16-432f-aa7.analytics_lab.product_data\` pd ON x.product_slug = pd.product_slug
    ORDER BY fp.period, pd.product_name
  `;

  try {
    const [rows] = await bigquery.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
