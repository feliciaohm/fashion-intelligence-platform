import { NextResponse } from "next/server";
import { getQuickMetrics } from "@/lib/quick-metrics-server";

export async function GET() {
  try {
    const data = await getQuickMetrics();
    return NextResponse.json(data);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
