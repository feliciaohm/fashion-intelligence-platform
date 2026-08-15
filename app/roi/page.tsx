import Link from "next/link";
import { selfFetch } from "@/lib/self-fetch";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import DataQualityIndicator from "@/components/DataQualityIndicator";

async function getData() {
  const res = await selfFetch("/api/influencers", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch influencers");
  }

  return res.json();
}

// Same equal-count oldest-half/newest-half cohort split used elsewhere in
// this platform (Growth Bridge, Revenue Growth Decomposition) for real
// period-over-period comparisons on a dataset too small for calendar
// buckets to leave both sides with enough rows.
function splitByDate(rows: any[]) {
  const sorted = [...rows].sort((a, b) => {
    const da = a.post_date?.value ?? a.post_date;
    const db = b.post_date?.value ?? b.post_date;
    return da < db ? -1 : da > db ? 1 : 0;
  });
  const mid = Math.floor(sorted.length / 2);
  return { older: sorted.slice(0, mid), newer: sorted.slice(mid) };
}

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

export default async function Page() {
  const data = await getData();

  const totalRevenue = data.reduce((sum: number, r: any) => sum + (r.total_revenue || 0), 0);
  const avgRoi = data.length
    ? data.reduce((sum: number, r: any) => sum + (r.roi_pct || 0), 0) / data.length
    : 0;

  // data is already ORDER BY roi_pct DESC from the API -- first/last rows
  // are the real best/worst campaigns without any extra sorting here.
  const topCampaign = data[0];
  const worstCampaign = data[data.length - 1];

  const { older, newer } = splitByDate(data);
  const olderRevenue = older.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const newerRevenue = newer.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const olderAvgRoi = older.length ? older.reduce((s, r) => s + (r.roi_pct || 0), 0) / older.length : 0;
  const newerAvgRoi = newer.length ? newer.reduce((s, r) => s + (r.roi_pct || 0), 0) / newer.length : 0;
  const revenueDeltaPct = pctDelta(olderRevenue, newerRevenue);
  const roiDeltaPts = newerAvgRoi - olderAvgRoi;
  const campaignCountDelta = newer.length - older.length;

  const kpis: KpiItem[] = [
    {
      label: "Total Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier campaigns` : "no prior cohort to compare",
      direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
    },
    {
      label: "Average ROI",
      value: `${avgRoi.toFixed(1)}%`,
      delta: `${roiDeltaPts >= 0 ? "+" : ""}${roiDeltaPts.toFixed(1)} pts vs. earlier campaigns`,
      direction: roiDeltaPts >= 0 ? "good" : "critical",
    },
    {
      label: "Campaigns",
      value: `${data.length}`,
      delta: `${campaignCountDelta >= 0 ? "+" : ""}${campaignCountDelta} vs. earlier cohort`,
      direction: "neutral",
    },
  ];

  const headline = topCampaign
    ? `${topCampaign.influencer} generated ${topCampaign.roi_pct.toFixed(1)}% ROI on ${topCampaign.product_slug} — ${(topCampaign.roi_pct - avgRoi).toFixed(1)} points above the ${avgRoi.toFixed(1)}% platform average, the highest-performing campaign in the dataset.`
    : "No campaign data available.";

  const insightBoxText = worstCampaign && worstCampaign !== topCampaign
    ? `${worstCampaign.influencer}'s campaign on ${worstCampaign.product_slug} returned ${worstCampaign.roi_pct.toFixed(1)}% ROI, ${(avgRoi - worstCampaign.roi_pct).toFixed(1)} points below the platform average — worth reviewing before the next gifting cycle.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">People · Campaign Performance</div>
      <h1 className="page-title">Influencer ROI</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">Campaign Detail</h2>
        <p className="section-subtitle">Sorted by ROI, highest first</p>

        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="influencer-roi.csv" />
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Product</th>
                <th>Post Date</th>
                <th>Gifted Cost</th>
                <th>Purchases</th>
                <th>Revenue</th>
                <th>ROI %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, i: number) => (
                <tr key={i}>
                  <td>
                    <Link href={`/influencer/${row.influencer.toLowerCase().replace(/\s+/g, "-")}`}>
                      {row.influencer}
                    </Link>
                  </td>
                  <td>{row.product_slug}</td>
                  <td>{row.post_date?.value ?? row.post_date}</td>
                  <td>€{row.gifted_cost}</td>
                  <td>{row.purchases}</td>
                  <td>€{row.total_revenue}</td>
                  <td style={{ color: row.roi_pct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    {row.roi_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DataQualityIndicator dataPoints={data.length} />
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/influencers", "/scenario", "/decision-intelligence", "/data-quality"]} />
    </div>
  );
}
