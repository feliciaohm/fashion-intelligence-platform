import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
  const query = `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', event_timestamp) AS month,
      SUM(revenue) AS revenue
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events\`
    WHERE event_name = 'purchase'
    GROUP BY month
    ORDER BY month
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
