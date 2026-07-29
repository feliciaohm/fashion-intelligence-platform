"use client";

import { useState } from "react";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import EmptyState from "@/components/EmptyState";

const SOURCES: Record<string, { dimensions: string[]; measures: string[] }> = {
  "Influencer Campaigns": {
    dimensions: ["influencer", "product_slug", "country", "platform"],
    measures: ["revenue_attributed", "first_visitors_48h", "return_visitors", "purchases", "gifted_cost"],
  },
  Products: {
    dimensions: ["category", "collection", "color"],
    measures: ["price", "retail_revenue", "ecommerce_revenue", "influencer_revenue"],
  },
  Customers: {
    dimensions: ["segment", "country"],
    measures: ["lifetime_value", "order_count"],
  },
  "Cost Centers": {
    dimensions: ["name", "period"],
    measures: ["budget", "actual", "variance"],
  },
  Returns: {
    dimensions: ["reason", "product_slug", "influencer_campaign"],
    measures: ["refund_amount"],
  },
};

function label(s: string) {
  return s.replace(/_/g, " ");
}

export default function ExplorePage() {
  const sourceNames = Object.keys(SOURCES);
  const [source, setSource] = useState(sourceNames[0]);
  const [dimension, setDimension] = useState(SOURCES[sourceNames[0]].dimensions[0]);
  const [measure, setMeasure] = useState(SOURCES[sourceNames[0]].measures[0]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  function onSourceChange(next: string) {
    setSource(next);
    setDimension(SOURCES[next].dimensions[0]);
    setMeasure(SOURCES[next].measures[0]);
    setRows(null);
  }

  async function runPivot() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pivot?source=${encodeURIComponent(source)}&dimension=${encodeURIComponent(dimension)}&measure=${encodeURIComponent(measure)}`
      );
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
      setRanAt(new Date());
    } finally {
      setLoading(false);
    }
  }

  const kpis: KpiItem[] = rows && rows.length > 0
    ? [
        {
          label: `Total ${label(measure)}`,
          value: rows.reduce((s, r) => s + (typeof r.value === "number" ? r.value : 0), 0).toLocaleString(),
          delta: `summed across ${rows.length} groups`,
          direction: "neutral",
        },
        {
          label: "Groups",
          value: `${rows.length}`,
          delta: `distinct ${label(dimension)} values`,
          direction: "neutral",
        },
        {
          label: "Total Rows",
          value: rows.reduce((s, r) => s + (r.row_count || 0), 0).toLocaleString(),
          delta: "underlying records pivoted",
          direction: "neutral",
        },
      ]
    : [];

  const topRow = rows && rows.length > 0 ? [...rows].sort((a, b) => (b.value || 0) - (a.value || 0))[0] : null;
  const headline = topRow
    ? `${String(topRow.dimension)} leads on ${label(measure)} — ${typeof topRow.value === "number" ? topRow.value.toLocaleString() : topRow.value}, across ${topRow.row_count} rows.`
    : "Pick a source, dimension, and measure below, then run the pivot to see real results.";

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Explore</div>
      <h1 className="page-title">Explore</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section panel" style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div className="stat-label" style={{ marginBottom: 8 }}>Data Source</div>
          <select value={source} onChange={(e) => onSourceChange(e.target.value)}>
            {sourceNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="stat-label" style={{ marginBottom: 8 }}>Row Dimension</div>
          <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
            {SOURCES[source].dimensions.map((d) => (
              <option key={d} value={d}>{label(d)}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="stat-label" style={{ marginBottom: 8 }}>Measure</div>
          <select value={measure} onChange={(e) => setMeasure(e.target.value)}>
            {SOURCES[source].measures.map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </select>
        </div>

        <button className="btn" onClick={runPivot} disabled={loading}>
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {rows && (
        <div className="section">
          {rows.length > 0 && (
            <div className="data-table-toolbar">
              <ExportCsvButton data={rows} filename={`explore-${source}-${dimension}-${measure}.csv`} />
            </div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{label(dimension)}</th>
                  <th>{label(measure)} (sum)</th>
                  <th>Rows</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{String(r.dimension)}</td>
                    <td>{typeof r.value === "number" ? r.value.toLocaleString() : r.value}</td>
                    <td>{r.row_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState
                label="No Results"
                message="This combination of source, dimension, and measure returned no rows — try a different dimension or measure."
              />
            )}
          </div>
        </div>
      )}

      {topRow && rows && rows.length > 1 && (
        <DocInsightBox>
          {String(topRow.dimension)} accounts for {typeof topRow.value === "number" && rows.reduce((s, r) => s + (r.value || 0), 0) > 0
            ? `${((topRow.value / rows.reduce((s, r) => s + (r.value || 0), 0)) * 100).toFixed(1)}%`
            : "the largest share"} of total {label(measure)} across all {rows.length} groups.
        </DocInsightBox>
      )}
      {ranAt && <DocFooterNote timestamp={formatTimestamp(ranAt)} />}

      <RelatedPages hrefs={["/intelligence", "/master", "/decision-intelligence"]} />
    </div>
  );
}
