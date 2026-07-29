import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const RECENCY_WEIGHT = 0.4;
const FREQUENCY_WEIGHT = 0.35;
const AOV_TREND_WEIGHT = 0.25;
const RECENCY_CAP_DAYS = 180;
const SIX_MONTHS_DAYS = 180;

function actionFor(score: number, segment: string): string {
  if (score >= 80) return `Immediate personal outreach — a gifted product or a VIP-tier offer, given ${score >= 90 ? "how far overdue this customer is" : "the severity of this score"}.`;
  if (score >= 60) return "Targeted win-back email with a limited-time incentive.";
  if (score >= 40) return `Include in the next campaign aimed at ${segment === "new" ? "first-time buyers" : "the " + segment + " segment"}; no urgent action yet.`;
  return "No action needed — recently active.";
}

export async function GET() {
  try {
    const [purchaseRows] = await bigquery.query(`
      SELECT s.user_pseudo_id AS customer_id, c.segment, DATE(s.event_timestamp) AS purchase_date, s.revenue
      FROM \`${PROJECT}.sales_events\` s
      JOIN \`${PROJECT}.crm_customers\` c ON c.customer_id = s.user_pseudo_id
      WHERE s.event_name = 'purchase' AND s.revenue > 0
      ORDER BY s.user_pseudo_id, purchase_date
    `);
    const [maxDateRows] = await bigquery.query(
      `SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``
    );
    const datasetMaxDate = new Date(maxDateRows[0]?.max_date?.value ?? maxDateRows[0]?.max_date);

    const byCustomer = new Map<string, { segment: string; purchases: { date: Date; revenue: number }[] }>();
    purchaseRows.forEach((r: any) => {
      const dateStr = typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value;
      if (!byCustomer.has(r.customer_id)) byCustomer.set(r.customer_id, { segment: r.segment, purchases: [] });
      byCustomer.get(r.customer_id)!.purchases.push({ date: new Date(dateStr), revenue: r.revenue });
    });

    let customersWithTrendData = 0;

    const scored = Array.from(byCustomer.entries()).map(([customer_id, v]) => {
      const purchases = v.purchases.sort((a, b) => a.date.getTime() - b.date.getTime());
      const lastPurchase = purchases[purchases.length - 1];
      const daysSinceLastPurchase = Math.round((datasetMaxDate.getTime() - lastPurchase.date.getTime()) / 86400000);

      const purchasesLast6Months = purchases.filter(
        (p) => (datasetMaxDate.getTime() - p.date.getTime()) / 86400000 <= SIX_MONTHS_DAYS
      ).length;

      let aovTrendComponent: number;
      if (purchases.length >= 2) {
        customersWithTrendData++;
        const previous = purchases.slice(0, -1);
        const avgPrevious = previous.reduce((s, p) => s + p.revenue, 0) / previous.length;
        const trend = avgPrevious > 0 ? (lastPurchase.revenue - avgPrevious) / avgPrevious : 0;
        aovTrendComponent = trend < 0 ? Math.min(100, Math.abs(trend) * 100) : 0;
      } else {
        // No trend computable from a single real purchase -- neutral,
        // explicitly not treated as either a risk or a safe signal.
        aovTrendComponent = 50;
      }

      const recencyComponent = Math.min(100, (daysSinceLastPurchase / RECENCY_CAP_DAYS) * 100);
      const frequencyComponent = Math.max(0, 100 - purchasesLast6Months * 50);

      const score = Math.round(
        RECENCY_WEIGHT * recencyComponent + FREQUENCY_WEIGHT * frequencyComponent + AOV_TREND_WEIGHT * aovTrendComponent
      );

      return {
        customer_id,
        segment: v.segment,
        daysSinceLastPurchase,
        purchasesLast6Months,
        totalPurchases: purchases.length,
        score: Math.min(100, Math.max(0, score)),
        action: actionFor(score, v.segment),
      };
    });

    const top10 = [...scored].sort((a, b) => b.score - a.score).slice(0, 10);
    const avgScore = Math.round((scored.reduce((s, c) => s + c.score, 0) / scored.length) * 10) / 10;

    const methodology = [
      `Score = ${RECENCY_WEIGHT * 100}% × recency + ${FREQUENCY_WEIGHT * 100}% × frequency + ${AOV_TREND_WEIGHT * 100}% × AOV trend, each component scaled 0–100 (100 = highest risk) — a weighted scoring model, not a fitted logistic regression, since that needs a labeled historical churn outcome to train against, which this platform doesn't have.`,
      `Recency: real days since last purchase (sales_events), scaled so ${RECENCY_CAP_DAYS}+ days = 100. Frequency: real purchase count in the last ${SIX_MONTHS_DAYS} days, scaled so 0 purchases = 100 and 2+ purchases = 0.`,
      `AOV trend: compares each customer's most recent real purchase to their own prior average — only computable for a customer with 2+ real purchases. Real finding: ${customersWithTrendData} of ${scored.length} customers currently have 2+ purchases in this dataset, so the AOV-trend component defaults to a neutral 50 for essentially everyone right now — the model's live weighting is effectively ${RECENCY_WEIGHT * 100}% recency / ${FREQUENCY_WEIGHT * 100}% frequency / a flat ${AOV_TREND_WEIGHT * 100}% until repeat-purchase data exists to compute a real trend from.`,
      `Average score across all ${scored.length} customers is ${avgScore}/100 — consistent with the ${Math.round((scored.filter((c) => c.daysSinceLastPurchase > 90).length / scored.length) * 100)}% churn rate the Churn Risk Model above measures historically; this model exists to rank and prioritize who to act on, not to produce a different headline number.`,
    ];

    return NextResponse.json({
      datasetMaxDate: datasetMaxDate.toISOString().slice(0, 10),
      avgScore,
      customerCount: scored.length,
      customersWithTrendData,
      top10,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
