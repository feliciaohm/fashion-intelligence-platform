import { NextResponse } from "next/server";
import { getProductPerformanceMaster } from "@/lib/masterViews";

export async function GET() {
  return NextResponse.json(getProductPerformanceMaster());
}
