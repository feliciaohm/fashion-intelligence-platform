import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";

// Lists every past upload from the generic "upload any spreadsheet"
// feature (components/ExcelUploadZone.tsx -> /api/integrations/excel/import),
// grouped by import_id -- that table has always accepted any .xlsx/.xls/.csv
// with any columns (row_json stores whatever was actually in the file), but
// until now there was nowhere to see uploads after the fact. This is
// read-only: it doesn't touch how uploads are stored.
export async function GET() {
  try {
    const rows = await runQuery(`
      SELECT
        import_id,
        ANY_VALUE(filename) AS filename,
        ANY_VALUE(sheet_name) AS sheet_name,
        MIN(uploaded_at) AS uploaded_at,
        COUNT(*) AS row_count
      FROM \`analytics_lab.excel_pnl_imports\`
      GROUP BY import_id
      ORDER BY uploaded_at DESC
    `);
    return NextResponse.json({ uploads: rows });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "Failed to load uploads", details: String(error) }, { status: 500 });
  }
}
