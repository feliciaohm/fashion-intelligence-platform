"use client";

import { useState } from "react";

export default function GoogleSheetsImportZone({ onImported }: { onImported?: () => void }) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/google-sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(`Imported ${json.rowCount} rows`);
      setSheetUrl("");
      onImported?.();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleImport} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
          Google Sheets link
        </label>
        <input
          type="url"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          required
          style={{ width: "100%" }}
        />
        <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          The sheet must be shared as &quot;Anyone with the link can view&quot; — Share → General access. No
          Google sign-in required on this end, same as pasting a public link anywhere else.
        </p>
      </div>
      {error && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{error}</p>}
      {result && <p className="text-muted" style={{ fontSize: 12 }}>{result}</p>}
      <button type="submit" className="btn" disabled={loading} style={{ alignSelf: "flex-start" }}>
        {loading ? "Importing…" : "Import"}
      </button>
    </form>
  );
}
