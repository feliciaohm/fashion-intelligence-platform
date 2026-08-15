import Link from "next/link";
import { selfFetch } from "@/lib/self-fetch";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import EmptyState from "@/components/EmptyState";

async function getData(country?: string) {
  const url = country
    ? `/api/influencer-summary?country=${encodeURIComponent(country)}`
    : "/api/influencer-summary";
  const res = await selfFetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to fetch influencer summary");
  }

  return res.json();
}

async function getCountries() {
  const res = await selfFetch("/api/countries", { cache: "no-store" });
  return res.json();
}

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const [data, countries] = await Promise.all([getData(country), getCountries()]);

  const totalRevenue = data.reduce((s: number, r: any) => s + (r.total_revenue || 0), 0);
  const avgRoi = data.length ? data.reduce((s: number, r: any) => s + (r.avg_roi_pct || 0), 0) / data.length : 0;

  const kpis: KpiItem[] = [
    {
      label: "Influencers",
      value: `${data.length}`,
      delta: country ? `filtered to ${country}` : "all markets",
      direction: "neutral",
    },
    {
      label: "Total Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: "across all influencers",
      direction: "neutral",
    },
    {
      label: "Avg. ROI",
      value: `${avgRoi.toFixed(1)}%`,
      delta: `${avgRoi >= 0 ? "above" : "below"} breakeven (0%)`,
      direction: avgRoi >= 0 ? "good" : "critical",
    },
  ];

  const byRevenue = [...data].sort((a: any, b: any) => (b.total_revenue || 0) - (a.total_revenue || 0));
  const topRevenue = byRevenue[0];
  const byRoi = [...data].sort((a: any, b: any) => (b.avg_roi_pct || 0) - (a.avg_roi_pct || 0));
  const topRoi = byRoi[0];

  const headline = topRevenue
    ? `${topRevenue.influencer} generated the most revenue — €${topRevenue.total_revenue.toLocaleString()} across ${topRevenue.campaign_count} campaigns.`
    : "No influencer data found for this market.";

  const insightBoxText = topRoi && topRoi.influencer !== topRevenue?.influencer
    ? `${topRoi.influencer} has the highest average ROI at ${topRoi.avg_roi_pct}% — the strongest per-campaign return in the roster.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">People · Influencer Roster</div>
      <h1 className="page-title">Influencers</h1>
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
          <a href="/influencers" className="text-muted" style={{ fontSize: 13 }}>
            Clear
          </a>
        )}
      </form>

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="influencers.csv" />
        </div>
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Influencer</th>
              <th>Campaigns</th>
              <th>Products</th>
              <th>Platforms</th>
              <th>Gifted Cost</th>
              <th>Purchases</th>
              <th>Revenue</th>
              <th>Avg ROI %</th>
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
                <td>{row.campaign_count}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 260 }}>{row.products}</td>
                <td>{row.platforms}</td>
                <td>€{row.total_gifted_cost}</td>
                <td>{row.total_purchases}</td>
                <td>€{row.total_revenue}</td>
                <td style={{ color: row.avg_roi_pct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {row.avg_roi_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <EmptyState
            label="No Results"
            message="No campaigns found for this market — try clearing the filter or choosing a different one."
          />
        )}
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/roi", "/scenario", "/customer-journey"]} />
    </div>
  );
}
