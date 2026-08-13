import { NextResponse } from "next/server";
import { getGmroiSummary } from "@/lib/gmroi-server";

export async function GET() {
  try {
    const summary = await getGmroiSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
