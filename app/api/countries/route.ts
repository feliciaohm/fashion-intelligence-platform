import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
  const query = `
    SELECT
      country,
      COUNT(*) AS events,
      SUM(revenue) AS total_revenue
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events\`
    GROUP BY country
  `;

  const [rows] = await bigquery.query({ query });

  return NextResponse.json(rows);
}
