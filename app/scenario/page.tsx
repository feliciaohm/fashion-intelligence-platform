"use client";

import { useEffect, useState } from "react";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type TargetMetric = "revenue" | "grossMargin" | "netMargin";

const METRIC_LABELS: Record<TargetMetric, string> = {
  revenue: "Total Revenue",
  grossMargin: "Gross Margin",
  netMargin: "Net Margin",
};

function SensitivityAnalysis() {
  const [sens, setSens] = useState<any>(null);
  const [metric, setMetric] = useState<TargetMetric>("revenue");

  useEffect(() => {
    fetcher("/api/scenario-sensitivity").then(setSens);
  }, []);

  if (!sens) return <p className="text-muted section">Loading sensitivity model…</p>;

  const baselineValue = sens.baseline[metric];

  return (
    <div className="section panel">
      <h2 className="section-title" style={{ marginBottom: 4 }}>Sensitivity Analysis</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        The classic McKinsey sensitivity table: each row is one real business lever, changed in isolation by
        ±10% and ±20% from today&apos;s real baseline, holding everything else constant. Shows which levers move
        the business the most.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Target metric</label>
        <select value={metric} onChange={(e) => setMetric(e.target.value as TargetMetric)}>
          {(Object.keys(METRIC_LABELS) as TargetMetric[]).map((m) => (
            <option key={m} value={m}>{METRIC_LABELS[m]}</option>
          ))}
        </select>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          Baseline {METRIC_LABELS[metric]}: <strong style={{ color: "var(--color-ink)" }}>€{baselineValue.toLocaleString()}</strong>
        </span>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Variable</th>
              {sens.deltas.map((pct: number) => (
                <th key={pct}>{pct >= 0 ? "+" : ""}{pct}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sens.variables.map((v: any) => (
              <tr key={v.key}>
                <td>{v.label}</td>
                {v.deltas.map((d: any) => {
                  const change = d[metric] - baselineValue;
                  const changePct = baselineValue !== 0 ? (change / baselineValue) * 100 : 0;
                  return (
                    <td
                      key={d.pct}
                      style={{
                        fontWeight: d.pct === 0 ? 600 : 400,
                        color: d.pct === 0 ? undefined : change >= 0 ? "var(--status-good)" : "var(--status-critical)",
                      }}
                    >
                      €{d[metric].toLocaleString()}
                      {d.pct !== 0 && (
                        <div style={{ fontSize: 10.5, opacity: 0.8 }}>
                          {change >= 0 ? "+" : ""}{changePct.toFixed(1)}%
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="section" style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
          Methodology — how this table was calculated
        </summary>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {sens.methodology.map((line: string, i: number) => (
            <p key={i} className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{line}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function ScenarioPage() {
  const [increasePct, setIncreasePct] = useState(20);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetcher(`/api/scenario-gifting?increasePct=${increasePct}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [increasePct]);

  const kpis: KpiItem[] = data
    ? [
        {
          label: "Historical Gifted Cost",
          value: `€${data.historical.giftedCost.toLocaleString()}`,
          delta: "real, across all tracked campaigns",
          direction: "neutral",
        },
        {
          label: "Historical Revenue",
          value: `€${data.historical.revenue.toLocaleString()}`,
          delta: "real, campaign-attributed",
          direction: "neutral",
        },
        {
          label: "Historical ROI",
          value: `${data.historical.roiPct}%`,
          delta: "above breakeven (0%)",
          direction: data.historical.roiPct >= 0 ? "good" : "critical",
        },
      ]
    : [];

  const topInfluencer = data?.topRoiInfluencers?.[0];
  const headline = topInfluencer
    ? `${topInfluencer.influencer} has the highest historical ROI at ${topInfluencer.roi_pct}% — incremental gifting budget should go there first.`
    : "Loading real historical campaign data…";
  const insightBoxText = data
    ? `Real historical ROI across all tracked campaigns is ${data.historical.roiPct}% — every projection below is scaled from this real baseline, not a fixed assumption.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Scenario Modeling</div>
      <h1 className="page-title">Scenario Modeling</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section panel" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <label htmlFor="increase" style={{ fontWeight: 600, fontSize: 14 }}>
          Gifting budget change
        </label>
        <input
          id="increase"
          type="range"
          min={-50}
          max={100}
          step={5}
          value={increasePct}
          onChange={(e) => setIncreasePct(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span className="stat-value" style={{ fontSize: 20, minWidth: 64, textAlign: "right" }}>
          {increasePct >= 0 ? "+" : ""}{increasePct}%
        </span>
      </div>

      {loading || !data ? (
        <p className="text-muted section">Loading…</p>
      ) : (
        <>
          <div className="section">
            <h2 className="section-title">Historical (actual)</h2>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Gifted Cost</div>
                <div className="stat-value">€{data.historical.giftedCost.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Revenue</div>
                <div className="stat-value">€{data.historical.revenue.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">ROI</div>
                <div className="stat-value good">{data.historical.roiPct}%</div>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">
              Projected (budget {increasePct >= 0 ? "+" : ""}{increasePct}%)
            </h2>
            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <div className="stat-label">New Gifted Cost</div>
                <div className="stat-value">€{data.projected.giftedCost.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Additional Spend</div>
                <div className="stat-value">€{data.projected.additionalSpend.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Projected Total Revenue</div>
                <div className="stat-value">€{data.projected.totalRevenue.toLocaleString()}</div>
              </div>
            </div>
            <div className="panel">
              Net new profit from this change:{" "}
              <strong
                className={data.projected.netNewProfit >= 0 ? "" : ""}
                style={{ color: data.projected.netNewProfit >= 0 ? "var(--status-good)" : "var(--status-critical)" }}
              >
                €{data.projected.netNewProfit.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Where the incremental budget should go</h2>
            <p className="section-subtitle">Top ROI influencers, ranked by historical return</p>
            <div className="data-table-toolbar">
              <ExportCsvButton data={data.topRoiInfluencers} filename="scenario-top-roi-influencers.csv" />
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Influencer</th>
                    <th>Historical Gifted Cost</th>
                    <th>Historical Revenue</th>
                    <th>ROI %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topRoiInfluencers.map((row: any, i: number) => (
                    <tr key={i}>
                      <td>{row.influencer}</td>
                      <td>€{row.gifted_cost}</td>
                      <td>€{row.total_revenue}</td>
                      <td style={{ color: "var(--status-good)" }}>{row.roi_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <SensitivityAnalysis />

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/roi", "/forecast", "/value-drivers"]} />
    </div>
  );
}
