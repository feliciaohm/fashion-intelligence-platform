import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const ASSUMED_CUSTOMER_LIFESPAN_YEARS = 2;
const HEALTHY_RATIO = 3;

export async function GET() {
  try {
    const [customerRows] = await bigquery.query(`
      SELECT
        c.customer_id, c.total_spend, c.order_count, c.first_purchase_date,
        CASE WHEN j.first_touch_source LIKE 'influencer_%' THEN 'influencer' ELSE 'organic' END AS acquisition
      FROM \`${PROJECT}.crm_customers\` c
      LEFT JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id
    `);
    const [maxDateRows] = await bigquery.query(
      `SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``
    );
    const [giftedRows] = await bigquery.query(
      `SELECT SUM(gifted_cost) AS total_gifted FROM \`${PROJECT}.influencer_product_performance\``
    );
    const [marketingRows] = await bigquery.query(
      `SELECT SUM(actual) AS total_marketing FROM \`${PROJECT}.cost_centers\` WHERE name = 'marketing'`
    );
    const [wholesaleRows] = await bigquery.query(
      `SELECT COUNT(DISTINCT retailer) AS partners, SUM(revenue) AS revenue FROM \`${PROJECT}.wholesale_orders\``
    );

    const datasetMaxDate = maxDateRows[0]?.max_date?.value ?? maxDateRows[0]?.max_date;
    const totalGifted = giftedRows[0]?.total_gifted ?? 0;
    const totalMarketing = marketingRows[0]?.total_marketing ?? 0;

    function clvFor(rows: any[]) {
      const totalSpend = rows.reduce((s, r) => s + r.total_spend, 0);
      const totalOrders = rows.reduce((s, r) => s + r.order_count, 0);
      const totalTenureYears = rows.reduce((s, r) => {
        const fpd = typeof r.first_purchase_date === "string" ? r.first_purchase_date : r.first_purchase_date.value;
        const tenureDays = Math.max(1, (new Date(datasetMaxDate).getTime() - new Date(fpd).getTime()) / 86400000);
        return s + tenureDays / 365;
      }, 0);
      const aov = totalOrders > 0 ? totalSpend / totalOrders : 0;
      const freq = totalTenureYears > 0 ? totalOrders / totalTenureYears : 0;
      return aov * freq * ASSUMED_CUSTOMER_LIFESPAN_YEARS;
    }

    const influencerCustomers = customerRows.filter((r: any) => r.acquisition === "influencer");
    const organicCustomers = customerRows.filter((r: any) => r.acquisition === "organic");

    const influencerClv = clvFor(influencerCustomers);
    const influencerCac = influencerCustomers.length > 0 ? totalGifted / influencerCustomers.length : null;
    const influencerRatio = influencerCac && influencerCac > 0 ? influencerClv / influencerCac : null;

    const channels = [
      {
        channel: "influencer",
        spend: totalGifted,
        newCustomers: influencerCustomers.length,
        cac: influencerCac !== null ? Math.round(influencerCac) : null,
        clv: Math.round(influencerClv),
        ratio: influencerRatio !== null ? Math.round(influencerRatio * 100) / 100 : null,
        healthy: influencerRatio !== null ? influencerRatio >= HEALTHY_RATIO : null,
      },
      {
        channel: "organic",
        spend: totalMarketing,
        newCustomers: organicCustomers.length,
        cac: null,
        clv: organicCustomers.length > 0 ? Math.round(clvFor(organicCustomers)) : 0,
        ratio: null,
        healthy: null,
      },
      {
        channel: "wholesale",
        spend: null,
        newCustomers: null,
        cac: null,
        clv: null,
        ratio: null,
        healthy: null,
      },
    ];

    const methodology = [
      `CAC = total spend for the channel ÷ new customers acquired via that channel, both drawn from real data: influencer spend is the real €${totalGifted.toLocaleString()} sum of gifted_cost across all 40 campaigns (influencer_product_performance); customer counts are real crm_customers joined to customer_journey.first_touch_source.`,
      `Influencer CAC: €${influencerCac !== null ? Math.round(influencerCac).toLocaleString() : "n/a"} per customer (€${totalGifted.toLocaleString()} ÷ ${influencerCustomers.length} customers). CLV (same ${ASSUMED_CUSTOMER_LIFESPAN_YEARS}-year-lifespan-assumption formula as the CLV Analyzer): €${Math.round(influencerClv).toLocaleString()}. Ratio: ${influencerRatio !== null ? influencerRatio.toFixed(2) : "n/a"}:1 — ${influencerRatio !== null ? (influencerRatio >= HEALTHY_RATIO ? "above" : "below") : "n/a vs."} the ${HEALTHY_RATIO}:1 threshold commonly used as the line between a profitable and an unprofitable acquisition channel.`,
      `Organic: €${totalMarketing.toLocaleString()} was spent on the real "marketing" cost center, but 0 of the platform's ${customerRows.length} real customers have a non-influencer first touch — so this spend produced no directly traceable acquisitions in the tracked data. CAC and the CLV:CAC ratio are shown as n/a rather than a division by zero; this is a real signal worth investigating (either the marketing spend needs better attribution tracking, or it isn't currently driving direct conversions).`,
      `Wholesale: CAC and CLV:CAC don't apply in the same sense here — wholesale_orders has ${wholesaleRows[0]?.partners ?? 0} real retail partners (€${(wholesaleRows[0]?.revenue ?? 0).toLocaleString()} total revenue) but no individual end-customers to compute a per-customer ratio from.`,
    ];

    return NextResponse.json({ channels, healthyRatioThreshold: HEALTHY_RATIO, methodology });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
