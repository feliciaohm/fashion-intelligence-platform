import { NextResponse } from "next/server";
import { getSellThroughSummary } from "@/lib/sell-through-server";

export async function GET() {
  try {
    const summary = await getSellThroughSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
