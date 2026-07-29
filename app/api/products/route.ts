import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");

  const query = `
    SELECT *
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.product_full_stack\`
    WHERE @country IS NULL OR influencer_country LIKE CONCAT('%', @country, '%')
    LIMIT 500
  `;

  const [rows] = await bigquery.query({
    query,
    params: { country },
    types: { country: "STRING" },
  });

  return NextResponse.json(rows);
}
