import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const query = `
    SELECT *
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.product_full_stack\`
    WHERE product_slug = @slug
  `;

  const [rows] = await bigquery.query({ query, params: { slug } });

  return NextResponse.json(rows[0] ?? null);
}
