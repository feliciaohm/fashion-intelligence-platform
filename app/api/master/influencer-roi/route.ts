import { NextResponse } from "next/server";
import { getInfluencerRoiMaster } from "@/lib/masterViews";

export async function GET() {
  return NextResponse.json(getInfluencerRoiMaster());
}
