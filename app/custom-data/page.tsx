"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RelatedPages from "@/components/RelatedPages";
import ExcelUploadZone from "@/components/ExcelUploadZone";
import { DocFooterNote, formatTimestamp } from "@/components/DocLayout";

interface Upload {
  import_id: string;
  filename: string;
  sheet_name: string | null;
  uploaded_at: { value: string } | string;
  row_count: number;
}

function uploadDate(u: Upload): Date {
  const v = typeof u.uploaded_at === "string" ? u.uploaded_at : u.uploaded_at.value;
  return new Date(v);
}

export default function CustomDataPage() {
  const [uploads, setUploads] = useState<Upload[] | null>(null);

  function load() {
    fetch("/api/custom-data")
      .then((res) => res.json())
      .then((json) => setUploads(json.uploads ?? []));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="page-eyebrow">Platform · Custom Data</div>
      <h1 className="page-title">Custom Data</h1>
      <p className="doc-insight-line">
        {uploads
          ? `${uploads.length} spreadsheet${uploads.length === 1 ? "" : "s"} uploaded — any .xlsx, .xls, or .csv, any columns.`
          : "Loading…"}
      </p>
      <hr className="doc-header-rule" />

      <div className="section">
        <h2 className="section-title">Upload any spreadsheet</h2>
        <p className="section-subtitle">
          Drop in a real file from any system you already use — an export from Sitoo, iD Cloud, Omnium, Qlik, or
          just an Excel file someone emailed you. No column mapping required to store it; every column and row is
          kept exactly as uploaded.
        </p>
        <ExcelUploadZone onImported={load} />
      </div>

      <div className="section">
        <h2 className="section-title">Past uploads</h2>
        {uploads && uploads.length === 0 && (
          <p className="text-muted">No spreadsheets uploaded yet — drop one in above.</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {(uploads ?? []).map((u) => (
            <Link
              key={u.import_id}
              href={`/custom-data/${u.import_id}`}
              className="panel"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, wordBreak: "break-word" }}>{u.filename}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {u.row_count} row{u.row_count === 1 ? "" : "s"} · uploaded {formatTimestamp(uploadDate(u))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <DocFooterNote timestamp={formatTimestamp(new Date())} />
      <RelatedPages hrefs={["/settings", "/data-quality"]} />
    </div>
  );
}
