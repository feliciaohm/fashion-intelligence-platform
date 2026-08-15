import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData(path: string) {
  const res = await selfFetch(path, { cache: "no-store" });
  return res.json();
}

export default async function MasterViewsPage() {
  const [productPerformance, influencerRoi, marketPerformance, financialHealth] = await Promise.all([
    getData("/api/master/product-performance"),
    getData("/api/master/influencer-roi"),
    getData("/api/master/market-performance"),
    getData("/api/master/financial-health"),
  ]);

  // Every number on this page comes from lib/masterViews.ts, which is a
  // mock-data implementation of the 4 target views documented in
  // sql/schema.sql -- none of it is queried from real BigQuery tables (see
  // DATA_AUDIT.md). Every KPI/headline/insight below is deliberately kept
  // neutral and labeled "illustrative" so this never reads as a real finding.
  const totalProductRevenue = productPerformance.reduce((s: number, r: any) => s + (r.shopify_revenue || 0) + (r.retail_revenue || 0), 0);
  const totalInfluencerRevenue = influencerRoi.reduce((s: number, r: any) => s + (r.attributed_revenue || 0), 0);
  const latestFinancial = [...financialHealth].sort((a: any, b: any) => (a.period < b.period ? 1 : -1))[0];

  const kpis: KpiItem[] = [
    {
      label: "Total Product Revenue (Illustrative)",
      value: `€${totalProductRevenue.toLocaleString()}`,
      delta: "mock data, not from BigQuery",
      direction: "neutral",
    },
    {
      label: "Total Influencer Revenue (Illustrative)",
      value: `€${totalInfluencerRevenue.toLocaleString()}`,
      delta: "mock data, not from BigQuery",
      direction: "neutral",
    },
    {
      label: latestFinancial ? `Net Margin (Illustrative, ${latestFinancial.period})` : "Net Margin (Illustrative)",
      value: latestFinancial ? `€${latestFinancial.net_margin.toLocaleString()}` : "n/a",
      delta: "mock data, not from BigQuery",
      direction: "neutral",
    },
  ];

  const topMarket = [...marketPerformance].sort((a: any, b: any) => ((b.retail_revenue || 0) + (b.shopify_revenue || 0)) - ((a.retail_revenue || 0) + (a.shopify_revenue || 0)))[0];

  const headline = "These 4 views are mock-data demo implementations of the target BigQuery view design in sql/schema.sql — not connected to real data yet.";
  const insightBoxText = topMarket
    ? `In the illustrative Market Performance view, ${topMarket.country} shows the highest combined figure — a demo of what this view will surface once it's backed by real BigQuery tables.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Master Views</div>
      <h1 className="page-title">Master Views</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">Product Performance Master</h2>
        <div className="data-table-toolbar">
          <ExportCsvButton data={productPerformance} filename="master-product-performance.csv" />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Shopify Revenue</th>
                <th>Retail Revenue</th>
                <th>Inventory</th>
                <th>Influencer Spend</th>
              </tr>
            </thead>
            <tbody>
              {productPerformance.map((row: any, i: number) => (
                <tr key={i}>
                  <td>{row.product_slug}</td>
                  <td>€{row.shopify_revenue}</td>
                  <td>€{row.retail_revenue}</td>
                  <td>{row.total_inventory}</td>
                  <td>€{row.influencer_spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Influencer ROI Master</h2>
        <div className="data-table-toolbar">
          <ExportCsvButton data={influencerRoi} filename="master-influencer-roi.csv" />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Product</th>
                <th>Gifted Cost</th>
                <th>Purchases</th>
                <th>Attributed Revenue</th>
                <th>Avg Customer LTV</th>
                <th>ROI %</th>
              </tr>
            </thead>
            <tbody>
              {influencerRoi.map((row: any, i: number) => (
                <tr key={i}>
                  <td>{row.influencer_name}</td>
                  <td>{row.product_slug}</td>
                  <td>€{row.gifted_cost}</td>
                  <td>{row.purchases}</td>
                  <td>€{row.attributed_revenue}</td>
                  <td>€{row.avg_customer_ltv}</td>
                  <td>{row.roi_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Market Performance Master</h2>
        <div className="data-table-toolbar">
          <ExportCsvButton data={marketPerformance} filename="master-market-performance.csv" />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Market Region</th>
                <th>Retail Revenue</th>
                <th>Shopify Revenue</th>
              </tr>
            </thead>
            <tbody>
              {marketPerformance.map((row: any, i: number) => (
                <tr key={i}>
                  <td>{row.country}</td>
                  <td>{row.market_region}</td>
                  <td>€{row.retail_revenue}</td>
                  <td>€{row.shopify_revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Financial Health Master</h2>
        <div className="data-table-toolbar">
          <ExportCsvButton data={financialHealth} filename="master-financial-health.csv" />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Revenue</th>
                <th>Gross Margin</th>
                <th>Opex</th>
                <th>Store Costs</th>
                <th>Net Margin</th>
                <th>Budget Margin</th>
              </tr>
            </thead>
            <tbody>
              {financialHealth.map((row: any, i: number) => (
                <tr key={i}>
                  <td>{row.period}</td>
                  <td>€{row.revenue}</td>
                  <td>€{row.gross_margin}</td>
                  <td>€{row.opex}</td>
                  <td>€{row.store_costs}</td>
                  <td>€{row.net_margin}</td>
                  <td>€{row.budget_margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/explore", "/finance-deep", "/products"]} />
    </div>
  );
}
