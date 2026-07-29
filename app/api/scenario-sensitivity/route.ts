import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const DELTAS = [-20, -10, 0, 10, 20];

export async function GET() {
  try {
    const [channelRows] = await bigquery.query(
      `SELECT channel, SUM(revenue_actual) AS revenue FROM \`${PROJECT}.finance_channel_monthly\` GROUP BY channel`
    );
    const [cogsRows] = await bigquery.query(
      `SELECT SAFE_DIVIDE(SUM(cost_price), SUM(retail_price)) AS ratio FROM \`${PROJECT}.product_lifecycle\``
    );
    const [returnsRows] = await bigquery.query(
      `SELECT SUM(refund_amount) AS total FROM \`${PROJECT}.returns\``
    );
    const [influencerRows] = await bigquery.query(
      `SELECT SUM(gifted_cost) AS total_gifted, SUM(total_revenue) AS total_revenue FROM \`${PROJECT}.influencer_product_performance\``
    );
    const [storeRows] = await bigquery.query(
      `SELECT COUNT(DISTINCT store_id) AS n FROM \`${PROJECT}.store_performance\``
    );
    const [wholesaleRows] = await bigquery.query(
      `SELECT COUNT(DISTINCT retailer) AS n FROM \`${PROJECT}.wholesale_orders\``
    );
    const [funnelRows] = await bigquery.query(`
      SELECT
        COUNT(DISTINCT user_pseudo_id) AS sessions,
        COUNT(IF(event_name = 'purchase' AND revenue > 0, 1, NULL)) AS purchases
      FROM \`${PROJECT}.sales_events\`
    `);

    const retail = channelRows.find((r: any) => r.channel === "retail")?.revenue ?? 0;
    const online = channelRows.find((r: any) => r.channel === "ecommerce")?.revenue ?? 0;
    const wholesale = channelRows.find((r: any) => r.channel === "wholesale")?.revenue ?? 0;
    const totalRevenue = retail + online + wholesale;
    const cogsRatio = cogsRows[0]?.ratio ?? 0;
    const totalReturns = returnsRows[0]?.total ?? 0;
    const giftedCost = influencerRows[0]?.total_gifted ?? 0;
    const revenuePerGiftedEuro = giftedCost > 0 ? (influencerRows[0]?.total_revenue ?? 0) / giftedCost : 0;
    const storeCount = storeRows[0]?.n ?? 1;
    const partnerCount = wholesaleRows[0]?.n ?? 1;
    const sessions = funnelRows[0]?.sessions ?? 0;
    const purchases = funnelRows[0]?.purchases ?? 0;
    const realAov = purchases > 0 ? Math.round(online / purchases) : 0;
    const realConversionRatePct = sessions > 0 ? Math.round((purchases / sessions) * 1000) / 10 : 0;

    function metricsFor(newRevenue: number, newGiftedCost: number) {
      const grossMargin = newRevenue * (1 - cogsRatio);
      const netMargin = grossMargin - totalReturns - newGiftedCost;
      return { revenue: Math.round(newRevenue), grossMargin: Math.round(grossMargin), netMargin: Math.round(netMargin) };
    }

    const baseline = metricsFor(totalRevenue, giftedCost);

    const variables = [
      {
        key: "influencer_spend",
        label: "Influencer Spend (gifting/fees)",
        baselineValue: giftedCost,
        deltas: DELTAS.map((pct) => {
          const newGifted = giftedCost * (1 + pct / 100);
          const revenueEffect = (newGifted - giftedCost) * revenuePerGiftedEuro;
          return { pct, ...metricsFor(totalRevenue + revenueEffect, newGifted) };
        }),
      },
      {
        key: "aov",
        label: "Average Order Value (online)",
        baselineValue: realAov,
        deltas: DELTAS.map((pct) => {
          const newOnline = online * (1 + pct / 100);
          return { pct, ...metricsFor(retail + newOnline + wholesale, giftedCost) };
        }),
      },
      {
        key: "conversion_rate",
        label: "Online Conversion Rate",
        baselineValue: realConversionRatePct,
        deltas: DELTAS.map((pct) => {
          const newOnline = online * (1 + pct / 100);
          return { pct, ...metricsFor(retail + newOnline + wholesale, giftedCost) };
        }),
      },
      {
        key: "store_count",
        label: `Store Count (${storeCount} today)`,
        baselineValue: storeCount,
        deltas: DELTAS.map((pct) => {
          const newRetail = retail * (1 + pct / 100);
          return { pct, ...metricsFor(newRetail + online + wholesale, giftedCost) };
        }),
      },
      {
        key: "wholesale_partners",
        label: `Wholesale Partners (${partnerCount} today)`,
        baselineValue: partnerCount,
        deltas: DELTAS.map((pct) => {
          const newWholesale = wholesale * (1 + pct / 100);
          return { pct, ...metricsFor(retail + online + newWholesale, giftedCost) };
        }),
      },
    ];

    const methodology = [
      `Baseline: real total revenue €${totalRevenue.toLocaleString()} (retail €${retail.toLocaleString()} + online €${online.toLocaleString()} + wholesale €${wholesale.toLocaleString()}, from finance_channel_monthly). Gross margin uses the real blended cost/retail ratio from product_lifecycle (${(cogsRatio * 100).toFixed(1)}% COGS). Net margin additionally subtracts real returns (€${totalReturns.toLocaleString()}) and real gifted cost (€${giftedCost.toLocaleString()}) — the same waterfall Finance Deep-Dive uses.`,
      `Each row changes ONE variable by the shown percentage and holds every other variable at its real baseline (classic one-at-a-time sensitivity analysis) — rows are not meant to be combined, since real-world changes to one lever often affect others too.`,
      `Influencer Spend uses the real revenue-per-gifted-euro ratio (€${revenuePerGiftedEuro.toFixed(2)} per €1, from influencer_product_performance) to project the revenue effect of more or less gifting budget, and also changes the cost side of net margin directly.`,
      `AOV and Conversion Rate both scale Online revenue proportionally (Online = Sessions × Conversion Rate × AOV — a 10% change in either factor produces roughly a 10% change in Online revenue, holding the other two factors fixed) — this is a simplifying linear assumption, not a demand-elasticity model.`,
      `Store Count and Wholesale Partners scale Retail and Wholesale revenue proportionally, using each channel's real current average revenue per store/partner as the basis.`,
    ];

    return NextResponse.json({ baseline, variables, deltas: DELTAS, methodology });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
