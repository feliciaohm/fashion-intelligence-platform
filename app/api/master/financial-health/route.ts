import { NextResponse } from "next/server";
import { getFinancialHealthMaster } from "@/lib/masterViews";

export async function GET() {
  return NextResponse.json(getFinancialHealthMaster());
}
