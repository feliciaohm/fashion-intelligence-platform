import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { bigquery } from "@/lib/bigquery";
import { writeGiftingSheetUrls } from "@/lib/gifting-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Same public-CSV-export technique as the general Google Sheets integration
// (app/api/integrations/google-sheets/import/route.ts) -- no OAuth, works
// for any sheet shared as "Anyone with the link can view". This route is
// separate because it maps specific columns into a real, structured
// gifting_log table instead of dumping arbitrary JSON.
function toCsvExportUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Could not find a spreadsheet ID in that URL");
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

// Tolerant of header casing/spacing (e.g. "Date Gifted", "date_gifted",
// "Gift Cost") since a hand-maintained sheet won't always match exactly.
function pick(row: Record<string, unknown>, ...names: string[]): string | null {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase().replace(/[\s_]/g, "") === name.toLowerCase().replace(/[\s_]/g, ""));
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  // Local date components, not toISOString().slice(0,10) -- that converts
  // through UTC, which silently rolls the date back a day whenever the
  // server's local timezone is ahead of UTC (confirmed directly: "2/8/26"
  // parsed as local midnight came back as "2026-02-07" via toISOString).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  const { sheetUrl } = await req.json();
  if (!sheetUrl || typeof sheetUrl !== "string") {
    return NextResponse.json({ error: "sheetUrl is required" }, { status: 400 });
  }

  try {
    const exportUrl = toCsvExportUrl(sheetUrl);
    const csvRes = await fetch(exportUrl);
    if (!csvRes.ok) {
      throw new Error(
        `Google Sheets returned ${csvRes.status} — the sheet must be shared as "Anyone with the link can view".`
      );
    }
    const csvText = await csvRes.text();
    const wb = XLSX.read(csvText, { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // raw: false renders each cell as its displayed text (e.g. "2026-02-08")
    // instead of the raw value -- without it, a column Google Sheets
    // recognizes as a real date exports as an Excel date *serial number*
    // (e.g. 46061.04...) that toIsoDate() can't parse, silently dropping
    // every row. Confirmed directly against a real exported sheet.
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, unknown>[];

    const now = new Date().toISOString();
    const rows = rawRows
      .map((r) => {
        const influencer = pick(r, "influencer", "influencer name");
        const productName = pick(r, "product", "product name");
        const dateGifted = toIsoDate(pick(r, "date gifted", "date"));
        if (!influencer || !productName || !dateGifted) return null;
        return {
          gift_id: randomUUID(),
          influencer,
          product_name: productName,
          cost: Number(pick(r, "cost", "gift cost", "price") ?? 0) || 0,
          date_gifted: dateGifted,
          notes: pick(r, "notes", "comment"),
          synced_at: now,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      throw new Error(
        "No usable rows found. Make sure the sheet has columns for Influencer, Product, Cost, and Date Gifted."
      );
    }

    // Full replace, not append -- each import reflects the sheet's current
    // state, so removing or editing a row in Google Sheets is reflected here
    // too, not just additions.
    await bigquery.query(`DELETE FROM \`${PROJECT}.gifting_log\` WHERE TRUE`);
    await bigquery.dataset("analytics_lab").table("gifting_log").insert(rows);
    writeGiftingSheetUrls({ giftsSheetUrl: sheetUrl });

    return NextResponse.json({ ok: true, rowCount: rows.length, skipped: rawRows.length - rows.length });
  } catch (error) {
    console.error("GIFTING SHEET IMPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to import gifting sheet", details: String(error) }, { status: 400 });
  }
}
