"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import RelatedPages from "@/components/RelatedPages";
import { DocFooterNote, formatTimestamp } from "@/components/DocLayout";

interface UploadDetail {
  filename: string;
  sheetName: string | null;
  uploadedAt: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export default function CustomDataDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [data, setData] = useState<UploadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/custom-data/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }
        setData(json);
      });
  }, [id]);

  async function deleteUpload() {
    if (!confirm("Delete this upload? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/custom-data/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/custom-data");
    } else {
      setDeleting(false);
      alert("Failed to delete — try again.");
    }
  }

  if (error) {
    return (
      <div>
        <div className="page-eyebrow">Platform · Custom Data</div>
        <h1 className="page-title">Not found</h1>
        <p className="doc-insight-line">{error}</p>
        <RelatedPages hrefs={["/custom-data", "/settings"]} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-eyebrow">Platform · Custom Data</div>
      <div className="page-meta no-print">
        <span>{data?.filename ?? "Loading…"}</span>
        <button type="button" className="btn-ghost" onClick={deleteUpload} disabled={!data || deleting}>
          {deleting ? "Deleting…" : "Delete upload"}
        </button>
      </div>
      <h1 className="page-title">{data?.filename ?? "Loading…"}</h1>
      <p className="doc-insight-line">
        {data
          ? `${data.rows.length} row${data.rows.length === 1 ? "" : "s"} across ${data.columns.length} column${data.columns.length === 1 ? "" : "s"} — exactly as uploaded, uploaded ${formatTimestamp(new Date(data.uploadedAt))}.`
          : "Loading…"}
      </p>
      <hr className="doc-header-rule" />

      {data && (
        <div className="section">
          <div className="data-table-wrap" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((c) => (
                      <td key={c}>{row[c] === null || row[c] === undefined ? "" : String(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DocFooterNote timestamp={formatTimestamp(new Date())} />
      <RelatedPages hrefs={["/custom-data", "/settings"]} />
    </div>
  );
}
