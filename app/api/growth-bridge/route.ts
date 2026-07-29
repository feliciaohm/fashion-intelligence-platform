import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  try {
    // Same real-data substitution and equal-count cohort split established for
    // Revenue Growth Decomposition (Calculator 18): this dataset has no real
    // multi-year history, so "last year vs this year" is built from the two
    // real halves of the purchase history instead of fabricating prior-year
    // data. Applied per-customer here (not per-category) since a growth
    // bridge is a customer-cohort analysis by definition.
    const [rows] = await bigquery.query(`
      SELECT s.user_pseudo_id AS customer_id, s.revenue,
        NTILE(2) OVER (ORDER BY s.event_timestamp) AS half
      FROM \`${PROJECT}.sales_events\` s
      WHERE s.event_name = 'purchase' AND s.revenue > 0
    `);

    type Cust = { orders1: number; revenue1: number; orders2: number; revenue2: number };
    const byCustomer = new Map<string, Cust>();
    rows.forEach((r: any) => {
      const c = byCustomer.get(r.customer_id) ?? { orders1: 0, revenue1: 0, orders2: 0, revenue2: 0 };
      if (r.half === 1) {
        c.orders1 += 1;
        c.revenue1 += r.revenue;
      } else {
        c.orders2 += 1;
        c.revenue2 += r.revenue;
      }
      byCustomer.set(r.customer_id, c);
    });

    let priorPeriodRevenue = 0;
    let currentPeriodRevenue = 0;
    let newBusiness = 0;
    let churnImpact = 0;
    let expansion = 0;
    let priceEffect = 0;
    let newCustomerCount = 0;
    let churnedCustomerCount = 0;
    let retainedCustomerCount = 0;

    byCustomer.forEach((c) => {
      priorPeriodRevenue += c.revenue1;
      currentPeriodRevenue += c.revenue2;

      if (c.orders1 === 0 && c.orders2 > 0) {
        newBusiness += c.revenue2;
        newCustomerCount++;
      } else if (c.orders1 > 0 && c.orders2 === 0) {
        churnImpact -= c.revenue1;
        churnedCustomerCount++;
      } else if (c.orders1 > 0 && c.orders2 > 0) {
        retainedCustomerCount++;
        const avgPrice1 = c.revenue1 / c.orders1;
        const avgPrice2 = c.revenue2 / c.orders2;
        expansion += (c.orders2 - c.orders1) * avgPrice1;
        priceEffect += (avgPrice2 - avgPrice1) * c.orders2;
      }
    });

    const totalGrowth = currentPeriodRevenue - priorPeriodRevenue;
    const bridgeSum = expansion + newBusiness + churnImpact + priceEffect;

    const waterfall = [
      { label: "Prior Period Revenue", value: Math.round(priorPeriodRevenue), isTotal: true },
      { label: "Expansion", value: Math.round(expansion) },
      { label: "New Business", value: Math.round(newBusiness) },
      { label: "Churn Impact", value: Math.round(churnImpact) },
      { label: "Price Effect", value: Math.round(priceEffect) },
      { label: "Current Period Revenue", value: Math.round(currentPeriodRevenue), isTotal: true },
    ];

    const methodology = [
      `Data source: shopify_orders and crm_customers alone can't build a real revenue bridge (crm_customers has no per-period revenue split) — real per-customer, per-purchase revenue and timestamps come from sales_events, joined to crm_customers only implicitly via the shared customer_id. This is the same real-data substitution already established for Revenue Growth Decomposition (Calculator 18).`,
      `No real multi-year history exists in this dataset (real data spans ~10 months of 2026) — "prior period" and "current period" are the two equal-COUNT halves of all ${rows.length} real revenue-positive purchases, split by date (oldest half vs. newest half), not a literal prior calendar year.`,
      `Expansion = for the ${retainedCustomerCount} customers who bought in both periods, the pure change in order count (not price) valued at their prior-period average price — i.e. buying more (or less) at roughly the same price point.`,
      `New Business = all revenue from the ${newCustomerCount} customers whose first-ever purchase falls in the current period.`,
      `Churn Impact = the full prior-period revenue lost from the ${churnedCustomerCount} customers who bought in the prior period but not the current one (shown as negative).`,
      `Price Effect = for the same retained customers, the change in their average order value (price/mix per order) applied to their current-period order count — isolates a real price movement from a real volume movement, same decomposition math as Calculator 18, applied per-customer instead of per-category.`,
      `Bridge check: Expansion + New Business + Churn Impact + Price Effect = €${Math.round(bridgeSum).toLocaleString()}, vs. real total revenue change of €${Math.round(totalGrowth).toLocaleString()} — closes exactly (rounding only).`,
      `Sample size caveat: built from ${byCustomer.size} real customers total (${retainedCustomerCount} retained, ${newCustomerCount} new, ${churnedCustomerCount} churned) — a small real base, so read each bucket as directional, not precise to the euro.`,
    ];

    return NextResponse.json({
      priorPeriodRevenue: Math.round(priorPeriodRevenue),
      currentPeriodRevenue: Math.round(currentPeriodRevenue),
      totalGrowth: Math.round(totalGrowth),
      expansion: Math.round(expansion),
      newBusiness: Math.round(newBusiness),
      churnImpact: Math.round(churnImpact),
      priceEffect: Math.round(priceEffect),
      newCustomerCount,
      churnedCustomerCount,
      retainedCustomerCount,
      waterfall,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
