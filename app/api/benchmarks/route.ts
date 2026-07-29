import { NextResponse } from "next/server";
import { getBenchmarkResults } from "@/lib/benchmarks-server";

export async function GET() {
  try {
    const benchmarks = await getBenchmarkResults();
    return NextResponse.json({ benchmarks });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
