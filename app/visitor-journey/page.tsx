import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import VisitorJourneyExplorer from "@/components/VisitorJourneyExplorer";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import {
  getPostVisitorSummaries,
  getAllVisitorJourneys,
  getOverallVisitorStats,
  ATTRIBUTION_WINDOW_HOURS,
} from "@/lib/visitor-journey-server";

// Calls the server functions directly instead of fetch()-ing this page's own
// /api/visitor-journey route. A self-fetch over HTTP from inside a Server
// Component doesn't carry the browser's session cookie, so proxy.ts's auth
// gate rejects it with a 401 -- confirmed directly (curling the route
// without a session returns exactly that). Calling the same functions the
// route itself calls, in-process, sidesteps the cookie problem entirely and
// is also just faster (no extra HTTP round-trip to itself).
async function getData() {
  const [summaries, journeys, overall] = await Promise.all([
    getPostVisitorSummaries(),
    getAllVisitorJourneys(),
    getOverallVisitorStats(),
  ]);
  return { summaries, journeys, overall, attributionWindowHours: ATTRIBUTION_WINDOW_HOURS };
}

export default async function VisitorJourneyPage() {
  const { summaries, journeys, overall, attributionWindowHours } = await getData();

  const totalPurchased = summaries.reduce((s: number, r: any) => s + r.visitorsWhoPurchased, 0);
  const purchasedPct = overall.distinctVisitors ? (totalPurchased / overall.distinctVisitors) * 100 : 0;
  const withDays = summaries.filter((r: any) => r.avgDaysToPurchase !== null);
  const avgDays = withDays.length
    ? withDays.reduce((s: number, r: any) => s + r.avgDaysToPurchase, 0) / withDays.length
    : null;
  const ambiguousPct = overall.distinctVisitors ? (overall.ambiguousVisitors / overall.distinctVisitors) * 100 : 0;

  const kpis: KpiItem[] = [
    { label: "Posts Analyzed", value: `${summaries.length}`, delta: "real gifted campaigns", direction: "neutral" },
    {
      label: "Distinct Visitors Captured",
      value: `${overall.distinctVisitors}`,
      delta: `${overall.totalWindowCaptures} window-captures total — see note on overlap below`,
      direction: "neutral",
    },
    {
      label: "Converted to a Purchase",
      value: `${purchasedPct.toFixed(1)}%`,
      delta: avgDays !== null ? `avg ${avgDays.toFixed(1)} days later` : "no purchases yet",
      direction: "neutral",
    },
  ];

  const headline = overall.distinctVisitors
    ? `Across ${summaries.length} real posts, ${overall.distinctVisitors} distinct real visitors were captured within a ${attributionWindowHours}-hour window of a post — no tracking links used, purely timing. ${purchasedPct.toFixed(1)}% went on to purchase.`
    : `No real visitor sessions fell within a ${attributionWindowHours}-hour window of any post — try a wider window.`;

  const csvRows = summaries.map((r: any) => ({
    influencer: r.influencer,
    product: r.productSlug,
    post_date: r.postDate,
    visitors_in_window: r.visitorsInWindow,
    new_visitors: r.newVisitors,
    returning_visitors: r.returningVisitors,
    returned_later: r.visitorsWhoReturnedLater,
    purchased: r.visitorsWhoPurchased,
    revenue: r.revenueFromWindow,
    avg_days_to_purchase: r.avgDaysToPurchase,
  }));

  return (
    <div>
      <div className="page-eyebrow">Overview · Visitor Journey</div>
      <h1 className="page-title">Visitor Journey</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">How this works — no tracking links required</h2>
        <p className="section-subtitle">
          Every gifted post has a real date. Every real site visit has a real anonymous visitor ID and timestamp
          (sales_events). This page attributes visitors to a post purely by comparing the two — a visit lands in a
          post&apos;s window if it happened within {attributionWindowHours} hours of the post, on that same
          product&apos;s page. No UTM parameters, no affiliate codes, no traffic_source tag required — the exact
          constraint of a gifting program that only tracks tags/mentions internally, not links.
        </p>
        <p className="section-subtitle" style={{ marginTop: 4 }}>
          Data note: this dataset only logs the post&apos;s calendar date, not its exact time of day — a real
          deployment would use the post&apos;s real timestamp (Instagram/TikTok/etc. all expose it) as the window
          start instead of midnight.
        </p>
        {overall.ambiguousVisitors > 0 && (
          <p className="section-subtitle" style={{ marginTop: 4, color: "var(--status-critical)" }}>
            Overlap note: {overall.ambiguousVisitors} of {overall.distinctVisitors} distinct visitors (
            {ambiguousPct.toFixed(1)}%) fell inside the attribution window of <strong>more than one</strong> post —
            a company this size posts often enough that timing alone can&apos;t always say which single post gets
            credit. These are flagged individually in the &quot;Also Near&quot; column below rather than silently
            counted once each, and the {overall.totalWindowCaptures}-vs-{overall.distinctVisitors} numbers above
            show the same thing at a glance: {overall.totalWindowCaptures} total window-captures across posts, but
            only {overall.distinctVisitors} real distinct people.
          </p>
        )}
      </div>

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={csvRows} filename="visitor-journey.csv" />
        </div>
        {summaries.length === 0 ? (
          <EmptyState label="No visitor journeys" message="No real visitors fell within the attribution window for any post." />
        ) : (
          <VisitorJourneyExplorer summaries={summaries} journeys={journeys} />
        )}
      </div>

      <DocInsightBox>
        {totalPurchased > 0
          ? `${totalPurchased} real purchases were traced back to a specific post using only timing — no links, no discount codes, no traffic_source tags. That's the whole thesis: attribution is possible even when a brand doesn't (or can't) use trackable links.`
          : `No purchases have been traced back to a post yet in this window — try widening the attribution window or check a longer post history.`}
      </DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/dashboard", "/customer-journey", "/roi"]} />
    </div>
  );
}
