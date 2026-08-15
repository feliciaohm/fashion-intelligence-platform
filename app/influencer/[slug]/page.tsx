import KPICard from "@/components/KPICard";
import { selfFetch } from "@/lib/self-fetch";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import EmptyState from "@/components/EmptyState";
import DataQualityIndicator from "@/components/DataQualityIndicator";

function dateOf(p: any): string {
  return p.post_date?.value ?? p.post_date ?? "";
}

function splitByDate(rows: any[]) {
  const sorted = [...rows].sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  return { older: sorted.slice(0, mid), newer: sorted.slice(mid) };
}

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

export default async function InfluencerDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ");

  const res = await selfFetch(`/api/influencer/${slug}`, {
    cache: "no-store",
  });
  const posts = await res.json();

  const totalRevenue = posts.reduce((sum: number, p: any) => sum + (p.total_revenue || 0), 0);
  const totalGiftedCost = posts.reduce((sum: number, p: any) => sum + (p.gifted_cost || 0), 0);
  const totalPurchases = posts.reduce((sum: number, p: any) => sum + (p.purchases || 0), 0);
  const roiPct = totalGiftedCost > 0
    ? Math.round(((totalRevenue - totalGiftedCost) / totalGiftedCost) * 1000) / 10
    : 0;

  const { older, newer } = splitByDate(posts);
  const olderRevenue = older.reduce((s: number, p: any) => s + (p.total_revenue || 0), 0);
  const newerRevenue = newer.reduce((s: number, p: any) => s + (p.total_revenue || 0), 0);
  const revenueDeltaPct = pctDelta(olderRevenue, newerRevenue);
  const purchaseDelta = newer.reduce((s: number, p: any) => s + (p.purchases || 0), 0) - older.reduce((s: number, p: any) => s + (p.purchases || 0), 0);

  const kpis: KpiItem[] = [
    {
      label: "Total Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier posts` : "no prior post to compare",
      direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
    },
    {
      label: "ROI %",
      value: `${roiPct}%`,
      delta: `${roiPct >= 0 ? "above" : "below"} breakeven (0%)`,
      direction: roiPct >= 0 ? "good" : "critical",
    },
    {
      label: "Purchases",
      value: `${totalPurchases}`,
      delta: `${purchaseDelta >= 0 ? "+" : ""}${purchaseDelta} vs. earlier posts`,
      direction: "neutral",
    },
  ];

  const sortedByRoi = [...posts].sort((a: any, b: any) => (b.roi_pct || 0) - (a.roi_pct || 0));
  const bestPost = sortedByRoi[0];
  const worstPost = sortedByRoi[sortedByRoi.length - 1];

  const headline = bestPost
    ? `${name}'s highest-ROI post was on ${bestPost.product_slug} — ${bestPost.roi_pct}% ROI, €${bestPost.total_revenue.toLocaleString()} revenue from €${bestPost.gifted_cost.toLocaleString()} gifted.`
    : `No campaign data found for ${name}.`;

  const insightBoxText = worstPost && worstPost !== bestPost
    ? `${name}'s weakest post was on ${worstPost.product_slug} at ${worstPost.roi_pct}% ROI — worth reviewing content type and platform fit against the stronger posts above.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">People · Influencer Detail</div>
      <h1 className="page-title" style={{ textTransform: "capitalize" }}>{name}</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {posts.length > 0 && <KpiStrip items={kpis} />}

      <div className="section">
        <h2 className="section-title">Posts</h2>
        {posts.length === 0 ? (
          <EmptyState
            label="No Results"
            message={`No campaigns found for "${name}" — check the spelling, or go to Influencer ROI to browse the full roster.`}
          />
        ) : (
          <>
            <div className="data-table-toolbar">
              <ExportCsvButton data={posts} filename={`${slug}-posts.csv`} />
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Platform</th>
                    <th>Content Type</th>
                    <th>Country</th>
                    <th>Post Date</th>
                    <th>Gifted Cost</th>
                    <th>Purchases</th>
                    <th>Revenue</th>
                    <th>ROI %</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p: any, i: number) => (
                    <tr key={i}>
                      <td>{p.product_slug}</td>
                      <td>{p.platform}</td>
                      <td>{p.content_type}</td>
                      <td>{p.country}</td>
                      <td>{p.post_date?.value ?? p.post_date}</td>
                      <td>€{p.gifted_cost}</td>
                      <td>{p.purchases}</td>
                      <td>€{p.total_revenue}</td>
                      <td style={{ color: p.roi_pct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                        {p.roi_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {posts.length > 0 && (
        <>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DataQualityIndicator dataPoints={posts.length} />
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}

      <RelatedPages hrefs={["/influencers", "/roi", "/scenario"]} />
    </div>
  );
}
