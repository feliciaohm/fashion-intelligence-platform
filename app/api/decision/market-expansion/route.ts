import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Timeline estimates are industry-standard planning heuristics -- the
// platform has no real historical "market entered, here's how long it took"
// data to fit these from, so they're named as assumptions, not measurements.
const TIMELINES = {
  online_first: "3–6 months to first meaningful revenue (marketing + fulfillment only, no lease or hiring lead time)",
  wholesale_first: "6–9 months (partner onboarding and first order cycle)",
  retail_first: "9–15 months (site selection, lease negotiation, fit-out, hiring)",
};

export async function POST(req: Request) {
  const { country } = await req.json();

  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 });
  }

  try {
    const [
      [customerRows],
      [allCustomerCounts],
      [trafficRows],
      [influencerRows],
      [allInfluencerCounts],
      [storeRows],
      [wholesaleTotals],
    ] = await Promise.all([
      bigquery.query({
        query: `SELECT COUNT(*) AS n, SUM(lifetime_value) AS total_ltv FROM \`${PROJECT}.crm_customers\` WHERE country = @country`,
        params: { country },
        types: { country: "STRING" },
      }),
      bigquery.query(`SELECT country, COUNT(*) AS n FROM \`${PROJECT}.crm_customers\` GROUP BY country`),
      bigquery.query({
        query: `
          SELECT
            COUNTIF(traffic_source NOT LIKE 'influencer_%' OR traffic_source IS NULL) AS organic_events,
            COUNTIF(traffic_source LIKE 'influencer_%') AS influencer_events,
            COUNT(DISTINCT user_pseudo_id) AS visitors
          FROM \`${PROJECT}.sales_events\`
          WHERE country = @country`,
        params: { country },
        types: { country: "STRING" },
      }),
      bigquery.query({
        query: `SELECT COUNT(DISTINCT influencer) AS n, COUNT(*) AS campaigns, SUM(total_revenue) AS revenue FROM \`${PROJECT}.influencer_product_performance\` WHERE country = @country`,
        params: { country },
        types: { country: "STRING" },
      }),
      bigquery.query(
        `SELECT country, COUNT(DISTINCT influencer) AS n FROM \`${PROJECT}.influencer_product_performance\` GROUP BY country`
      ),
      bigquery.query({
        query: `SELECT COUNT(*) AS n, SUM(revenue) AS revenue FROM \`${PROJECT}.store_performance\` WHERE country = @country`,
        params: { country },
        types: { country: "STRING" },
      }),
      bigquery.query(`SELECT COUNT(DISTINCT retailer) AS retailers, SUM(revenue) AS revenue FROM \`${PROJECT}.wholesale_orders\``),
    ]);

    const customerCount = customerRows[0]?.n ?? 0;
    const customerLtv = customerRows[0]?.total_ltv ?? 0;
    const organicEvents = trafficRows[0]?.organic_events ?? 0;
    const influencerEvents = trafficRows[0]?.influencer_events ?? 0;
    const visitors = trafficRows[0]?.visitors ?? 0;
    const influencerCount = influencerRows[0]?.n ?? 0;
    const campaignCount = influencerRows[0]?.campaigns ?? 0;
    const influencerRevenue = influencerRows[0]?.revenue ?? 0;
    const hasStore = (storeRows[0]?.n ?? 0) > 0;
    const storeRevenue = storeRows[0]?.revenue ?? 0;

    // Real comparative thresholds: median customer count and median
    // influencer count across every market that has any presence at all,
    // so "strong" vs "weak" signal is judged against this brand's own
    // real distribution, not an arbitrary fixed number.
    const customerCounts = allCustomerCounts.map((r: any) => r.n).sort((a: number, b: number) => a - b);
    const medianCustomers = customerCounts[Math.floor(customerCounts.length / 2)] ?? 0;
    const influencerCounts = allInfluencerCounts.map((r: any) => r.n).sort((a: number, b: number) => a - b);
    const medianInfluencers = influencerCounts[Math.floor(influencerCounts.length / 2)] ?? 0;

    let strategy: "online_first" | "wholesale_first" | "retail_first";
    let strategyReason: string;

    if (hasStore) {
      strategy = "retail_first";
      strategyReason = `Maison Lumière already operates a store in ${country} (€${storeRevenue.toLocaleString()} in tracked revenue) — this evaluates a second location, best supported by the existing retail presence.`;
    } else if (customerCount === 0 && influencerCount === 0 && visitors === 0) {
      strategy = "online_first";
      strategyReason = `No customers, influencer activity, or site traffic recorded from ${country} yet — the market is untested. An online-first entry carries the least fixed commitment while real demand signal is gathered.`;
    } else if (customerCount >= medianCustomers && influencerCount >= medianInfluencers && customerCount > 0) {
      strategy = "retail_first";
      strategyReason = `${country} has ${customerCount} customers and ${influencerCount} influencer relationships — both at or above the median across all markets (${medianCustomers} customers, ${medianInfluencers} influencers) — suggesting demand strong enough to support a dedicated retail investment.`;
    } else if (influencerCount > 0 || organicEvents > 0) {
      strategy = "wholesale_first";
      strategyReason = `${country} shows some real demand signal (${influencerCount} influencer relationship${influencerCount === 1 ? "" : "s"}, ${organicEvents} organic site events) but below the level that would justify a full retail investment — a wholesale partnership tests the market with existing multi-brand retailers before a bigger commitment.`;
    } else {
      strategy = "online_first";
      strategyReason = `Limited but non-zero signal from ${country} — an online-first approach is the lowest-risk way to build a track record before committing to wholesale or retail.`;
    }

    const methodology = [
      `Customer base: ${customerCount} real customers recorded in ${country} (€${customerLtv.toLocaleString()} combined lifetime value), from the platform's crm_customers table.`,
      `Site traffic: ${organicEvents} organic events and ${influencerEvents} influencer-attributed events from ${visitors} distinct visitors in ${country}, from real sales_events data.`,
      `Influencer coverage: ${influencerCount} distinct influencers have run ${campaignCount} campaign${campaignCount === 1 ? "" : "s"} targeting ${country}, generating €${influencerRevenue.toLocaleString()} in attributed revenue.`,
      `Wholesale partner presence is tracked brand-wide (${wholesaleTotals[0]?.retailers ?? 0} partners, €${(wholesaleTotals[0]?.revenue ?? 0).toLocaleString()} total revenue) but the platform's wholesale_orders data has no country dimension, so market-specific wholesale presence can't be measured — shown as brand-wide context only, not a ${country}-specific figure.`,
      `Recommended strategy: ${strategyReason}`,
      `Timeline (${strategy.replace("_", " ")}): ${TIMELINES[strategy]} — a standard planning estimate for this entry mode, not derived from this brand's own market-entry history (no such history exists in the data).`,
    ];

    return NextResponse.json({
      inputs: { country },
      customerCount,
      customerLtv,
      organicEvents,
      influencerEvents,
      visitors,
      influencerCount,
      campaignCount,
      influencerRevenue,
      hasStore,
      storeRevenue,
      wholesaleBrandWide: { retailers: wholesaleTotals[0]?.retailers ?? 0, revenue: wholesaleTotals[0]?.revenue ?? 0 },
      recommendedStrategy: strategy,
      timeline: TIMELINES[strategy],
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
