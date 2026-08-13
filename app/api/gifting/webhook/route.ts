import { NextResponse } from "next/server";
import { readGiftingSheetUrls } from "@/lib/gifting-server";

// Real instant-push endpoint for Google Apps Script's onEdit trigger (free,
// built into every Google account -- see the setup snippet given to the
// user). Google's script calls this the moment a cell changes, instead of
// waiting for the page's 60-second poll (app/gifting-roi/page.tsx). This
// only works once the app is reachable at a public URL -- Apps Script runs
// in Google's cloud and can't reach localhost. Until then this route is
// simply unused; the polling fallback keeps working regardless.
//
// Exempted from the session-cookie gate in proxy.ts (Apps Script can't
// carry a browser session), so it checks its own shared-secret token
// instead -- the same pattern real webhook providers (Stripe, GitHub) use.
// Never logged, never returned in any response.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const expected = process.env.GIFTING_WEBHOOK_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const { sheet } = await req.json().catch(() => ({ sheet: null }));
  if (sheet !== "gifts" && sheet !== "posts") {
    return NextResponse.json({ error: "sheet must be 'gifts' or 'posts'" }, { status: 400 });
  }

  const urls = readGiftingSheetUrls();
  const sheetUrl = sheet === "gifts" ? urls.giftsSheetUrl : urls.postsSheetUrl;
  if (!sheetUrl) {
    return NextResponse.json({ error: `No ${sheet} sheet has been connected yet` }, { status: 400 });
  }

  const base = new URL(req.url).origin;
  const importRoute = sheet === "gifts" ? "/api/gifting/import-gifts" : "/api/gifting/import-posts";
  const res = await fetch(`${base}${importRoute}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetUrl }),
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
