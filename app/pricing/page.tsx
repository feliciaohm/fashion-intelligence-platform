import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import PrintButton from "@/components/PrintButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await selfFetch("/api/pricing", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch pricing intelligence");
  return res.json();
}

export default async function PricingPage() {
  const { marginThresholdPct, recentMonths, products } = await getData();

  const belowThreshold = products.filter((p: any) => p.below_threshold);
  const avgRetailMargin =
    products.reduce((s: number, p: any) => s + p.retail_margin_pct, 0) / products.length;

  const exportRows = products.map((p: any) => {
    const row: Record<string, unknown> = {
      product_slug: p.product_slug,
      product_name: p.product_name,
      category: p.category,
      season: p.season,
      cost_price: p.cost_price,
      wholesale_price: p.wholesale_price,
      retail_price: p.retail_price,
      retail_margin_pct: p.retail_margin_pct,
      wholesale_margin_pct: p.wholesale_margin_pct,
      below_threshold: p.below_threshold,
    };
    p.trend.forEach((t: any) => {
      row[`revenue_${t.month}`] = t.revenue;
    });
    return row;
  });

  const sortedByMargin = [...products].sort((a: any, b: any) => a.retail_margin_pct - b.retail_margin_pct);
  const weakestProduct = sortedByMargin[0];

  const kpis: KpiItem[] = [
    {
      label: "Products Tracked",
      value: `${products.length}`,
      delta: "full catalogue, live from BigQuery",
      direction: "neutral",
    },
    {
      label: "Avg. Retail Margin",
      value: `${avgRetailMargin.toFixed(1)}%`,
      delta: `vs. ${marginThresholdPct}% margin threshold`,
      direction: avgRetailMargin >= marginThresholdPct ? "good" : "critical",
    },
    {
      label: `Below ${marginThresholdPct}% Threshold`,
      value: `${belowThreshold.length}`,
      delta: `of ${products.length} products`,
      direction: belowThreshold.length > 0 ? "critical" : "good",
    },
  ];

  const headline = belowThreshold.length > 0 && weakestProduct
    ? `${weakestProduct.product_name} has the thinnest margin in the catalogue at ${weakestProduct.retail_margin_pct}%, below the ${marginThresholdPct}% threshold.`
    : `All ${products.length} tracked products sit at or above the ${marginThresholdPct}% retail margin threshold — no pricing flags this period.`;

  const insightBoxText = belowThreshold.length > 1
    ? `${belowThreshold.length} products are currently priced below the ${marginThresholdPct}% margin threshold — see the flagged list below for the full set worth a pricing review.`
    : `Average retail margin across the catalogue is ${avgRetailMargin.toFixed(1)}%, based on real monthly revenue trend data for ${recentMonths.join(", ")}.`;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Pricing Intelligence</div>
      <div className="page-meta no-print">
        <span>Pricing Intelligence</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Pricing Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      {belowThreshold.length > 0 && (
        <div className="section">
          <h2 className="section-title">Flagged — Below Margin Threshold</h2>
          <p className="section-subtitle">
            Retail margin under {marginThresholdPct}% — candidates for a price or cost review
          </p>
          <div className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {belowThreshold.map((p: any) => (
              <span key={p.product_slug} className="badge" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}>
                {p.product_name} — {p.retail_margin_pct}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Price &amp; Margin by Product</h2>
        <p className="section-subtitle">
          Recent monthly revenue trend: {recentMonths.join(", ")}
        </p>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={exportRows} filename="pricing-intelligence.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Cost</th>
              <th>Wholesale</th>
              <th>Retail</th>
              <th>Retail Margin</th>
              <th>Wholesale Margin</th>
              {recentMonths.map((m: string) => (
                <th key={m}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.product_slug}>
                <td>{p.product_name}</td>
                <td>{p.category}</td>
                <td>€{p.cost_price}</td>
                <td>€{p.wholesale_price}</td>
                <td>€{p.retail_price}</td>
                <td style={{ color: p.below_threshold ? "var(--status-critical)" : "var(--color-ink)" }}>
                  {p.retail_margin_pct}%
                </td>
                <td>{p.wholesale_margin_pct}%</td>
                {p.trend.map((t: any) => (
                  <td key={t.month}>€{t.revenue.toLocaleString()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/product-lifecycle", "/products", "/decision-intelligence"]} />
    </div>
  );
}
