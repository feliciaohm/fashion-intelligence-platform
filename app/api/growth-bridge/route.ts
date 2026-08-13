import { NextResponse } from "next/server";
import { getGrowthBridgeSummary } from "@/lib/growth-bridge-server";

export async function GET() {
  try {
    const summary = await getGrowthBridgeSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
