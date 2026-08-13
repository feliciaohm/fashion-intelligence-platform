import { NextResponse } from "next/server";
import { getEoqSummary } from "@/lib/eoq-server";

export async function POST(req: Request) {
  const { category } = await req.json();
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  try {
    const summary = await getEoqSummary(category);
    if ("error" in summary) {
      return NextResponse.json({ error: summary.error }, { status: 400 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
