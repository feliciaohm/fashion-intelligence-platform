import { NextResponse } from "next/server";
import { getPostVisitorSummaries, getAllVisitorJourneys, ATTRIBUTION_WINDOW_HOURS } from "@/lib/visitor-journey-server";

export async function GET() {
  try {
    const [summaries, journeys] = await Promise.all([getPostVisitorSummaries(), getAllVisitorJourneys()]);
    return NextResponse.json({ summaries, journeys, attributionWindowHours: ATTRIBUTION_WINDOW_HOURS });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
