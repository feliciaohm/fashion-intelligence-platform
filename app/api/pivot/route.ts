import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

// Whitelist of queryable sources/dimensions/measures — the API never interpolates
// raw client input into SQL, only values that match this fixed list, so there's no
// injection surface even though the query is built dynamically.
export const SOURCES: Record<string, { table: string; dimensions: string[]; measures: string[] }> = {
  "Influencer Campaigns": {
    table: "influencer_journey_master",
    dimensions: ["influencer", "product_slug", "country", "platform"],
    measures: ["revenue_attributed", "first_visitors_48h", "return_visitors", "purchases", "gifted_cost"],
  },
  Products: {
    table: "product_full_stack",
    dimensions: ["category", "collection", "color"],
    measures: ["price", "retail_revenue", "ecommerce_revenue", "influencer_revenue"],
  },
  Customers: {
    table: "crm_customers",
    dimensions: ["segment", "country"],
    measures: ["lifetime_value", "order_count"],
  },
  "Cost Centers": {
    table: "cost_centers",
    dimensions: ["name", "period"],
    measures: ["budget", "actual", "variance"],
  },
  Returns: {
    table: "returns",
    dimensions: ["reason", "product_slug", "influencer_campaign"],
    measures: ["refund_amount"],
  },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") ?? "";
  const dimension = searchParams.get("dimension") ?? "";
  const measure = searchParams.get("measure") ?? "";

  const config = SOURCES[source];
  if (!config || !config.dimensions.includes(dimension) || !config.measures.includes(measure)) {
    return NextResponse.json({ error: "Invalid source, dimension, or measure" }, { status: 400 });
  }

  const query = `
    SELECT ${dimension} AS dimension, SUM(${measure}) AS value, COUNT(*) AS row_count
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.${config.table}\`
    WHERE ${dimension} IS NOT NULL
    GROUP BY dimension
    ORDER BY value DESC
    LIMIT 100
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
