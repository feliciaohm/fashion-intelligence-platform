import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET() {
  const query = `
    SELECT *
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.session_level_model\`
  `;

  const [rows] = await bigquery.query({ query });

  return NextResponse.json(rows);
}
