import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const CHURN_WINDOW_DAYS = 90;

export async function GET() {
  try {
    const [purchaseRows] = await bigquery.query(`
      SELECT s.user_pseudo_id AS customer_id, c.segment, DATE(s.event_timestamp) AS purchase_date
      FROM \`${PROJECT}.sales_events\` s
      JOIN \`${PROJECT}.crm_customers\` c ON c.customer_id = s.user_pseudo_id
      WHERE s.event_name = 'purchase' AND s.revenue > 0
      ORDER BY s.user_pseudo_id, purchase_date
    `);
    const [maxDateRows] = await bigquery.query(
      `SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``
    );
    const datasetMaxDate = new Date(maxDateRows[0]?.max_date?.value ?? maxDateRows[0]?.max_date);

    const byCustomer = new Map<string, { segment: string; dates: Date[] }>();
    purchaseRows.forEach((r: any) => {
      const key = r.customer_id;
      const dateStr = typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value;
      if (!byCustomer.has(key)) byCustomer.set(key, { segment: r.segment, dates: [] });
      byCustomer.get(key)!.dates.push(new Date(dateStr));
    });

    interface CustomerChurn {
      customer_id: string;
      segment: string;
      daysSinceLastPurchase: number;
      churned: boolean;
      avgGapDays: number | null;
    }
    const customers: CustomerChurn[] = [];
    byCustomer.forEach((v, customer_id) => {
      const dates = v.dates.sort((a, b) => a.getTime() - b.getTime());
      const lastPurchase = dates[dates.length - 1];
      const daysSinceLastPurchase = Math.round((datasetMaxDate.getTime() - lastPurchase.getTime()) / 86400000);
      let avgGapDays: number | null = null;
      if (dates.length >= 2) {
        const gaps: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
        }
        avgGapDays = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      }
      customers.push({
        customer_id,
        segment: v.segment,
        daysSinceLastPurchase,
        churned: daysSinceLastPurchase > CHURN_WINDOW_DAYS,
        avgGapDays,
      });
    });

    const segments = Array.from(new Set(customers.map((c) => c.segment)));
    const bySegment = segments
      .map((segment) => {
        const group = customers.filter((c) => c.segment === segment);
        const churnedCount = group.filter((c) => c.churned).length;
        const churnRatePct = Math.round((churnedCount / group.length) * 1000) / 10;
        const multiPurchase = group.filter((c) => c.avgGapDays !== null);
        const avgTimeBetweenPurchasesDays =
          multiPurchase.length > 0
            ? Math.round(multiPurchase.reduce((s, c) => s + (c.avgGapDays ?? 0), 0) / multiPurchase.length)
            : null;
        return {
          segment,
          customerCount: group.length,
          churnedCount,
          churnRatePct,
          retentionRatePct: Math.round((100 - churnRatePct) * 10) / 10,
          avgTimeBetweenPurchasesDays,
          repeatPurchaserCount: multiPurchase.length,
        };
      })
      .sort((a, b) => b.churnRatePct - a.churnRatePct);

    const atRisk = customers
      .filter((c) => c.churned)
      .sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase)
      .slice(0, 10)
      .map((c) => ({ customer_id: c.customer_id, segment: c.segment, daysSinceLastPurchase: c.daysSinceLastPurchase }));

    const overallChurnRatePct = Math.round((customers.filter((c) => c.churned).length / customers.length) * 1000) / 10;

    const methodology = [
      `"Today" is treated as ${datasetMaxDate.toISOString().slice(0, 10)}, the most recent real event date in sales_events — not the actual calendar date — since this dataset's events run through late 2026 and using the real current date would misdate every customer as churned.`,
      `Churn: a customer is flagged churned if their most recent real purchase event (sales_events, event_name='purchase', revenue>0) is more than ${CHURN_WINDOW_DAYS} days before that reference date. Churn rate is the real share of each segment's customers meeting that condition; retention rate is 100% minus churn rate.`,
      `Average time between purchases is computed only from customers with 2 or more real purchase events (the gap between consecutive purchases, averaged) — single-purchase customers can't contribute a gap and are excluded from that specific average, though they're still counted in churn/retention.`,
      `Overall churn rate across all ${customers.length} purchasing customers: ${overallChurnRatePct}%. This uses the platform's ${customers.length} customers with at least one real purchase event traceable to a crm_customers record — not the full crm_customers table, since a churn model needs an actual purchase history to measure a gap from.`,
    ];

    return NextResponse.json({
      datasetMaxDate: datasetMaxDate.toISOString().slice(0, 10),
      churnWindowDays: CHURN_WINDOW_DAYS,
      overallChurnRatePct,
      bySegment,
      atRisk,
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
