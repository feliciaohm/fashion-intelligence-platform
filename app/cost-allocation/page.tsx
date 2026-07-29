"use client";

import { useEffect, useMemo, useState } from "react";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHANNEL_LABELS: Record<string, string> = { retail: "Retail", ecommerce: "Ecommerce", wholesale: "Wholesale" };
type Channel = "retail" | "ecommerce" | "wholesale";
type Alloc = Record<string, { retail: number; ecommerce: number }>;

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString()}`;
}

function wholesalePct(a: { retail: number; ecommerce: number }): number {
  return Math.max(0, Math.round((100 - a.retail - a.ecommerce) * 10) / 10);
}

function AllocationSliders({
  dept,
  value,
  onChange,
}: {
  dept: any;
  value: { retail: number; ecommerce: number };
  onChange: (v: { retail: number; ecommerce: number }) => void;
}) {
  const wholesale = wholesalePct(value);
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {dept.label}{" "}
          <span
            className="text-muted"
            style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            {dept.type === "REAL" ? "· real" : "· illustrative"}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 14 }}>{euro(dept.actual)}</div>
      </div>
      <p className="text-muted" style={{ fontSize: 11.5, marginBottom: 10 }}>Default driver: {dept.driver}</p>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, width: 90 }}>Retail</label>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={value.retail}
            onChange={(e) => {
              const retail = Number(e.target.value);
              const ecommerce = Math.min(value.ecommerce, 100 - retail);
              onChange({ retail, ecommerce });
            }}
            style={{ flex: 1 }}
          />
          <span className="mono" style={{ width: 48, textAlign: "right", fontSize: 12.5 }}>{value.retail.toFixed(1)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, width: 90 }}>Ecommerce</label>
          <input
            type="range"
            min={0}
            max={100 - value.retail}
            step={0.5}
            value={value.ecommerce}
            onChange={(e) => onChange({ retail: value.retail, ecommerce: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span className="mono" style={{ width: 48, textAlign: "right", fontSize: 12.5 }}>{value.ecommerce.toFixed(1)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, width: 90 }} className="text-muted">Wholesale</label>
          <div style={{ flex: 1, height: 6, background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)" }}>
            <div style={{ width: `${wholesale}%`, height: "100%", background: "var(--color-accent)" }} />
          </div>
          <span className="mono text-muted" style={{ width: 48, textAlign: "right", fontSize: 12.5 }}>{wholesale.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function CostAllocationPage() {
  const [data, setData] = useState<any>(null);
  const [alloc, setAlloc] = useState<Alloc>({});

  useEffect(() => {
    fetcher("/api/cost-allocation").then((json) => {
      setData(json);
      const initial: Alloc = {};
      json.departments.forEach((d: any) => {
        initial[d.id] = { retail: d.defaultPct.retail, ecommerce: d.defaultPct.ecommerce };
      });
      setAlloc(initial);
    });
  }, []);

  const naiveAlloc = useMemo(() => {
    if (!data) return {};
    const totalRevenue = data.channels.reduce((s: number, c: any) => s + c.revenue, 0);
    const result: Alloc = {};
    data.departments.forEach((d: any) => {
      const retailShare = totalRevenue ? (data.channels.find((c: any) => c.channel === "retail")!.revenue / totalRevenue) * 100 : 33.3;
      const ecommerceShare = totalRevenue ? (data.channels.find((c: any) => c.channel === "ecommerce")!.revenue / totalRevenue) * 100 : 33.3;
      result[d.id] = { retail: Math.round(retailShare * 10) / 10, ecommerce: Math.round(ecommerceShare * 10) / 10 };
    });
    return result;
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.channels.map((c: any) => {
      const key = c.channel as Channel;
      const allocatedOverhead = data.departments.reduce((sum: number, d: any) => {
        const pct = key === "wholesale" ? wholesalePct(alloc[d.id] || { retail: 0, ecommerce: 0 }) : (alloc[d.id]?.[key] || 0);
        return sum + d.actual * (pct / 100);
      }, 0);
      const trueProfit = c.grossProfit - allocatedOverhead;
      return {
        channel: c.channel,
        revenue: c.revenue,
        grossProfit: c.grossProfit,
        grossMarginPct: c.revenue ? (c.grossProfit / c.revenue) * 100 : 0,
        allocatedOverhead,
        trueProfit,
        trueMarginPct: c.revenue ? (trueProfit / c.revenue) * 100 : 0,
      };
    });
  }, [data, alloc]);

  if (!data) return <p className="text-muted section">Loading real revenue, cost-center, and overhead data…</p>;

  const totalOverheadAllocated = rows.reduce((s: number, r: any) => s + r.allocatedOverhead, 0);
  const byTrueMargin = [...rows].sort((a: any, b: any) => a.trueMarginPct - b.trueMarginPct);
  const worst = byTrueMargin[0];
  const byGrossMargin = [...rows].sort((a: any, b: any) => b.grossMarginPct - a.grossMarginPct);
  const rankShiftChannel = rows.find((r: any) => {
    const grossRank = byGrossMargin.findIndex((x: any) => x.channel === r.channel);
    const trueRank = byTrueMargin.findIndex((x: any) => x.channel === r.channel);
    return Math.abs(grossRank - (2 - trueRank)) >= 1 && grossRank === 0;
  });

  const kpis: KpiItem[] = [
    {
      label: "Total Overhead Allocated",
      value: euro(totalOverheadAllocated),
      delta: `${data.departments.length} cost pools across 3 channels`,
      direction: "neutral",
    },
    {
      label: "Weakest True Margin",
      value: `${CHANNEL_LABELS[worst.channel]}`,
      delta: `${worst.trueMarginPct.toFixed(1)}% after full overhead allocation`,
      direction: worst.trueMarginPct >= 0 ? "neutral" : "critical",
    },
    {
      label: "Best True Margin",
      value: `${CHANNEL_LABELS[byTrueMargin[byTrueMargin.length - 1].channel]}`,
      delta: `${byTrueMargin[byTrueMargin.length - 1].trueMarginPct.toFixed(1)}% after full overhead allocation`,
      direction: "good",
    },
  ];

  const headline = rankShiftChannel
    ? `${CHANNEL_LABELS[rankShiftChannel.channel]} has the best gross margin (${rankShiftChannel.grossMarginPct.toFixed(1)}%) but drops to ${rankShiftChannel.trueMarginPct.toFixed(1)}% true margin once its real share of shared overhead is allocated.`
    : `Allocating €${Math.round(totalOverheadAllocated).toLocaleString()} of shared overhead across channels changes true profitability meaningfully once each channel carries its real activity-based share.`;

  return (
    <div>
      <div className="page-eyebrow">Finance · Cost Allocation Engine</div>
      <h1 className="page-title">Cost Allocation Engine</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">True Profitability by Channel</h2>
        <p className="section-subtitle">
          Gross margin (before overhead) vs. true margin (after allocating IT, HR, Logistics, and Marketing using the
          sliders below) — the activity-based-costing number most fashion brands never actually compute.
        </p>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Revenue</th>
              <th>Gross Profit</th>
              <th>Gross Margin %</th>
              <th>Allocated Overhead</th>
              <th>True Profit</th>
              <th>True Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.channel}>
                <td>{CHANNEL_LABELS[r.channel]}</td>
                <td>{euro(r.revenue)}</td>
                <td>{euro(r.grossProfit)}</td>
                <td>{r.grossMarginPct.toFixed(1)}%</td>
                <td style={{ color: "var(--status-critical)" }}>−{euro(r.allocatedOverhead)}</td>
                <td style={{ fontWeight: 600 }}>{euro(r.trueProfit)}</td>
                <td style={{ color: r.trueMarginPct >= 0 ? "var(--status-good)" : "var(--status-critical)", fontWeight: 600 }}>
                  {r.trueMarginPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>Allocation Drivers</h2>
            <p className="section-subtitle">
              Each department's cost is split across Retail / Ecommerce / Wholesale. Adjust the sliders to test a
              different allocation basis — Wholesale always takes the remainder.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const reset: Alloc = {};
                data.departments.forEach((d: any) => {
                  reset[d.id] = { retail: d.defaultPct.retail, ecommerce: d.defaultPct.ecommerce };
                });
                setAlloc(reset);
              }}
            >
              Use activity-based defaults
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAlloc(naiveAlloc)}>
              Use naive revenue-only split
            </button>
          </div>
        </div>
      </div>

      {data.departments.map((d: any) => (
        <AllocationSliders
          key={d.id}
          dept={d}
          value={alloc[d.id] || { retail: 0, ecommerce: 0 }}
          onChange={(v) => setAlloc((prev) => ({ ...prev, [d.id]: v }))}
        />
      ))}

      <DocInsightBox>{headline}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consolidated-pnl", "/finance-deep", "/value-drivers"]} />
    </div>
  );
}
