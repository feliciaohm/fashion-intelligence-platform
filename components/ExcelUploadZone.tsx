"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelUploadZone({
  onImported,
}: {
  onImported?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setRowCount(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

      if (json.length === 0) {
        throw new Error("No rows found — the first sheet appears to be empty.");
      }

      setRows(json);
      setFilename(file.name);

      const res = await fetch("/api/integrations/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, sheetName, rows: json }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.details || resJson.error || "Import failed");
      setRowCount(resJson.rowCount);
      onImported?.();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => document.getElementById("excel-file-input")?.click()}
        className="panel"
        style={{
          border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-border-strong)"}`,
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p style={{ fontWeight: 600, marginBottom: 4 }}>
          {loading ? "Reading file…" : "Drop an Excel file here, or click to browse"}
        </p>
        <p className="text-muted">.xlsx, .xls, or .csv — read entirely in your browser</p>
      </div>

      {error && (
        <div className="panel" style={{ marginTop: 12, borderColor: "var(--status-critical)" }}>
          <p style={{ color: "var(--status-critical)" }}>{error}</p>
        </div>
      )}

      {rows && rowCount !== null && (
        <div style={{ marginTop: 16 }}>
          <p className="text-muted" style={{ marginBottom: 10 }}>
            {filename} — {rowCount} row{rowCount === 1 ? "" : "s"} read and saved
            {rows.length > 50 ? ` (showing first 50)` : ""}
          </p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    {columns.map((k) => (
                      <td key={k}>{r[k] === null || r[k] === undefined ? "—" : String(r[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
