import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { bigquery } from "@/lib/bigquery";
import { setIntegrationStatus } from "@/lib/integrations-server";

export async function POST(req: Request) {
  const { filename, sheetName, rows } = await req.json();

  if (!filename || !Array.isArray(rows)) {
    return NextResponse.json({ error: "filename and rows are required" }, { status: 400 });
  }

  const importId = randomUUID();
  const now = new Date().toISOString();

  const bqRows = rows.map((r: unknown, i: number) => ({
    import_id: importId,
    filename,
    uploaded_at: now,
    sheet_name: sheetName ?? null,
    row_index: i,
    row_json: JSON.stringify(r),
  }));

  try {
    if (bqRows.length > 0) {
      await bigquery.dataset("analytics_lab").table("excel_pnl_imports").insert(bqRows);
    }

    await setIntegrationStatus({
      integrationId: "excel",
      status: "connected",
      displayName: filename,
      connectedAt: now,
      lastSyncedAt: now,
      lastSyncRows: bqRows.length,
      lastError: null,
    });

    return NextResponse.json({ ok: true, importId, rowCount: bqRows.length });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    await setIntegrationStatus({
      integrationId: "excel",
      status: "error",
      lastError: String(error),
    });
    return NextResponse.json(
      { error: "Failed to save import", details: String(error) },
      { status: 500 }
    );
  }
}
