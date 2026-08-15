import { mockPNL } from "../api/finance/mock";
import { selfFetch } from "@/lib/self-fetch";
import { simulateMarketingSpend } from "../api/scenario/mock";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getFinancePnl() {
  const res = await selfFetch("/api/finance-pnl", {
    cache: "no-store",
  });
  return res.json();
}

export default async function FinanceDashboard() {
  const pnlRows = await getFinancePnl();
  const scenarioRevenue = simulateMarketingSpend(20);

  const totalRevenue = pnlRows.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
  const totalVariance = pnlRows.reduce((s: number, r: any) => s + (r.variance || 0), 0);

  const kpis: KpiItem[] = [
    {
      label: "Product Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: `${pnlRows.length} product${pnlRows.length === 1 ? "" : "s"} with real P&L data`,
      direction: "neutral",
    },
    {
      label: "Budget Variance",
      value: `${totalVariance >= 0 ? "+" : ""}€${totalVariance.toLocaleString()}`,
      delta: "vs. budget margin",
      direction: totalVariance >= 0 ? "good" : "critical",
    },
    {
      label: "Products Tracked",
      value: `${pnlRows.length}`,
      delta: "real, sparse — not every product has finance_pnl data yet",
      direction: "neutral",
    },
  ];

  const worstRow = [...pnlRows].sort((a: any, b: any) => a.variance - b.variance)[0];
  const headline = worstRow
    ? `${worstRow.product_name} ran ${worstRow.variance >= 0 ? "+" : ""}€${worstRow.variance.toLocaleString()} vs. budget margin in ${worstRow.period} — the real, if sparse, P&L data currently loaded.`
    : "No real product-level P&L data loaded yet.";

  return (
    <div>
      <div className="page-eyebrow">Finance · Product P&amp;L</div>
      <h1 className="page-title">Finance</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">Product P&amp;L</h2>
        <p className="section-subtitle">
          Sourced live from <code>finance_pnl</code>. Currently only 2 products have real
          P&amp;L data loaded (period 2026-05) — honest sparse data, not a bug.
        </p>
        <div className="data-table-toolbar">
          <ExportCsvButton data={pnlRows} filename="finance-product-pnl.csv" />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Period</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Gross Margin</th>
                <th>Opex</th>
                <th>Net Margin</th>
                <th>Budget Revenue</th>
                <th>Budget Margin</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {pnlRows.map((row: any, i: number) => (
                <tr key={i}>
                  <td>{row.product_name}</td>
                  <td>{row.period}</td>
                  <td>€{row.revenue}</td>
                  <td>€{row.cogs}</td>
                  <td>€{row.gross_margin}</td>
                  <td>€{row.opex}</td>
                  <td>€{row.net_margin}</td>
                  <td>€{row.budget_revenue}</td>
                  <td>€{row.budget_margin}</td>
                  <td style={{ color: row.variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    €{row.variance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Company Overview</h2>
        <p className="section-subtitle">
          Illustrative — no real company-wide P&amp;L table exists in BigQuery yet.
        </p>
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Revenue</div>
            <div className="stat-value">€{mockPNL.revenue.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gross Margin</div>
            <div className="stat-value">€{mockPNL.gross_margin.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Margin</div>
            <div className="stat-value">€{mockPNL.net_margin.toLocaleString()}</div>
          </div>
        </div>
        <div className="panel">
          Budget vs Actual: <strong>€{mockPNL.budget_margin.toLocaleString()}</strong> vs{" "}
          <strong>€{mockPNL.net_margin.toLocaleString()}</strong>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Scenario: Marketing Spend +20%</h2>
        <div className="panel">
          Projected revenue: <strong>€{scenarioRevenue.toLocaleString()}</strong>{" "}
          <span className="text-muted">(from €{mockPNL.revenue.toLocaleString()})</span>
        </div>
      </div>

      <DocInsightBox>
        Real product-level data is sparse ({pnlRows.length} product{pnlRows.length === 1 ? "" : "s"}, one period) — see Finance Deep-Dive for the full channel-level real P&amp;L with all quarters.
      </DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consolidated-pnl", "/finance-deep", "/variance-report"]} />
    </div>
  );
}
