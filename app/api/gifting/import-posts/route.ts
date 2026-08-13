import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { bigquery } from "@/lib/bigquery";
import { writeGiftingSheetUrls } from "@/lib/gifting-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

function toCsvExportUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Could not find a spreadsheet ID in that URL");
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

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
  // See the matching comment in import-gifts/route.ts -- local date
  // components, not toISOString(), to avoid a UTC-conversion day shift.
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
    // raw: false renders each cell as its displayed text instead of the raw
    // value -- see the matching comment in import-gifts/route.ts for why.
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, unknown>[];

    const now = new Date().toISOString();
    const rows = rawRows
      .map((r) => {
        const influencer = pick(r, "influencer", "influencer name");
        const datePosted = toIsoDate(pick(r, "date posted", "date"));
        if (!influencer || !datePosted) return null;
        return {
          post_id: randomUUID(),
          influencer,
          date_posted: datePosted,
          time_posted: pick(r, "time posted", "time"),
          post_type: pick(r, "post type", "type"),
          platform: pick(r, "platform"),
          synced_at: now,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      throw new Error("No usable rows found. Make sure the sheet has columns for Influencer and Date Posted.");
    }

    await bigquery.query(`DELETE FROM \`${PROJECT}.posting_log\` WHERE TRUE`);
    await bigquery.dataset("analytics_lab").table("posting_log").insert(rows);
    writeGiftingSheetUrls({ postsSheetUrl: sheetUrl });

    return NextResponse.json({ ok: true, rowCount: rows.length, skipped: rawRows.length - rows.length });
  } catch (error) {
    console.error("POSTING SHEET IMPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to import posting sheet", details: String(error) }, { status: 400 });
  }
}
