"use client";

import { useState } from "react";

const CHURN_ALERT_THRESHOLD_PCT = 30;

function buildDigestText(data: any): string {
  const lines: string[] = [];
  lines.push("MAISON LUMIÈRE — WEEKLY DIGEST");
  lines.push(`Prepared ${data.monthLabel} (built from monthly reporting data, the platform's real granularity — read as "this reporting period")`);
  lines.push("");

  lines.push("REVENUE");
  if (data.priorMonthRevenue !== null) {
    const dir = data.revenueMoMChangePct >= 0 ? "up" : "down";
    lines.push(
      `€${data.revenueActual.toLocaleString()} this month vs €${data.priorMonthRevenue.toLocaleString()} last month (${data.priorMonthLabel}) — ${dir} ${Math.abs(data.revenueMoMChangePct)}%.`
    );
  } else {
    lines.push(`€${data.revenueActual.toLocaleString()} this month. No prior month on record to compare.`);
  }
  lines.push("");

  lines.push("TOP PERFORMING INFLUENCER");
  lines.push(
    data.topInfluencer
      ? `${data.topInfluencer.name} — €${data.topInfluencer.revenue.toLocaleString()} revenue, ${data.topInfluencer.avgRoi.toFixed(1)}% avg ROI.`
      : "No influencer data available."
  );
  lines.push("");

  lines.push("BIGGEST COST VARIANCE");
  lines.push(
    data.worstCostCenter
      ? `${data.worstCostCenter.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")} — ${data.worstCostCenter.variance >= 0 ? "+" : ""}€${data.worstCostCenter.variance.toLocaleString()} (${data.worstCostCenter.variancePct.toFixed(1)}%) vs. budget.`
      : "No cost center data available."
  );
  lines.push("");

  lines.push("CHURN RISK");
  if (data.overallChurnRatePct > CHURN_ALERT_THRESHOLD_PCT) {
    lines.push(
      `⚠ ${data.overallChurnRatePct}% of customers haven't purchased in 90+ days — above the ${CHURN_ALERT_THRESHOLD_PCT}% alert threshold. See the Churn Risk Model in Decision Intelligence.`
    );
  } else {
    lines.push(`${data.overallChurnRatePct}% churn — within the normal range (below the ${CHURN_ALERT_THRESHOLD_PCT}% alert threshold).`);
  }
  lines.push("");

  lines.push("RECOMMENDED ACTION THIS WEEK");
  lines.push(
    data.actionItems && data.actionItems.length > 0
      ? `${data.actionItems[0].title}. ${data.actionItems[0].detail}`
      : "No rules triggered this month — nothing above threshold."
  );
  lines.push("");
  lines.push("— Generated automatically from real BigQuery data.");

  return lines.join("\n");
}

export default function WeeklyDigest({ data }: { data: any }) {
  const [copied, setCopied] = useState(false);
  const digestText = buildDigestText(data);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(digestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail on non-secure contexts -- fail silently,
      // the text is still fully visible and selectable below.
    }
  }

  return (
    <div className="section panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="stat-label">Weekly Digest — copy, paste into an email to your team</div>
        <button type="button" className="btn-ghost" onClick={handleCopy}>
          {copied ? "Copied ✓" : "Copy to Clipboard"}
        </button>
      </div>
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
        {digestText}
      </pre>
    </div>
  );
}
