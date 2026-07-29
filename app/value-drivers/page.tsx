"use client";

import { useEffect, useState } from "react";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { buildInsightText } from "@/lib/insight-text";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function TreeNode({
  label,
  value,
  note,
  pctOfParent,
  depth = 0,
  children,
}: {
  label: string;
  value: string;
  note?: string;
  pctOfParent?: number;
  depth?: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginLeft: depth > 0 ? 28 : 0, marginTop: depth > 0 ? 12 : 0 }}>
      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderLeft: depth > 0 ? "2px solid var(--color-accent)" : undefined,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          {note && <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>{note}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stat-value" style={{ fontSize: 19 }}>{value}</div>
          {pctOfParent !== undefined && (
            <div className="text-muted" style={{ fontSize: 11.5 }}>{pctOfParent}% of parent</div>
          )}
        </div>
      </div>
      {children && (
        <div style={{ borderLeft: "2px solid var(--color-border, #e4e0d6)", marginLeft: 18 }}>{children}</div>
      )}
    </div>
  );
}

function TornadoChart() {
  const [sens, setSens] = useState<any>(null);

  useEffect(() => {
    fetch("/api/scenario-sensitivity")
      .then((res) => res.json())
      .then(setSens);
  }, []);

  if (!sens) return <p className="text-muted section">Loading sensitivity data…</p>;

  const baseline = sens.baseline.revenue;
  const bars = sens.variables
    .map((v: any) => {
      const plus20 = v.deltas.find((d: any) => d.pct === 20).revenue;
      const minus20 = v.deltas.find((d: any) => d.pct === -20).revenue;
      const upSwing = plus20 - baseline;
      const downSwing = minus20 - baseline;
      const impact = Math.max(Math.abs(upSwing), Math.abs(downSwing));
      return { label: v.label, impact, upSwing, downSwing };
    })
    .sort((a: any, b: any) => b.impact - a.impact);

  const maxImpact = Math.max(...bars.map((b: any) => b.impact), 1);
  const topLever = bars[0];
  const topLeverInsightText = topLever
    ? buildInsightText({
        metric: "Total revenue",
        value: `€${Math.round(baseline).toLocaleString()}`,
        comparisonPct: (topLever.impact / baseline) * 100,
        direction: topLever.upSwing >= Math.abs(topLever.downSwing) ? "above" : "below",
        comparisonLabel: `baseline at a ±20% swing in ${topLever.label}`,
        driver: `${topLever.label}, the single largest lever among every tracked variable`,
        action: `Prioritize ${topLever.label} in planning and scenario modeling before the other levers on this chart`,
      })
    : "";

  return (
    <div className="section panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Sensitivity Tornado Chart</h2>
        {topLever && <CopyInsightButton text={topLeverInsightText} />}
      </div>
      <p className="text-muted" style={{ marginBottom: 20 }}>
        Every real business lever's ±20% impact on total revenue, sorted by size — the longest bar is the
        variable that moves this business the most. Same underlying model as the Scenario page&apos;s sensitivity table.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {bars.map((b: any) => {
          const upPct = (Math.abs(b.upSwing) / maxImpact) * 100;
          const downPct = (Math.abs(b.downSwing) / maxImpact) * 100;
          return (
            <div key={b.label}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{b.label}</div>
              <div style={{ display: "flex", alignItems: "center", height: 22 }}>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: `${downPct}%`, height: 16, background: "var(--status-critical)", opacity: 0.65 }} />
                </div>
                <div style={{ width: 2, height: 22, background: "var(--color-border, #e4e0d6)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: `${upPct}%`, height: 16, background: "var(--status-good)", opacity: 0.65 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }} className="text-muted">
                <span>{b.downSwing >= 0 ? "+" : ""}€{Math.round(b.downSwing).toLocaleString()} at -20%</span>
                <span>{b.upSwing >= 0 ? "+" : ""}€{Math.round(b.upSwing).toLocaleString()} at +20%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ValueDriversPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/value-drivers")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setError(d.details || d.error);
        else setData(d);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const children = data?.tree?.revenue?.children ?? [];
  const sortedChildren = [...children].sort((a: any, b: any) => b.value - a.value);
  const topChild = sortedChildren[0];
  const secondChild = sortedChildren[1];

  const kpis: KpiItem[] = data
    ? [
        {
          label: data.tree.revenue.label,
          value: `€${data.tree.revenue.value.toLocaleString()}`,
          delta: "the top of the tree",
          direction: "neutral",
        },
        ...(topChild
          ? [{ label: topChild.label, value: `€${topChild.value.toLocaleString()}`, delta: `${topChild.pctOfParent}% of total revenue`, direction: "neutral" as const }]
          : []),
        ...(secondChild
          ? [{ label: secondChild.label, value: `€${secondChild.value.toLocaleString()}`, delta: `${secondChild.pctOfParent}% of total revenue`, direction: "neutral" as const }]
          : []),
      ]
    : [];

  const headline = topChild
    ? `${topChild.label} is the largest revenue channel — €${topChild.value.toLocaleString()}, ${topChild.pctOfParent}% of total revenue.`
    : "Loading real figures from BigQuery…";
  const insightBoxText = topChild?.note
    ? topChild.note
    : secondChild
    ? `${secondChild.label} is the second-largest channel at ${secondChild.pctOfParent}% of total revenue — see the tree below for the full breakdown.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Value Driver Tree</div>
      <h1 className="page-title">Value Driver Tree</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      {error && <p style={{ color: "var(--status-critical)" }}>{error}</p>}

      {!data && !error && <p className="text-muted section">Loading real figures from BigQuery…</p>}

      {data && (
        <div className="section">
          <TreeNode label={data.tree.revenue.label} value={`€${data.tree.revenue.value.toLocaleString()}`}>
            {data.tree.revenue.children.map((child: any) => (
              <div key={child.label}>
                <TreeNode label={child.label} value={`€${child.value.toLocaleString()}`} note={child.note} pctOfParent={child.pctOfParent} depth={1}>
                  {child.drivers && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      <div style={{ marginLeft: 28, marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {child.drivers.map((d: any) => (
                          <div key={d.label} className="panel" style={{ padding: "10px 16px", borderLeft: "2px solid var(--color-accent)" }}>
                            <div className="text-muted" style={{ fontSize: 11 }}>{d.label}</div>
                            <div className="stat-value" style={{ fontSize: 16 }}>
                              {d.unit === "€" ? `€${d.value.toLocaleString()}` : d.unit === "%" ? `${d.value}%` : d.value.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                      {child.sessionSources && (
                        <details style={{ marginLeft: 28, marginTop: 12 }}>
                          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
                            ▸ Sessions breaks down into
                          </summary>
                          <div style={{ marginTop: 10 }}>
                            {child.sessionSources.map((s: any) => (
                              <TreeNode key={s.label} label={s.label} value={s.value.toLocaleString()} pctOfParent={s.pctOfParent} note={s.note} depth={1} />
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </TreeNode>
              </div>
            ))}
          </TreeNode>

          <details className="section" style={{ marginTop: 20 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
              Methodology — how this tree was built
            </summary>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.methodology.map((line: string, i: number) => (
                <p key={i} className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
          </details>

          <TornadoChart />
        </div>
      )}

      {data && (
        <>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}

      <RelatedPages hrefs={["/decision-intelligence", "/cost-allocation", "/growth-bridge"]} />
    </div>
  );
}
