import { NextResponse } from "next/server";
import { getMarketPerformanceMaster } from "@/lib/masterViews";

export async function GET() {
  return NextResponse.json(getMarketPerformanceMaster());
}
