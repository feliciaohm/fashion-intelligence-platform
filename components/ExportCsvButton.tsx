"use client";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    value = (value as Record<string, unknown>).value;
  }
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ExportCsvButton({
  data,
  filename,
}: {
  data: Record<string, unknown>[];
  filename: string;
}) {
  function handleExport() {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const lines = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => formatCell(row[h])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="btn-ghost" onClick={handleExport} disabled={!data || data.length === 0}>
      Export CSV
    </button>
  );
}
