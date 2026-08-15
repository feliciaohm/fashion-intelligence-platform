import Link from "next/link";
import { selfFetch } from "@/lib/self-fetch";
import PrintButton from "@/components/PrintButton";
import WeeklyDigest from "@/components/WeeklyDigest";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import { buildInsightText } from "@/lib/insight-text";
import type { MetricStatus, QuickMetric } from "@/lib/quick-metrics-server";

function toDirection(status: MetricStatus): "good" | "critical" | "neutral" {
  if (status === "good") return "good";
  if (status === "critical") return "critical";
  return "neutral";
}

async function getData() {
  const res = await selfFetch("/api/executive-summary", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch executive summary");
  return res.json();
}

async function getQuickMetrics() {
  const res = await selfFetch("/api/quick-metrics", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ExecutiveSummaryPage() {
  const [data, quickMetrics] = await Promise.all([getData(), getQuickMetrics()]);

  const revenueInsightText = buildInsightText({
    metric: "Revenue",
    value: `€${data.revenueActual.toLocaleString()}`,
    comparisonPct: data.revenueMoMChangePct ?? 0,
    direction: (data.revenueMoMChangePct ?? 0) >= 0 ? "above" : "below",
    comparisonLabel: data.priorMonthLabel ? `last month (${data.priorMonthLabel})` : "the prior period",
    driver: data.actionItems[0]
      ? data.actionItems[0].title.charAt(0).toLowerCase() + data.actionItems[0].title.slice(1)
      : "normal month-to-month variation",
    action: data.actionItems[0]
      ? "Review the 'What needs attention' panel below for the full detail and next step"
      : "No corrective action needed this period",
  });

  const kpis: KpiItem[] = (quickMetrics?.metrics ?? []).slice(0, 3).map((m: QuickMetric) => ({
    label: m.label,
    value: m.value,
    delta: m.benchmarkNote,
    direction: toDirection(m.status),
  }));

  return (
    <div>
      <div className="page-eyebrow">Overview · Executive Summary</div>
      <div className="page-meta no-print">
        <span>Executive Summary — {data.monthLabel}</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Executive Summary</h1>
      <p className="doc-insight-line">{data.insight}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section panel">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          What needs attention — rule-based, no AI required
        </div>
        <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
          {data.allFindingsCount} real condition{data.allFindingsCount === 1 ? "" : "s"} checked against fixed thresholds
          (budget overspend, campaign ROI, store trends, churn, CLV:CAC) — the {data.actionItems.length} most severe are shown below.
        </p>
        {data.actionItems.length === 0 ? (
          <p className="text-muted">No rules triggered this month — nothing above threshold.</p>
        ) : (
          <ol style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 20 }}>
            {data.actionItems.map((item: any, i: number) => (
              <li key={i}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-ink)" }}>{item.title}</div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>{item.detail}</div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <WeeklyDigest data={data} />

      <div className="stat-grid section">
        <div className="stat-card">
          <div className="stat-label">Revenue This Month</div>
          <div className="stat-value">€{data.revenueActual.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenue vs. Budget</div>
          <div className={`stat-value ${data.revenueVariance >= 0 ? "good" : "critical"}`}>
            {data.revenueVariance >= 0 ? "+" : ""}€{data.revenueVariance.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Products Below Margin Threshold</div>
          <div className={`stat-value ${data.belowThresholdCount > 0 ? "critical" : "good"}`}>
            {data.belowThresholdCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High Churn Risk Customers</div>
          <div className={`stat-value ${data.highChurnCount > 0 ? "critical" : "good"}`}>
            {data.highChurnCount}
          </div>
        </div>
      </div>

      <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 13, marginBottom: 14 }}>Top Performing Product</h2>
          {data.topProduct ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{data.topProduct.name}</div>
              <div className="text-muted">€{data.topProduct.revenue.toLocaleString()} direct-channel revenue</div>
            </>
          ) : (
            <p className="text-muted">No data.</p>
          )}
          <Link href="/product-lifecycle" className="text-muted" style={{ display: "inline-block", marginTop: 14, textDecoration: "underline" }}>
            View Product Lifecycle →
          </Link>
        </div>

        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 13, marginBottom: 14 }}>Top Performing Influencer</h2>
          {data.topInfluencer ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{data.topInfluencer.name}</div>
              <div className="text-muted">
                €{data.topInfluencer.revenue.toLocaleString()} revenue · {data.topInfluencer.avgRoi.toFixed(1)}% avg ROI
              </div>
            </>
          ) : (
            <p className="text-muted">No data.</p>
          )}
          <Link href="/roi" className="text-muted" style={{ display: "inline-block", marginTop: 14, textDecoration: "underline" }}>
            View Influencer ROI →
          </Link>
        </div>

        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 13, marginBottom: 14 }}>Biggest Cost Overspend</h2>
          {data.worstCostCenter ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                {data.worstCostCenter.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")}
              </div>
              <div className={data.worstCostCenter.variance >= 0 ? "text-muted" : "text-muted"} style={{ color: data.worstCostCenter.variance >= 0 ? "var(--status-critical)" : "var(--status-good)" }}>
                {data.worstCostCenter.variance >= 0 ? "+" : ""}€{data.worstCostCenter.variance.toLocaleString()} ({data.worstCostCenter.variancePct.toFixed(1)}%)
              </div>
            </>
          ) : (
            <p className="text-muted">No data.</p>
          )}
          <Link href="/variance-report" className="text-muted" style={{ display: "inline-block", marginTop: 14, textDecoration: "underline" }}>
            View Monthly Variance Report →
          </Link>
        </div>

        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 13, marginBottom: 14 }}>Revenue by Channel — {data.monthLabel}</h2>
          <dl style={{ display: "grid", gap: 8, fontSize: 14 }}>
            {data.channels.map((c: any) => (
              <div key={c.channel} style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted" style={{ textTransform: "capitalize" }}>{c.channel}</span>
                <span style={{ color: c.variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  €{c.revenue_actual.toLocaleString()} ({c.variance >= 0 ? "+" : ""}{c.variance_pct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </dl>
          <Link href="/finance-deep" className="text-muted" style={{ display: "inline-block", marginTop: 14, textDecoration: "underline" }}>
            View Finance Deep-Dive →
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <DocInsightBox>{data.actionItems[0]?.detail ?? data.insight}</DocInsightBox>
        <CopyInsightButton text={revenueInsightText} />
      </div>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consulting-summary", "/benchmarks", "/decision-intelligence"]} />
    </div>
  );
}
