import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const MARGIN_THRESHOLD_PCT = 50;

async function getData() {
  const res = await selfFetch("/api/product-lifecycle", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch product lifecycle");
  return res.json();
}

export default async function ProductLifecyclePage() {
  const data = await getData();

  const avgRetailMargin = data.reduce((s: number, r: any) => s + r.retail_margin_pct, 0) / data.length;
  const avgWholesaleMargin = data.reduce((s: number, r: any) => s + r.wholesale_margin_pct, 0) / data.length;
  const totalDirectRevenue = data.reduce((s: number, r: any) => s + r.revenue_direct, 0);

  const bySeasonMap: Record<string, { revenue: number; units: number }> = {};
  data.forEach((r: any) => {
    if (!bySeasonMap[r.season]) bySeasonMap[r.season] = { revenue: 0, units: 0 };
    bySeasonMap[r.season].revenue += r.revenue_direct;
    bySeasonMap[r.season].units += r.units_sold_direct;
  });
  const bySeasonRows = Object.entries(bySeasonMap).map(([season, v]) => ({ season, ...v }));

  const kpis: KpiItem[] = [
    {
      label: "Direct-Channel Revenue",
      value: `€${totalDirectRevenue.toLocaleString()}`,
      delta: `across ${data.length} products tracked`,
      direction: "neutral",
    },
    {
      label: "Avg. Retail Margin",
      value: `${avgRetailMargin.toFixed(1)}%`,
      delta: `vs. ${MARGIN_THRESHOLD_PCT}% margin threshold`,
      direction: avgRetailMargin >= MARGIN_THRESHOLD_PCT ? "good" : "critical",
    },
    {
      label: "Avg. Wholesale Margin",
      value: `${avgWholesaleMargin.toFixed(1)}%`,
      delta: `${(avgRetailMargin - avgWholesaleMargin).toFixed(1)} pts below retail margin`,
      direction: "neutral",
    },
  ];

  const byRevenue = [...data].sort((a: any, b: any) => b.revenue_direct - a.revenue_direct);
  const topProduct = byRevenue[0];
  const belowThreshold = [...data].filter((r: any) => r.retail_margin_pct < MARGIN_THRESHOLD_PCT).sort((a: any, b: any) => a.retail_margin_pct - b.retail_margin_pct);
  const weakestMarginProduct = belowThreshold[0];

  const headline = topProduct
    ? `${topProduct.product_name} is the top direct-channel seller — €${topProduct.revenue_direct.toLocaleString()} revenue at a ${topProduct.retail_margin_pct}% retail margin.`
    : "No product lifecycle data available.";

  const insightBoxText = weakestMarginProduct && weakestMarginProduct.product_slug !== topProduct?.product_slug
    ? `${weakestMarginProduct.product_name} sits at a ${weakestMarginProduct.retail_margin_pct}% retail margin, below the ${MARGIN_THRESHOLD_PCT}% threshold — worth a pricing review this season.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Product Lifecycle</div>
      <h1 className="page-title">Product Lifecycle</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">By Season</h2>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={bySeasonRows} filename="product-lifecycle-by-season.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>Units Sold (Direct)</th>
              <th>Revenue (Direct)</th>
            </tr>
          </thead>
          <tbody>
            {bySeasonRows.map((v) => (
              <tr key={v.season}>
                <td>{v.season}</td>
                <td>{v.units}</td>
                <td>€{v.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Best Sellers</h2>
        <p className="section-subtitle">Ranked by direct-channel revenue</p>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={data} filename="product-lifecycle.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Season</th>
              <th>Cost</th>
              <th>Wholesale</th>
              <th>Retail</th>
              <th>Retail Margin</th>
              <th>Wholesale Margin</th>
              <th>Units Sold</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.product_slug}>
                <td>{r.product_name}</td>
                <td>{r.category}</td>
                <td>{r.season}</td>
                <td>€{r.cost_price}</td>
                <td>€{r.wholesale_price}</td>
                <td>€{r.retail_price}</td>
                <td>{r.retail_margin_pct}%</td>
                <td>{r.wholesale_margin_pct}%</td>
                <td>{r.units_sold_direct}</td>
                <td>€{r.revenue_direct.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/products", "/suppliers", "/finance-deep"]} />
    </div>
  );
}
