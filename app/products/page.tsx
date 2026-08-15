import ProductsTable from "../../components/ProductsTable";
import { selfFetch } from "@/lib/self-fetch";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import DataQualityIndicator from "@/components/DataQualityIndicator";

async function getData(country?: string) {
  const url = country
    ? `/api/products?country=${encodeURIComponent(country)}`
    : "/api/products";
  const res = await selfFetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to fetch products");
  }

  return res.json();
}

async function getCountries() {
  const res = await selfFetch("/api/countries", { cache: "no-store" });
  return res.json();
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const [data, countries] = await Promise.all([getData(country), getCountries()]);

  const combinedRevenue = data.reduce((s: number, p: any) => s + (p.retail_revenue || 0) + (p.ecommerce_revenue || 0), 0);
  const withInfluencerRoi = data.filter((p: any) => p.influencer_roi != null);
  const avgInfluencerRoi = withInfluencerRoi.length
    ? withInfluencerRoi.reduce((s: number, p: any) => s + p.influencer_roi, 0) / withInfluencerRoi.length
    : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Products",
      value: `${data.length}`,
      delta: "full catalogue, live from BigQuery",
      direction: "neutral",
    },
    {
      label: "Combined Revenue",
      value: `€${combinedRevenue.toLocaleString()}`,
      delta: "retail + ecommerce combined",
      direction: "neutral",
    },
    {
      label: "Avg. Influencer ROI",
      value: withInfluencerRoi.length ? `${avgInfluencerRoi.toFixed(1)}%` : "n/a",
      delta: withInfluencerRoi.length ? `${avgInfluencerRoi >= 0 ? "above" : "below"} breakeven (0%)` : `${data.length - withInfluencerRoi.length} products with no campaign`,
      direction: !withInfluencerRoi.length ? "neutral" : avgInfluencerRoi >= 0 ? "good" : "critical",
    },
  ];

  const byRevenue = [...data].sort(
    (a: any, b: any) => (b.retail_revenue || 0) + (b.ecommerce_revenue || 0) - ((a.retail_revenue || 0) + (a.ecommerce_revenue || 0))
  );
  const topRevenueProduct = byRevenue[0];
  const byRoi = [...withInfluencerRoi].sort((a: any, b: any) => b.influencer_roi - a.influencer_roi);
  const topRoiProduct = byRoi[0];

  const headline = topRevenueProduct
    ? `${topRevenueProduct.product_name} is the top-performing product — €${((topRevenueProduct.retail_revenue || 0) + (topRevenueProduct.ecommerce_revenue || 0)).toLocaleString()} combined retail and ecommerce revenue.`
    : "No product data available.";

  const insightBoxText = topRoiProduct && topRoiProduct.product_slug !== topRevenueProduct?.product_slug
    ? `${topRoiProduct.product_name} has the highest influencer ROI in the catalogue at ${topRoiProduct.influencer_roi}% — the strongest candidate for another gifting cycle.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Product Catalogue</div>
      <h1 className="page-title">Products</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <form method="get" className="section" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label htmlFor="country" style={{ fontSize: 13, fontWeight: 600 }}>Market</label>
        <select id="country" name="country" defaultValue={country ?? ""}>
          <option value="">All markets</option>
          {countries.map((c: any) => (
            <option key={c.country} value={c.country}>{c.country}</option>
          ))}
        </select>
        <button type="submit" className="btn">Filter</button>
        {country && (
          <a href="/products" className="text-muted" style={{ fontSize: 13 }}>
            Clear
          </a>
        )}
      </form>

      <div className="section">
        <ProductsTable data={data} />
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DataQualityIndicator dataPoints={data.length} />
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/product-lifecycle", "/pricing", "/wholesale"]} />
    </div>
  );
}
