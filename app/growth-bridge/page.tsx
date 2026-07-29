"use client";

import { useEffect, useState } from "react";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { buildInsightText } from "@/lib/insight-text";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function GrowthBridgeWaterfall({ bars }: { bars: { label: string; value: number; isTotal?: boolean }[] }) {
  const width = 720;
  const height = 240;
  const gap = 16;
  const barWidth = (width - (bars.length - 1) * gap) / bars.length;

  let cumulative = 0;
  const positioned = bars.map((b) => {
    if (b.isTotal) {
      const start = 0;
      const end = b.value;
      cumulative = b.value;
      return { ...b, start, end };
    }
    const start = cumulative;
    const end = cumulative + b.value;
    cumulative = end;
    return { ...b, start, end };
  });

  const maxVal = Math.max(...positioned.map((b) => Math.max(b.start, b.end)), 1);
  const minVal = Math.min(...positioned.map((b) => Math.min(b.start, b.end)), 0);
  const range = maxVal - minVal || 1;
  const scaleY = (v: number) => height - ((v - minVal) / range) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height + 34}`} style={{ width: "100%", height: "auto" }}>
      {positioned.map((b, i) => {
        const x = i * (barWidth + gap);
        const yTop = scaleY(Math.max(b.start, b.end));
        const yBottom = scaleY(Math.min(b.start, b.end));
        const barHeight = Math.max(1, yBottom - yTop);
        const color = b.isTotal ? "var(--color-ink)" : b.value >= 0 ? "var(--status-good)" : "var(--status-critical)";
        return (
          <g key={b.label}>
            <rect x={x} y={yTop} width={barWidth} height={barHeight} fill={color} opacity={b.isTotal ? 1 : 0.75} />
            <text x={x + barWidth / 2} y={yTop - 6} fontSize={11} textAnchor="middle" fill="var(--color-ink)">
              €{Math.round(b.value).toLocaleString()}
            </text>
            <text x={x + barWidth / 2} y={height + 20} fontSize={10} textAnchor="middle" fill="var(--color-ink-muted, #8b8578)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function GrowthBridgePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/growth-bridge")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setError(d.details || d.error);
        else setData(d);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const insightText = data
    ? buildInsightText({
        metric: "Revenue growth",
        value: `€${data.totalGrowth.toLocaleString()}`,
        comparisonPct: data.priorPeriodRevenue ? (data.totalGrowth / data.priorPeriodRevenue) * 100 : 0,
        direction: data.totalGrowth >= 0 ? "above" : "below",
        comparisonLabel: `the prior period's €${data.priorPeriodRevenue.toLocaleString()}`,
        driver:
          data.retainedCustomerCount === 0
            ? `entirely new-vs-churned customer turnover — €${data.newBusiness.toLocaleString()} new business against €${Math.abs(data.churnImpact).toLocaleString()} in churn, since zero customers repurchased in both periods`
            : `€${data.newBusiness.toLocaleString()} new business, €${Math.abs(data.churnImpact).toLocaleString()} churn, and €${data.expansion.toLocaleString()} net expansion among retained customers`,
        action:
          data.retainedCustomerCount === 0
            ? "Prioritize a repeat-purchase program — the platform currently has zero customers who buy more than once, so retention is the single largest available lever"
            : "Focus retention investment on the segment driving expansion, and investigate the churn cohort for a win-back campaign",
      })
    : "";

  const revenueChangePct = data?.priorPeriodRevenue ? (data.totalGrowth / data.priorPeriodRevenue) * 100 : 0;
  const headline = data
    ? `Revenue moved from €${data.priorPeriodRevenue.toLocaleString()} to €${data.currentPeriodRevenue.toLocaleString()} (${revenueChangePct >= 0 ? "+" : ""}${revenueChangePct.toFixed(1)}%), driven by €${data.newBusiness.toLocaleString()} new business against €${Math.abs(data.churnImpact).toLocaleString()} in churn.`
    : "Loading real figures from BigQuery…";

  const kpis: KpiItem[] = data
    ? [
        {
          label: "Current Period Revenue",
          value: `€${data.currentPeriodRevenue.toLocaleString()}`,
          delta: `${revenueChangePct >= 0 ? "+" : ""}${revenueChangePct.toFixed(1)}% vs. prior period`,
          direction: data.totalGrowth >= 0 ? "good" : "critical",
        },
        {
          label: "New Business",
          value: `€${data.newBusiness.toLocaleString()}`,
          delta: `${data.newCustomerCount} new customers`,
          direction: "good",
        },
        {
          label: "Churn Impact",
          value: `€${data.churnImpact.toLocaleString()}`,
          delta: `${data.churnedCustomerCount} churned customers`,
          direction: "critical",
        },
      ]
    : [];

  const insightBoxText = data
    ? data.retainedCustomerCount === 0
      ? `Zero of ${data.newCustomerCount + data.churnedCustomerCount} real customers purchased in both periods — Expansion and Price Effect are genuinely €0, and every euro of change is new-business revenue against churned-customer revenue.`
      : `€${data.expansion.toLocaleString()} in net expansion came from retained customers buying more — the clearest lever to protect and grow.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Growth Bridge</div>
      <h1 className="page-title">Growth Bridge</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      {error && <p style={{ color: "var(--status-critical)" }}>{error}</p>}
      {!data && !error && <p className="text-muted section">Loading real figures from BigQuery…</p>}

      {data && (
        <>
          <div className="section" style={{ display: "flex", justifyContent: "flex-end" }}>
            <CopyInsightButton text={insightText} />
          </div>

          <div className="section panel">
            <GrowthBridgeWaterfall bars={data.waterfall} />
          </div>

          {data.retainedCustomerCount === 0 && (
            <div className="section panel" style={{ borderLeft: "3px solid var(--status-critical)" }}>
              <div className="stat-label" style={{ marginBottom: 6 }}>Real finding</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                {`Zero of ${data.newCustomerCount + data.churnedCustomerCount} real customers purchased in both the prior and current period — so Expansion and Price Effect are genuinely €0, not a calculation error. Every euro of change is new-customer revenue against churned-customer revenue. This is the same "0 of 97 customers have 2+ real purchases" finding the Churn Prediction and Churn Risk calculators already surface — repeat-purchase behavior doesn't yet exist in this dataset.`}
              </p>
            </div>
          )}

          <div className="stat-grid section">
            <div className="stat-card">
              <div className="stat-label">Prior Period Revenue</div>
              <div className="stat-value">€{data.priorPeriodRevenue.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Current Period Revenue</div>
              <div className="stat-value">€{data.currentPeriodRevenue.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net Change</div>
              <div className={`stat-value ${data.totalGrowth >= 0 ? "good" : "critical"}`}>
                {data.totalGrowth >= 0 ? "+" : ""}€{data.totalGrowth.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">New / Retained / Churned Customers</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {data.newCustomerCount} / {data.retainedCustomerCount} / {data.churnedCustomerCount}
              </div>
            </div>
          </div>

          <details className="section">
            <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
              Methodology — how this bridge was built
            </summary>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.methodology.map((line: string, i: number) => (
                <p key={i} className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
          </details>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}

      <RelatedPages hrefs={["/decision-intelligence", "/value-drivers", "/customer-journey"]} />
    </div>
  );
}
