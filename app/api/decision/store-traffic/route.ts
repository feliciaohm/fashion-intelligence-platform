import { NextResponse } from "next/server";
import { getStoreTrafficSummary } from "@/lib/store-traffic-server";

export async function GET() {
  try {
    const summary = await getStoreTrafficSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
