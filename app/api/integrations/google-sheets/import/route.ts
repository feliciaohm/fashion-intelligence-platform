import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { bigquery } from "@/lib/bigquery";
import { setIntegrationStatus } from "@/lib/integrations-server";

// No OAuth, no API key -- Google Sheets exposes a real, public CSV export
// endpoint for any sheet shared as "Anyone with the link can view" (or
// published to the web). This is the same technique many real BI tools use
// for a read-only sheet connection. Genuinely real data, genuinely no
// credential required -- but it only works for sheets shared that way; a
// private sheet needs the full OAuth/service-account route instead (out of
// scope here, same as GA4's OAuth path was skipped in favor of a service
// account).
function toCsvExportUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Could not find a spreadsheet ID in that URL");
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
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
        `Google Sheets returned ${csvRes.status} — the sheet must be shared as "Anyone with the link can view" for this to work without OAuth.`
      );
    }
    const csvText = await csvRes.text();

    const wb = XLSX.read(csvText, { type: "string" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

    if (rows.length === 0) {
      throw new Error("No rows found — the sheet appears to be empty.");
    }

    const importId = randomUUID();
    const now = new Date().toISOString();
    const bqRows = rows.map((r, i) => ({
      import_id: importId,
      sheet_url: sheetUrl,
      imported_at: now,
      sheet_name: sheetName ?? null,
      row_index: i,
      row_json: JSON.stringify(r),
    }));

    await bigquery.dataset("analytics_lab").table("google_sheets_imports").insert(bqRows);

    await setIntegrationStatus({
      integrationId: "google_sheets",
      status: "connected",
      displayName: sheetName ?? sheetUrl,
      connectedAt: now,
      lastSyncedAt: now,
      lastSyncRows: bqRows.length,
      lastError: null,
    });

    return NextResponse.json({ ok: true, importId, rowCount: bqRows.length });
  } catch (error) {
    console.error("GOOGLE SHEETS IMPORT ERROR:", error);
    await setIntegrationStatus({ integrationId: "google_sheets", status: "error", lastError: String(error) });
    return NextResponse.json({ error: "Failed to import sheet", details: String(error) }, { status: 400 });
  }
}
