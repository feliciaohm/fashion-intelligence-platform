import RelatedPages from "@/components/RelatedPages";
import { selfFetch } from "@/lib/self-fetch";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import EmptyState from "@/components/EmptyState";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const res = await selfFetch(`/api/products/${slug}`, {
    cache: "no-store",
  });
  const product = await res.json();

  if (!product) {
    return (
      <div>
        <div className="page-eyebrow">Commerce · Product Detail</div>
        <h1 className="page-title">Product Not Found</h1>
        <EmptyState
          label="No Results"
          message={`No product matches "${slug}" — try the Products list to find the correct one, or check the URL for a typo.`}
        />
        <RelatedPages hrefs={["/products", "/product-lifecycle", "/pricing"]} />
      </div>
    );
  }

  const combinedRevenue = (product.retail_revenue || 0) + (product.ecommerce_revenue || 0);
  const kpis: KpiItem[] = [
    {
      label: "Retail Revenue",
      value: product.retail_revenue ? `€${product.retail_revenue}` : "—",
      delta: "in-store, live from BigQuery",
      direction: "neutral",
    },
    {
      label: "Ecommerce Revenue",
      value: product.ecommerce_revenue ? `€${product.ecommerce_revenue}` : "—",
      delta: "direct-to-consumer online",
      direction: "neutral",
    },
    {
      label: "Influencer ROI",
      value: product.influencer_roi != null ? `${product.influencer_roi}%` : "n/a",
      delta: product.influencer_roi != null ? `${product.influencer_roi >= 0 ? "above" : "below"} breakeven (0%)` : "no campaign for this product",
      direction: product.influencer_roi == null ? "neutral" : product.influencer_roi >= 0 ? "good" : "critical",
    },
  ];

  const headline = `${product.product_name} generated €${combinedRevenue.toLocaleString()} combined retail and ecommerce revenue${product.influencer_roi != null ? `, at a ${product.influencer_roi}% influencer ROI` : ""}.`;
  const insightBoxText = product.influencer_name
    ? `${product.influencer_name} drove ${product.influencer_purchases ?? 0} purchases of this product on ${product.influencer_platform ?? "an unspecified platform"}, attributing €${product.influencer_revenue ?? 0} in revenue.`
    : `No influencer campaign is attributed to ${product.product_name} — its revenue so far is entirely retail and ecommerce.`;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Product Detail</div>
      <h1 className="page-title">{product.product_name}</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 16, marginBottom: 14 }}>Details</h2>
          <dl style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Category</span><span>{product.category}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Color</span><span>{product.color}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Material</span><span>{product.material}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Collection</span><span>{product.collection}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Price</span><span>€{product.price}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Stock</span><span>{product.stock_level ?? "—"}</span>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2 className="section-title" style={{ fontSize: 16, marginBottom: 14 }}>Influencer Attribution</h2>
          <dl style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Influencer</span><span>{product.influencer_name ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Platform</span><span>{product.influencer_platform ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Content type</span><span>{product.influencer_content_type ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Country</span><span>{product.influencer_country ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Revenue</span><span>{product.influencer_revenue ? `€${product.influencer_revenue}` : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">Purchases</span><span>{product.influencer_purchases ?? "—"}</span>
            </div>
          </dl>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/products", "/product-lifecycle", "/pricing"]} />
    </div>
  );
}
