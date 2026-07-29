"use client";

import { useMemo, useState, useEffect } from "react";
import useSWR from "swr";
import KPIcard from "@/components/KPICard";
import RevenueChart from "@/components/RevenueChart";
import ProductChart from "@/components/ProductChart";
import CountryChart from "@/components/CountryChart";
import SearchBar from "@/components/SearchBar";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function dateOf(r: any): string {
  return r.post_date?.value ?? r.post_date ?? "";
}

// Same equal-count oldest-half/newest-half cohort split used on /roi and
// elsewhere in this platform for real period-over-period comparisons on a
// dataset too small for calendar buckets to leave both sides with enough rows.
function splitByDate(rows: any[]) {
  const sorted = [...rows].sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  return { older: sorted.slice(0, mid), newer: sorted.slice(mid) };
}

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

export default function Dashboard() {
  const { data: journey } = useSWR("/api/influencer-journey", fetcher);
  const { data: products } = useSWR("/api/products", fetcher);
  const { data: productPerformance } = useSWR("/api/product-performance", fetcher);
  const { data: countries } = useSWR("/api/countries", fetcher);

  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (journey && !loadedAt) setLoadedAt(new Date());
  }, [journey, loadedAt]);

  const totals = (journey ?? []).reduce(
    (acc: any, r: any) => ({
      firstVisitors: acc.firstVisitors + (r.first_visitors_48h || 0),
      returnVisitors: acc.returnVisitors + (r.return_visitors || 0),
      purchases: acc.purchases + (r.purchases || 0),
      revenue: acc.revenue + (r.revenue_attributed || 0),
    }),
    { firstVisitors: 0, returnVisitors: 0, purchases: 0, revenue: 0 }
  );
  const returnRate = totals.firstVisitors
    ? (totals.returnVisitors / totals.firstVisitors) * 100
    : 0;

  const { kpis, headline, insightBoxText } = useMemo(() => {
    const rows: any[] = journey ?? [];
    if (rows.length === 0) {
      return { kpis: [] as KpiItem[], headline: "Loading real journey data from BigQuery…", insightBoxText: "" };
    }

    const { older, newer } = splitByDate(rows);
    const agg = (set: any[]) =>
      set.reduce(
        (acc, r) => ({
          firstVisitors: acc.firstVisitors + (r.first_visitors_48h || 0),
          returnVisitors: acc.returnVisitors + (r.return_visitors || 0),
          revenue: acc.revenue + (r.revenue_attributed || 0),
        }),
        { firstVisitors: 0, returnVisitors: 0, revenue: 0 }
      );
    const olderAgg = agg(older);
    const newerAgg = agg(newer);
    const olderRate = olderAgg.firstVisitors ? (olderAgg.returnVisitors / olderAgg.firstVisitors) * 100 : 0;
    const newerRate = newerAgg.firstVisitors ? (newerAgg.returnVisitors / newerAgg.firstVisitors) * 100 : 0;

    const visitorsDeltaPct = pctDelta(olderAgg.firstVisitors, newerAgg.firstVisitors);
    const rateDeltaPts = newerRate - olderRate;
    const revenueDeltaPct = pctDelta(olderAgg.revenue, newerAgg.revenue);

    const kpis: KpiItem[] = [
      {
        label: "First Visitors (48h)",
        value: totals.firstVisitors.toLocaleString(),
        delta: visitorsDeltaPct !== null ? `${visitorsDeltaPct >= 0 ? "+" : ""}${visitorsDeltaPct.toFixed(1)}% vs. earlier campaigns` : "no prior cohort to compare",
        direction: visitorsDeltaPct === null ? "neutral" : visitorsDeltaPct >= 0 ? "good" : "critical",
      },
      {
        label: "Return Rate",
        value: `${returnRate.toFixed(1)}%`,
        delta: `${rateDeltaPts >= 0 ? "+" : ""}${rateDeltaPts.toFixed(1)} pts vs. earlier campaigns`,
        direction: rateDeltaPts >= 0 ? "good" : "critical",
      },
      {
        label: "Revenue Attributed",
        value: `€${totals.revenue.toLocaleString()}`,
        delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier campaigns` : "no prior cohort to compare",
        direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
      },
    ];

    const topByReturnRate = [...rows].sort((a, b) => (b.return_rate_pct || 0) - (a.return_rate_pct || 0))[0];
    const topByRevenue = [...rows].sort((a, b) => (b.revenue_attributed || 0) - (a.revenue_attributed || 0))[0];

    const headline = topByReturnRate
      ? `${topByReturnRate.influencer}'s ${topByReturnRate.product_slug} campaign converted ${topByReturnRate.return_rate_pct}% of first-touch visitors into return visits — the highest return rate of any tracked campaign.`
      : "No campaign data available.";

    const insightBoxText = topByRevenue && topByRevenue !== topByReturnRate
      ? `${topByRevenue.influencer}'s ${topByRevenue.product_slug} campaign attributed €${topByRevenue.revenue_attributed.toLocaleString()} in revenue — the single largest revenue contribution in the journey funnel.`
      : headline;

    return { kpis, headline, insightBoxText };
  }, [journey, totals.firstVisitors, totals.revenue, returnRate]);

  return (
    <div>
      <div className="page-eyebrow">Overview · Journey Analytics</div>
      <h1 className="page-title">Dashboard</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section">
        <SearchBar />
      </div>

      <div className="section">
        <h2 className="section-title">Post → Visitor → Return → Purchase</h2>
        <p className="section-subtitle">
          Every gifted post tracked from first-touch visitor (within 48h) through return
          visits to purchase, by anonymous visitor ID — sourced live from BigQuery.
        </p>

        <div className="data-table-toolbar">
          <ExportCsvButton data={journey ?? []} filename="influencer-journey.csv" />
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Product</th>
                <th>Post Date</th>
                <th>First Visitors (48h)</th>
                <th>Return Visitors</th>
                <th>Return Rate</th>
                <th>Purchases</th>
                <th>Revenue Attributed</th>
                <th>ROI %</th>
              </tr>
            </thead>
            <tbody>
              {(journey ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.influencer}</td>
                  <td>{r.product_slug}</td>
                  <td>{r.post_date?.value ?? r.post_date}</td>
                  <td>{r.first_visitors_48h}</td>
                  <td>{r.return_visitors}</td>
                  <td>{r.return_rate_pct}%</td>
                  <td>{r.purchases}</td>
                  <td>€{r.revenue_attributed}</td>
                  <td style={{ color: r.roi_pct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    {r.roi_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Company Snapshot</h2>
        <div className="stat-grid">
          <KPIcard label="Products" value={products?.length ?? 0} />
          <KPIcard label="Countries" value={countries?.length ?? 0} />
          <KPIcard
            label="Total Product Revenue"
            value={`€${(productPerformance?.reduce((a: number, b: any) => a + (b.total_revenue_events ?? 0), 0) ?? 0).toLocaleString()}`}
          />
          <KPIcard label="AI Insights" value="Ready" />
        </div>
      </div>

      <div className="section" style={{ display: "grid", gap: 24 }}>
        <RevenueChart />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <ProductChart data={productPerformance} />
          <CountryChart data={countries} />
        </div>
      </div>

      {insightBoxText && <DocInsightBox>{insightBoxText}</DocInsightBox>}
      {loadedAt && <DocFooterNote timestamp={formatTimestamp(loadedAt)} />}

      <RelatedPages hrefs={["/roi", "/customer-journey", "/intelligence"]} />
    </div>
  );
}
