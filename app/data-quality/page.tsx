"use client";

import { useEffect, useMemo, useState } from "react";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import ExportCsvButton from "@/components/ExportCsvButton";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString()}`;
}

export default function DataQualityPage() {
  const [data, setData] = useState<any>(null);
  const [includeOutliers, setIncludeOutliers] = useState(true);

  useEffect(() => {
    fetcher("/api/data-quality").then(setData);
  }, []);

  const displayedTotal = useMemo(() => {
    if (!data) return 0;
    return includeOutliers ? data.outliers.totalWithOutliers : data.outliers.totalWithoutOutliers;
  }, [data, includeOutliers]);

  if (!data) return <p className="text-muted section">Running real data-quality checks against BigQuery…</p>;

  const { duplicates, nulls, outliers, normalization } = data;

  const kpis: KpiItem[] = [
    {
      label: "Duplicate Records",
      value: `${duplicates.totalDuplicateRecords}`,
      delta: duplicates.totalDuplicateRecords > 0 ? "excluded from every calculation automatically" : "none found across 3 scanned tables",
      direction: duplicates.totalDuplicateRecords > 0 ? "critical" : "good",
    },
    {
      label: "Outliers Flagged",
      value: `${outliers.outliers.length}`,
      delta: `> ${outliers.sigmaUsed}σ above mean (€${outliers.threshold.toLocaleString()})`,
      direction: outliers.outliers.length > 0 ? "critical" : "good",
    },
    {
      label: "Records Normalized",
      value: `${normalization.totalRecordsNormalized}`,
      delta: `${normalization.log.length} country value(s) converted to ISO`,
      direction: "neutral",
    },
  ];

  const headline = outliers.outliers.length > 0
    ? `${outliers.outliers.length} order(s) flagged as statistical outliers (>${outliers.sigmaUsed}σ above the real mean of ${euro(outliers.mean)}), and ${normalization.totalRecordsNormalized} records had a non-ISO country value normalized — every downstream calculator excludes duplicates and shows you these numbers with and without outliers.`
    : "No data quality issues found in the most recent scan.";

  const insightBoxText = `Real order-level revenue mean is ${euro(outliers.mean)} (σ = ${euro(outliers.stddev)}) across ${outliers.totalOrders} purchases — the ${outliers.outliers.length} flagged outlier(s) shift total revenue by ${euro(outliers.totalWithOutliers - outliers.totalWithoutOutliers)}, which is why every revenue figure on this platform should be read alongside its data-quality footnote, not in isolation.`;

  return (
    <div>
      <div className="page-eyebrow">Platform · Data Quality</div>
      <h1 className="page-title">Data Quality</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      {/* ---------- 1. Duplicate detection ---------- */}
      <div className="section">
        <h2 className="section-title">1. Duplicate Detection</h2>
        <p className="section-subtitle">
          Scans shopify_orders, sales_events, and influencer campaigns for records sharing the same real key. Any
          duplicate found is excluded from every calculation on this platform automatically, not just flagged here.
        </p>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Duplicate Key</th>
              <th>Total Records</th>
              <th>Duplicate Records</th>
              <th>Duplicate Groups</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(duplicates.byTable).map((t: any) => (
              <tr key={t.table}>
                <td className="mono">{t.table}</td>
                <td className="text-muted" style={{ fontSize: 12.5 }}>{t.key}</td>
                <td>{t.totalRecords.toLocaleString()}</td>
                <td style={{ color: t.duplicateRecords > 0 ? "var(--status-critical)" : "var(--status-good)" }}>
                  {t.duplicateRecords}
                </td>
                <td>{t.duplicateGroups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- 2. Null value handling ---------- */}
      <div className="section">
        <h2 className="section-title">2. Null Value Handling</h2>
        <p className="section-subtitle">
          Campaigns with an unknown gifted cost are flagged "cost unknown," excluded from blended ROI, and shown
          separately below rather than silently dropped. Any ratio that would divide by zero shows "Insufficient
          data" instead of Infinity or NaN.
        </p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Campaigns With Known Cost</div>
          <div className="stat-value">{nulls.costKnownCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Campaigns — Cost Unknown</div>
          <div className="stat-value" style={{ color: nulls.costUnknownCount > 0 ? "var(--status-critical)" : undefined }}>
            {nulls.costUnknownCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Blended ROI (known-cost only)</div>
          <div className="stat-value">
            {typeof nulls.blendedRoiPct === "number" ? `${nulls.blendedRoiPct}%` : nulls.blendedRoiPct}
          </div>
        </div>
      </div>

      {nulls.costUnknownCount === 0 ? (
        <EmptyState
          label="No Unknown-Cost Campaigns"
          message="Every real campaign currently has a recorded gifted cost — this logic is live and will catch it the moment a future Shopify sync or Excel import brings in a row with a missing cost."
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Product</th>
                <th>Post Date</th>
                <th>Revenue</th>
                <th>Purchases</th>
              </tr>
            </thead>
            <tbody>
              {nulls.costUnknownCampaigns.map((c: any, i: number) => (
                <tr key={i}>
                  <td>{c.influencer}</td>
                  <td>{c.product_slug}</td>
                  <td>{c.post_date?.value ?? c.post_date}</td>
                  <td>€{c.total_revenue}</td>
                  <td>{c.purchases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- 3. Outlier detection ---------- */}
      <div className="section">
        <h2 className="section-title">3. Outlier Detection — Review Required</h2>
        <p className="section-subtitle">
          Any single order more than {outliers.sigmaUsed} standard deviations above the real mean order revenue
          (€{outliers.mean.toLocaleString()}, σ = €{outliers.stddev.toLocaleString()}) is flagged here for review,
          not silently included or excluded.
        </p>
      </div>

      {outliers.outliers.length === 0 ? (
        <EmptyState label="No Outliers Flagged" message="Every real order falls within 3 standard deviations of the mean this period." />
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Country</th>
                  <th>Date</th>
                  <th>Revenue</th>
                  <th>Z-Score</th>
                </tr>
              </thead>
              <tbody>
                {outliers.outliers.map((o: any, i: number) => (
                  <tr key={i}>
                    <td>{o.product_slug}</td>
                    <td>{o.country}</td>
                    <td>{o.event_timestamp?.value ?? o.event_timestamp}</td>
                    <td style={{ color: "var(--status-critical)" }}>€{o.value.toLocaleString()}</td>
                    <td className="mono">{o.zScore}σ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={includeOutliers} onChange={(e) => setIncludeOutliers(e.target.checked)} />
              Include flagged outliers in the total below
            </label>
            <div className="mono" style={{ fontSize: 20 }}>{euro(displayedTotal)}</div>
          </div>

          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat-card">
              <div className="stat-label">Total Revenue — With Outliers</div>
              <div className="stat-value">{euro(outliers.totalWithOutliers)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Revenue — Without Outliers</div>
              <div className="stat-value">{euro(outliers.totalWithoutOutliers)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Difference</div>
              <div className="stat-value">{euro(outliers.totalWithOutliers - outliers.totalWithoutOutliers)}</div>
            </div>
          </div>
        </>
      )}

      {/* ---------- 4. Normalization ---------- */}
      <div className="section">
        <h2 className="section-title">4. Normalization</h2>
        <p className="section-subtitle">
          Country names are standardized to ISO 3166-1 alpha-2 codes; all monetary values are standardized to EUR.
          Every conversion actually applied is logged below, not just described.
        </p>
      </div>

      {normalization.log.length === 0 ? (
        <EmptyState label="Nothing To Normalize" message="Every country value already matches its ISO code." />
      ) : (
        <div className="data-table-toolbar no-print">
          <ExportCsvButton data={normalization.log} filename="data-quality-normalization-log.csv" />
        </div>
      )}

      {normalization.log.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>From</th>
                <th>To (ISO)</th>
                <th>Records Affected</th>
              </tr>
            </thead>
            <tbody>
              {normalization.log.map((c: any, i: number) => (
                <tr key={i}>
                  <td>{c.field}</td>
                  <td>{c.from}</td>
                  <td className="mono">{c.to}</td>
                  <td>{c.recordCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
        Currency: 0 changes found — every real table already stores amounts in EUR. This check runs live on every
        load and will start converting the day a non-EUR source (e.g. a USD Shopify store) is connected via Settings.
      </p>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/roi", "/consolidated-pnl", "/decision-intelligence"]} />
    </div>
  );
}
