"use client";

import { useState } from "react";

function buildSummaryText(data: any): string {
  const lines: string[] = [];
  lines.push("MAISON LUMIÈRE — CONSULTING SUMMARY");
  lines.push(data.monthLabel);
  lines.push("");

  lines.push("EXECUTIVE SUMMARY");
  lines.push(data.executiveSummary);
  lines.push("");

  lines.push("KEY FINDINGS");
  data.keyFindings.forEach((f: string, i: number) => lines.push(`${i + 1}. ${f}`));
  lines.push("");

  lines.push("STRATEGIC IMPLICATIONS");
  data.strategicImplications.forEach((s: string, i: number) => lines.push(`${i + 1}. ${s}`));
  lines.push("");

  lines.push("PRIORITY FINDINGS");
  data.priorityFindings.forEach((f: any) => {
    lines.push(`${f.priority}. ${f.finding}`);
    lines.push(`   ${f.magnitude}`);
  });
  lines.push("");

  lines.push("— Generated automatically from real BigQuery data.");
  return lines.join("\n");
}

export default function ConsultingSummaryCopyButton({ data }: { data: any }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildSummaryText(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fails silently on non-secure contexts -- text stays visible/selectable.
    }
  }

  return (
    <div className="section no-print" style={{ display: "flex", justifyContent: "flex-end" }}>
      <button type="button" className="btn" onClick={handleCopy}>
        {copied ? "Copied ✓" : "Copy Full Summary"}
      </button>
    </div>
  );
}
