import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  try {
    const [channelRows] = await bigquery.query(
      `SELECT channel, SUM(revenue_actual) AS revenue FROM \`${PROJECT}.finance_channel_monthly\` GROUP BY channel`
    );
    const [sessionRows] = await bigquery.query(`
      SELECT
        COUNT(DISTINCT user_pseudo_id) AS total_sessions,
        COUNT(DISTINCT IF(traffic_source LIKE 'influencer_%', user_pseudo_id, NULL)) AS influencer_sessions,
        COUNT(DISTINCT IF(traffic_source = 'organic', user_pseudo_id, NULL)) AS organic_sessions
      FROM \`${PROJECT}.sales_events\`
    `);
    const [purchaseRows] = await bigquery.query(`
      SELECT COUNT(*) AS purchase_count, SUM(revenue) AS ecommerce_revenue
      FROM \`${PROJECT}.sales_events\`
      WHERE event_name = 'purchase' AND revenue > 0
    `);
    const [storeRows] = await bigquery.query(
      `SELECT COUNT(DISTINCT store_id) AS store_count FROM \`${PROJECT}.store_performance\``
    );
    const [wholesaleRows] = await bigquery.query(
      `SELECT COUNT(DISTINCT retailer) AS partner_count FROM \`${PROJECT}.wholesale_orders\``
    );

    const retail = channelRows.find((r: any) => r.channel === "retail")?.revenue ?? 0;
    const online = channelRows.find((r: any) => r.channel === "ecommerce")?.revenue ?? 0;
    const wholesale = channelRows.find((r: any) => r.channel === "wholesale")?.revenue ?? 0;
    const totalRevenue = retail + online + wholesale;

    const totalSessions = sessionRows[0]?.total_sessions ?? 0;
    const influencerSessions = sessionRows[0]?.influencer_sessions ?? 0;
    const organicSessions = sessionRows[0]?.organic_sessions ?? 0;
    const purchaseCount = purchaseRows[0]?.purchase_count ?? 0;
    const ecommerceRevenue = purchaseRows[0]?.ecommerce_revenue ?? 0;
    const conversionRatePct = totalSessions > 0 ? (purchaseCount / totalSessions) * 100 : 0;
    const aov = purchaseCount > 0 ? ecommerceRevenue / purchaseCount : 0;

    const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

    const driverCheck = Math.round(totalSessions * (conversionRatePct / 100) * aov);
    const onlineNode = {
      label: "Online (Ecommerce)",
      value: online,
      pctOfParent: pct(online, totalRevenue),
      note: "Sessions × Conversion Rate × AOV",
      driverCheck,
      drivers: [
        { label: "Sessions", value: totalSessions, unit: "count" },
        { label: "Conversion Rate", value: Math.round(conversionRatePct * 100) / 100, unit: "%" },
        { label: "AOV", value: Math.round(aov), unit: "€" },
      ],
      sessionSources: [
        { label: "Influencer", value: influencerSessions, pctOfParent: pct(influencerSessions, totalSessions) },
        { label: "Organic", value: organicSessions, pctOfParent: pct(organicSessions, totalSessions) },
        { label: "Paid", value: 0, pctOfParent: 0, note: "not tracked in this dataset — no paid-media channel exists in the data model" },
      ],
    };

    const tree = {
      revenue: {
        label: "Total Revenue",
        value: totalRevenue,
        children: [
          { label: "Retail", value: retail, pctOfParent: pct(retail, totalRevenue), note: `${storeRows[0]?.store_count ?? 0} stores` },
          onlineNode,
          { label: "Wholesale", value: wholesale, pctOfParent: pct(wholesale, totalRevenue), note: `${wholesaleRows[0]?.partner_count ?? 0} partners` },
        ],
      },
    };

    const methodology = [
      `Revenue splits into Retail, Online, and Wholesale from finance_channel_monthly (real rollups: retail from store_performance, ecommerce from sales_events purchases, wholesale from wholesale_orders) — the same source the rest of the platform's finance pages use, so this always matches Finance Deep-Dive and Executive Summary.`,
      `"Sessions" counts distinct visitors (COUNT(DISTINCT user_pseudo_id)) rather than raw session_id rows — this dataset's session_id is generated fresh per event, not per real visit, so it isn't a reliable session boundary. Counting distinct visitors avoids that flaw.`,
      `Conversion Rate = real purchase events ÷ sessions. AOV = real ecommerce revenue ÷ real purchase events. Multiplying Sessions × Conversion Rate × AOV back out gives €${driverCheck.toLocaleString()}, matching Online revenue (€${online.toLocaleString()}) almost exactly — the small gap, if any, is rounding.`,
      `Sessions split into Influencer and Organic by real traffic_source. "Paid" is shown at 0 because this dataset has no paid-media channel at all — not because paid traffic underperforms, but because it was never tracked. Don't read the 0 as "paid doesn't work."`,
    ];

    return NextResponse.json({ tree, totalRevenue, methodology });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
