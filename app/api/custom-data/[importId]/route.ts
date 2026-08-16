import { NextResponse } from "next/server";
import { bigquery, replaceTableRows } from "@/lib/bigquery";

export async function GET(_req: Request, { params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT filename, sheet_name, uploaded_at, row_index, row_json
        FROM \`analytics_lab.excel_pnl_imports\`
        WHERE import_id = @importId
        ORDER BY row_index ASC
      `,
      params: { importId },
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // row_json was stored as a JSON string per row (any shape -- whatever
    // columns the uploaded file actually had); parse it back out here so
    // the page gets real objects, not a string to parse client-side.
    const parsedRows = rows.map((r: any) => JSON.parse(r.row_json));
    const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];

    return NextResponse.json({
      filename: rows[0].filename,
      sheetName: rows[0].sheet_name,
      uploadedAt: rows[0].uploaded_at?.value ?? rows[0].uploaded_at,
      columns,
      rows: parsedRows,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "Failed to load upload", details: String(error) }, { status: 500 });
  }
}

// Real delete -- a DML DELETE on a table that may have rows still in the
// streaming buffer would hit the same "would affect rows in the streaming
// buffer" error documented in lib/bigquery.ts. Reads everything else,
// then reloads it via the same WRITE_TRUNCATE load-job pattern already
// used elsewhere (replaceTableRows) -- removing just this one import's
// rows without disturbing any other upload's data.
export async function DELETE(_req: Request, { params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  try {
    const [remaining] = await bigquery.query({
      query: `
        SELECT import_id, filename, uploaded_at, sheet_name, row_index, row_json
        FROM \`analytics_lab.excel_pnl_imports\`
        WHERE import_id != @importId
      `,
      params: { importId },
    });

    const rows = (remaining as any[]).map((r) => ({
      import_id: r.import_id,
      filename: r.filename,
      uploaded_at: r.uploaded_at?.value ?? r.uploaded_at,
      sheet_name: r.sheet_name,
      row_index: r.row_index,
      row_json: r.row_json,
    }));

    if (rows.length > 0) {
      await replaceTableRows("analytics_lab", "excel_pnl_imports", rows);
    } else {
      // Nothing left -- truncate directly rather than replaceTableRows,
      // which no-ops on an empty array (that's a "skip this call" guard,
      // not a "clear the table" instruction).
      await bigquery.query("TRUNCATE TABLE `analytics_lab.excel_pnl_imports`");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "Failed to delete upload", details: String(error) }, { status: 500 });
  }
}
