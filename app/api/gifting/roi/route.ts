import { NextResponse } from "next/server";
import { getGiftingRoi, readGiftingSheetUrls } from "@/lib/gifting-server";

export async function GET() {
  try {
    const { rows, windowDays } = await getGiftingRoi();
    const { giftsSheetUrl, postsSheetUrl } = readGiftingSheetUrls();
    return NextResponse.json({
      rows,
      windowDays,
      connected: { gifts: Boolean(giftsSheetUrl), posts: Boolean(postsSheetUrl) },
    });
  } catch (error) {
    console.error("GIFTING ROI ERROR:", error);
    return NextResponse.json({ error: "Failed to compute gifting ROI", details: String(error) }, { status: 500 });
  }
}
