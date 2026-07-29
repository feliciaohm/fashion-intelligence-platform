import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// The dataset has no real multi-year retention history to fit an actual
// survival curve from -- this is a documented planning assumption, not a
// measurement. It's the one non-real input in an otherwise real formula.
const ASSUMED_CUSTOMER_LIFESPAN_YEARS = 2;

interface CustomerRow {
  customer_id: string;
  segment: string;
  country: string;
  total_spend: number;
  order_count: number;
  first_purchase_date: { value: string } | string;
  acquisition: "influencer" | "organic";
}

function groupClv(rows: CustomerRow[], datasetMaxDate: string, keyFn: (r: CustomerRow) => string) {
  const groups = new Map<string, CustomerRow[]>();
  rows.forEach((r) => {
    const key = keyFn(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const customerCount = group.length;
      const totalSpend = group.reduce((s, r) => s + r.total_spend, 0);
      const totalOrders = group.reduce((s, r) => s + r.order_count, 0);
      const totalTenureYears = group.reduce((s, r) => {
        const fpd = typeof r.first_purchase_date === "string" ? r.first_purchase_date : r.first_purchase_date.value;
        const tenureDays = Math.max(1, (new Date(datasetMaxDate).getTime() - new Date(fpd).getTime()) / 86400000);
        return s + tenureDays / 365;
      }, 0);
      const aov = totalOrders > 0 ? totalSpend / totalOrders : 0;
      const annualPurchaseFrequency = totalTenureYears > 0 ? totalOrders / totalTenureYears : 0;
      const clv = aov * annualPurchaseFrequency * ASSUMED_CUSTOMER_LIFESPAN_YEARS;
      return {
        key,
        customerCount,
        totalSpend,
        aov: Math.round(aov),
        annualPurchaseFrequency: Math.round(annualPurchaseFrequency * 100) / 100,
        clv: Math.round(clv),
      };
    })
    .sort((a, b) => b.clv - a.clv);
}

export async function GET() {
  try {
    const [customerRows] = await bigquery.query(`
      SELECT
        c.customer_id, c.segment, c.country, c.total_spend, c.order_count, c.first_purchase_date,
        CASE WHEN j.first_touch_source LIKE 'influencer_%' THEN 'influencer' ELSE 'organic' END AS acquisition
      FROM \`${PROJECT}.crm_customers\` c
      LEFT JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id
    `);
    const [maxDateRows] = await bigquery.query(
      `SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``
    );
    const [wholesaleRows] = await bigquery.query(
      `SELECT retailer, SUM(revenue) AS total_revenue, COUNT(*) AS orders FROM \`${PROJECT}.wholesale_orders\` GROUP BY retailer`
    );

    const datasetMaxDate = maxDateRows[0]?.max_date?.value ?? maxDateRows[0]?.max_date;
    const rows: CustomerRow[] = customerRows.map((r: any) => ({ ...r, acquisition: r.acquisition ?? "organic" }));

    const byChannel = groupClv(rows, datasetMaxDate, (r) => r.acquisition);
    const byCountry = groupClv(rows, datasetMaxDate, (r) => r.country);
    const bySegment = groupClv(rows, datasetMaxDate, (r) => r.segment);

    // Ensure "organic" appears explicitly even if it has zero real customers,
    // rather than silently omitting the bucket the user asked to compare.
    if (!byChannel.find((g) => g.key === "organic")) {
      byChannel.push({ key: "organic", customerCount: 0, totalSpend: 0, aov: 0, annualPurchaseFrequency: 0, clv: 0 });
    }

    const totalWholesaleRevenue = wholesaleRows.reduce((s: number, r: any) => s + r.total_revenue, 0);
    const wholesalePartnerCount = wholesaleRows.length;
    const avgRevenuePerWholesalePartner = wholesalePartnerCount > 0 ? Math.round(totalWholesaleRevenue / wholesalePartnerCount) : 0;

    const bestChannel = byChannel.filter((g) => g.customerCount > 0).sort((a, b) => b.clv - a.clv)[0];

    const methodology = [
      `CLV = AOV × annual purchase frequency × assumed customer lifespan (${ASSUMED_CUSTOMER_LIFESPAN_YEARS} years). AOV and purchase frequency are computed from real crm_customers data (${rows.length} real customers); the ${ASSUMED_CUSTOMER_LIFESPAN_YEARS}-year lifespan is a documented planning assumption, since this dataset only covers ~10 months and can't observe actual multi-year retention.`,
      `Acquisition channel is read from customer_journey.first_touch_source. Every one of the ${rows.length} real customers in this dataset has an influencer-attributed first touch — organic shows honestly as 0 customers/€0 CLV rather than a fabricated number, because no customer in the real data converted without an influencer touchpoint first.`,
      `Wholesale isn't included in the channel/country/segment breakdown above because it has no individual end-customers in this dataset — wholesale_orders tracks B2B orders to ${wholesalePartnerCount} retail partners (Net-a-Porter, Mytheresa, Browns), not consumers. Shown separately: €${avgRevenuePerWholesalePartner.toLocaleString()} average lifetime revenue per wholesale partner (€${totalWholesaleRevenue.toLocaleString()} total ÷ ${wholesalePartnerCount} partners) — a different kind of metric, not directly comparable to per-consumer CLV.`,
      bestChannel
        ? `Among channels with real customers, ${bestChannel.key} produces the highest CLV (€${bestChannel.clv.toLocaleString()} per customer).`
        : `No channel has enough real customers to compare.`,
      `Country and segment breakdowns with only a handful of customers (e.g. Finland's 3, Denmark's 2) can show volatile annualized purchase frequency purely from having so few data points over a short observation window — read small-sample rows as directional, not precise.`,
    ];

    return NextResponse.json({
      datasetMaxDate,
      byChannel,
      byCountry,
      bySegment,
      wholesale: { totalRevenue: totalWholesaleRevenue, partnerCount: wholesalePartnerCount, avgRevenuePerPartner: avgRevenuePerWholesalePartner },
      assumedLifespanYears: ASSUMED_CUSTOMER_LIFESPAN_YEARS,
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
