import { NextResponse } from "next/server";
import { readGiftingSheetUrls } from "@/lib/gifting-server";

// Re-runs both sheet imports using whichever URLs were last connected, so
// the "Refresh Now" button (and the page's own auto-poll) can pull the
// sheets' current state without asking her to paste the URLs in again.
// This is genuinely real re-sync -- Google's CSV export always reflects
// the sheet's live content, so a fresh fetch here picks up any row she
// added or edited seconds ago. It is polling, not a push subscription:
// nothing happens until this route runs, which is why the page polls it
// on an interval rather than claiming instant updates.
export async function POST(req: Request) {
  const { giftsSheetUrl, postsSheetUrl } = await readGiftingSheetUrls();
  const base = new URL(req.url).origin;
  const results: Record<string, unknown> = {};

  if (giftsSheetUrl) {
    const res = await fetch(`${base}/api/gifting/import-gifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({ sheetUrl: giftsSheetUrl }),
    });
    results.gifts = await res.json();
  }
  if (postsSheetUrl) {
    const res = await fetch(`${base}/api/gifting/import-posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({ sheetUrl: postsSheetUrl }),
    });
    results.posts = await res.json();
  }

  if (!giftsSheetUrl && !postsSheetUrl) {
    return NextResponse.json({ error: "No sheets connected yet — import each one at least once first." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, results });
}
