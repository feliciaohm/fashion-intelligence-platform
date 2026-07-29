"use client";

import Link from "next/link";
import { ALL_MODULES, RoleConfig } from "@/lib/roles";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function dateOf(r: any): string {
  return r.post_date?.value ?? r.post_date ?? "";
}

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

export default function RoleHome({
  role,
  journey,
  onSwitchRole,
}: {
  role: RoleConfig;
  journey: any[];
  onSwitchRole: () => void;
}) {
  const totalRevenue = journey.reduce((s: number, r: any) => s + (r.revenue_attributed || 0), 0);
  const totalFirstVisitors = journey.reduce((s: number, r: any) => s + (r.first_visitors_48h || 0), 0);
  const totalReturnVisitors = journey.reduce((s: number, r: any) => s + (r.return_visitors || 0), 0);
  const returnRate = totalFirstVisitors ? (totalReturnVisitors / totalFirstVisitors) * 100 : 0;

  const sorted = [...journey].sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  const older = sorted.slice(0, mid);
  const newer = sorted.slice(mid);
  const olderRevenue = older.reduce((s, r) => s + (r.revenue_attributed || 0), 0);
  const newerRevenue = newer.reduce((s, r) => s + (r.revenue_attributed || 0), 0);
  const revenueDeltaPct = pctDelta(olderRevenue, newerRevenue);
  const olderFirstVisitors = older.reduce((s, r) => s + (r.first_visitors_48h || 0), 0);
  const olderReturnVisitors = older.reduce((s, r) => s + (r.return_visitors || 0), 0);
  const newerFirstVisitors = newer.reduce((s, r) => s + (r.first_visitors_48h || 0), 0);
  const newerReturnVisitors = newer.reduce((s, r) => s + (r.return_visitors || 0), 0);
  const olderRate = olderFirstVisitors ? (olderReturnVisitors / olderFirstVisitors) * 100 : 0;
  const newerRate = newerFirstVisitors ? (newerReturnVisitors / newerFirstVisitors) * 100 : 0;
  const rateDeltaPts = newerRate - olderRate;

  const kpis: KpiItem[] = [
    {
      label: "Revenue Attributed",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier campaigns` : "no prior cohort to compare",
      direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
    },
    {
      label: "Return Rate",
      value: `${returnRate.toFixed(1)}%`,
      delta: `${rateDeltaPts >= 0 ? "+" : ""}${rateDeltaPts.toFixed(1)} pts vs. earlier campaigns`,
      direction: rateDeltaPts >= 0 ? "good" : "critical",
    },
    {
      label: "Campaigns Tracked",
      value: `${journey.length}`,
      delta: `${totalFirstVisitors.toLocaleString()} first-touch visitors`,
      direction: "neutral",
    },
  ];

  const topCampaign = [...journey].sort((a, b) => (b.revenue_attributed || 0) - (a.revenue_attributed || 0))[0];
  const headline = topCampaign
    ? `${topCampaign.influencer}'s ${topCampaign.product_slug} campaign attributed €${topCampaign.revenue_attributed.toLocaleString()} in revenue — the largest single contribution this period.`
    : "No campaign data available yet.";
  const topReturnRateCampaign = [...journey].sort((a, b) => (b.return_rate_pct || 0) - (a.return_rate_pct || 0))[0];
  const insightBoxText = topReturnRateCampaign && topReturnRateCampaign !== topCampaign
    ? `${topReturnRateCampaign.influencer}'s ${topReturnRateCampaign.product_slug} campaign converted ${topReturnRateCampaign.return_rate_pct}% of first-touch visitors into return visits — the highest return rate of any tracked campaign.`
    : headline;

  return (
    <div>
      <div className="page-meta no-print">
        <span>Welcome back</span>
        <button type="button" className="btn-ghost" onClick={onSwitchRole}>
          Switch role
        </button>
      </div>
      <div className="page-eyebrow">Overview · {role.label} Home</div>
      <h1 className="page-title" style={{ fontSize: 34 }}>
        {role.label} view
      </h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {journey.length > 0 && <KpiStrip items={kpis} />}

      <div className="section">
        <h2 className="section-title">Built for {role.label}</h2>
        <p className="section-subtitle">Your most relevant modules — everything else is one click away below.</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 1,
            background: "var(--color-border)",
            border: "1px solid var(--color-border)",
            marginTop: 14,
          }}
        >
          {role.modules.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel"
              style={{ display: "block", border: "none" }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "var(--color-ink)" }}>
                {item.name}
              </div>
              <div className="text-muted" style={{ lineHeight: 1.5 }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <details className="section">
        <summary
          style={{
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--color-ink-muted)",
          }}
        >
          View the full platform (30 pages)
        </summary>

        {ALL_MODULES.map((group) => (
          <div className="section" key={group.group}>
            <h2 className="section-title">{group.group}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 1,
                background: "var(--color-border)",
                border: "1px solid var(--color-border)",
                marginTop: 14,
              }}
            >
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="panel"
                  style={{ display: "block", border: "none" }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "var(--color-ink)" }}>
                    {item.name}
                  </div>
                  <div className="text-muted" style={{ lineHeight: 1.5 }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </details>

      {journey.length > 0 && (
        <>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}
    </div>
  );
}
