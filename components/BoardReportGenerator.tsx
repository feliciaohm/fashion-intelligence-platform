"use client";

import { useState } from "react";
import { monthLabel, formatDeptName, capitalize } from "@/lib/narrative";

function buildReportText(latestPeriod: string, costCenters: any[], channels: any[], narrative: string[]): string {
  const label = monthLabel(latestPeriod);
  const latestCostCenters = costCenters.filter((r) => r.period === latestPeriod);
  const latestChannels = channels.filter((r) => r.month === latestPeriod);

  const totalBudget = latestCostCenters.reduce((s, r) => s + r.budget, 0);
  const totalActual = latestCostCenters.reduce((s, r) => s + r.actual, 0);
  const overallVariance = totalActual - totalBudget;

  const worstOverspend = [...latestCostCenters].sort((a, b) => b.variance - a.variance)[0];
  const worstUnderspend = [...latestCostCenters].sort((a, b) => a.variance - b.variance)[0];
  const bestChannel = [...latestChannels].sort((a, b) => b.variance - a.variance)[0];
  const worstChannel = [...latestChannels].sort((a, b) => a.variance - b.variance)[0];

  const totalRevenueActual = latestChannels.reduce((s, r) => s + r.revenue_actual, 0);
  const totalRevenueForecast = latestChannels.reduce((s, r) => s + r.revenue_forecast, 0);
  const revenueVariancePct = totalRevenueForecast ? ((totalRevenueActual - totalRevenueForecast) / totalRevenueForecast) * 100 : 0;

  const lines: string[] = [];
  lines.push("MAISON LUMIÈRE — BOARD REPORT");
  lines.push(`${label} Financial Review`);
  lines.push("");

  lines.push("REVENUE");
  lines.push(
    `• Total revenue: €${totalRevenueActual.toLocaleString()} actual vs. €${totalRevenueForecast.toLocaleString()} forecast (${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}% vs. plan)`
  );
  if (bestChannel) {
    lines.push(
      `• ${capitalize(bestChannel.channel)}: €${bestChannel.revenue_actual.toLocaleString()} (${bestChannel.variance_pct >= 0 ? "+" : ""}${bestChannel.variance_pct.toFixed(1)}% vs. forecast) — strongest channel this month`
    );
  }
  if (worstChannel && worstChannel.channel !== bestChannel?.channel) {
    lines.push(
      `• ${capitalize(worstChannel.channel)}: €${worstChannel.revenue_actual.toLocaleString()} (${worstChannel.variance_pct >= 0 ? "+" : ""}${worstChannel.variance_pct.toFixed(1)}% vs. forecast) — weakest channel this month`
    );
  }
  lines.push("");

  lines.push("COST MANAGEMENT");
  lines.push(
    `• Total cost-center spend: €${totalActual.toLocaleString()} vs. €${totalBudget.toLocaleString()} budget (${overallVariance >= 0 ? "+" : ""}€${overallVariance.toLocaleString()}, ${totalBudget ? ((overallVariance / totalBudget) * 100).toFixed(1) : "0.0"}%)`
  );
  if (worstOverspend && worstOverspend.variance > 0) {
    lines.push(
      `• ${formatDeptName(worstOverspend.name)}: largest overspend, +€${worstOverspend.variance.toLocaleString()} over budget (${worstOverspend.variance_pct.toFixed(1)}%)`
    );
  }
  if (worstUnderspend && worstUnderspend.variance < 0 && worstUnderspend.name !== worstOverspend?.name) {
    lines.push(
      `• ${formatDeptName(worstUnderspend.name)}: largest underspend, €${Math.abs(worstUnderspend.variance).toLocaleString()} under budget (${worstUnderspend.variance_pct.toFixed(1)}%)`
    );
  }
  lines.push("");

  lines.push("TALKING POINTS");
  narrative.forEach((n) => lines.push(`• ${n}`));
  lines.push("");
  lines.push("— Generated automatically from real BigQuery data.");

  return lines.join("\n");
}

export default function BoardReportGenerator({
  latestPeriod,
  costCenters,
  channels,
  narrative,
}: {
  latestPeriod: string;
  costCenters: any[];
  channels: any[];
  narrative: string[];
}) {
  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setReportText(buildReportText(latestPeriod, costCenters, channels, narrative));
    setCopied(false);
  }

  async function handleCopy() {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fails silently on non-secure contexts -- text stays visible/selectable.
    }
  }

  return (
    <div className="section panel no-print">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: reportText ? 12 : 0 }}>
        <div>
          <div className="stat-label" style={{ marginBottom: 4 }}>Board Report Generator</div>
          <p className="text-muted" style={{ fontSize: 12.5 }}>
            Compiles this month&apos;s variance data into board-presentation talking points — replaces the
            manual write-up a Finance Intern would otherwise spend hours on each month.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" className="btn" onClick={generate}>
            Generate Board Report
          </button>
          {reportText && (
            <button type="button" className="btn-ghost" onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy to Clipboard"}
            </button>
          )}
        </div>
      </div>

      {reportText && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12.5,
            lineHeight: 1.6,
            background: "var(--color-bg-subtle, #f7f5f1)",
            border: "1px solid var(--color-border, #e4e0d6)",
            borderRadius: 4,
            padding: 16,
            margin: 0,
          }}
        >
          {reportText}
        </pre>
      )}
    </div>
  );
}
