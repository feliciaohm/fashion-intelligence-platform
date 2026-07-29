import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const OTD_RISK_THRESHOLD = 85;
const LEAD_TIME_RISK_THRESHOLD_DAYS = 60;

export async function GET() {
  try {
    const [[suppliers], [categorySpend]] = await Promise.all([
      bigquery.query(`SELECT * FROM \`${PROJECT}.suppliers\` ORDER BY supplier_name`),
      bigquery.query(
        `SELECT category AS product_category, SUM(cost_price * units_sold_direct) AS total_cogs_spend
         FROM \`${PROJECT}.product_lifecycle\`
         GROUP BY category`
      ),
    ]);

    const spendByCategory: Record<string, number> = {};
    categorySpend.forEach((r: any) => {
      spendByCategory[r.product_category] = r.total_cogs_spend || 0;
    });

    const suppliersByCategory: Record<string, number> = {};
    suppliers.forEach((s: any) => {
      suppliersByCategory[s.product_category] = (suppliersByCategory[s.product_category] || 0) + 1;
    });

    const rows = suppliers.map((s: any) => {
      const atRisk = s.on_time_delivery_rate < OTD_RISK_THRESHOLD || s.lead_time_days > LEAD_TIME_RISK_THRESHOLD_DAYS;
      const riskReasons: string[] = [];
      if (s.on_time_delivery_rate < OTD_RISK_THRESHOLD) riskReasons.push(`on-time delivery ${s.on_time_delivery_rate}% (below ${OTD_RISK_THRESHOLD}%)`);
      if (s.lead_time_days > LEAD_TIME_RISK_THRESHOLD_DAYS) riskReasons.push(`${s.lead_time_days}-day lead time (over ${LEAD_TIME_RISK_THRESHOLD_DAYS}d)`);

      const categoryTotal = spendByCategory[s.product_category] || 0;
      const supplierCountInCategory = suppliersByCategory[s.product_category] || 1;
      const estimatedSpend = categoryTotal / supplierCountInCategory;

      return {
        ...s,
        atRisk,
        riskReasons,
        estimatedSpend: Math.round(estimatedSpend),
      };
    });

    const atRiskSuppliers = rows.filter((r) => r.atRisk);
    const avgOtd = rows.reduce((s, r) => s + r.on_time_delivery_rate, 0) / (rows.length || 1);
    const totalSpend = rows.reduce((s, r) => s + r.estimatedSpend, 0);

    return NextResponse.json({
      suppliers: rows,
      atRiskCount: atRiskSuppliers.length,
      totalSuppliers: rows.length,
      avgOtd: Math.round(avgOtd * 10) / 10,
      totalSpend,
      thresholds: { otd: OTD_RISK_THRESHOLD, leadTimeDays: LEAD_TIME_RISK_THRESHOLD_DAYS },
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
