// Server-only: computes Maison Lumière's real platform-side metrics. Shared by
// /api/benchmarks, /api/consulting-summary, and the Quick Metrics Panel so all
// three work from the same real numbers instead of querying BigQuery twice.
import { bigquery } from "@/lib/bigquery";
import { BENCHMARKS, BenchmarkResult } from "@/lib/benchmarks";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const CHURN_WINDOW_DAYS = 90;
const ASSUMED_CUSTOMER_LIFESPAN_YEARS = 2;

export interface RawPlatformMetrics {
  influencerRevenue: number;
  influencerCost: number;
  influencerRoiMultiple: number | null;
  marginRevenue: number;
  marginCogs: number;
  grossMarginPct: number | null;
  totalCustomersWithPurchases: number;
  churnedCount: number;
  retentionRatePct: number | null;
  influencerClv: number;
  influencerCac: number | null;
  cacClvRatio: number | null;
  totalReturns: number;
  totalPurchases: number;
  returnRatePct: number | null;
  totalCustomerCount: number;
}

export async function getRawPlatformMetrics(): Promise<RawPlatformMetrics> {
  const [
    [influencerRows],
    [marginRows],
    [purchaseRows],
    [cacClvCustomerRows],
    [giftedRows],
    [returnsRows],
    [maxSalesDateRows],
    [customerCountRows],
  ] = await Promise.all([
    bigquery.query(`SELECT SUM(total_revenue) AS revenue, SUM(gifted_cost) AS cost FROM \`${PROJECT}.influencer_product_performance\``),
    bigquery.query(`SELECT SUM(revenue_actual) AS revenue, SUM(cogs) AS cogs FROM \`${PROJECT}.finance_channel\``),
    bigquery.query(`
      SELECT s.user_pseudo_id AS customer_id, DATE(s.event_timestamp) AS purchase_date
      FROM \`${PROJECT}.sales_events\` s
      WHERE s.event_name = 'purchase' AND s.revenue > 0
    `),
    bigquery.query(`
      SELECT c.customer_id, c.total_spend, c.order_count, c.first_purchase_date
      FROM \`${PROJECT}.crm_customers\` c
      JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id
      WHERE j.first_touch_source LIKE 'influencer_%'
    `),
    bigquery.query(`SELECT SUM(gifted_cost) AS total_gifted FROM \`${PROJECT}.influencer_product_performance\``),
    bigquery.query(`SELECT COUNT(*) AS n FROM \`${PROJECT}.returns\``),
    bigquery.query(`SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``),
    bigquery.query(`SELECT COUNT(*) AS n FROM \`${PROJECT}.crm_customers\``),
  ]);

  // --- Influencer ROI: real revenue multiple, € returned per €1 gifted ---
  const influencerRevenue = influencerRows[0]?.revenue ?? 0;
  const influencerCost = influencerRows[0]?.cost ?? 0;
  const influencerRoiMultiple = influencerCost > 0 ? influencerRevenue / influencerCost : null;

  // --- Gross margin: real (revenue - cogs) / revenue across finance_channel ---
  const marginRevenue = marginRows[0]?.revenue ?? 0;
  const marginCogs = marginRows[0]?.cogs ?? 0;
  const grossMarginPct = marginRevenue > 0 ? ((marginRevenue - marginCogs) / marginRevenue) * 100 : null;

  // --- Customer retention: same 90-day-inactivity definition as the Churn Risk calculator ---
  const maxDate = purchaseRows.reduce(
    (max: Date, r: any) => {
      const d = new Date(typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value);
      return d > max ? d : max;
    },
    new Date(0)
  );
  const lastPurchaseByCustomer = new Map<string, Date>();
  purchaseRows.forEach((r: any) => {
    const d = new Date(typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value);
    const existing = lastPurchaseByCustomer.get(r.customer_id);
    if (!existing || d > existing) lastPurchaseByCustomer.set(r.customer_id, d);
  });
  let churnedCount = 0;
  lastPurchaseByCustomer.forEach((lastDate) => {
    const days = (maxDate.getTime() - lastDate.getTime()) / 86400000;
    if (days > CHURN_WINDOW_DAYS) churnedCount++;
  });
  const totalCustomersWithPurchases = lastPurchaseByCustomer.size;
  const retentionRatePct =
    totalCustomersWithPurchases > 0 ? ((totalCustomersWithPurchases - churnedCount) / totalCustomersWithPurchases) * 100 : null;

  // --- CAC:CLV: same formula as the CAC:CLV calculator, influencer channel ---
  const datasetMaxDate = maxSalesDateRows[0]?.max_date?.value ?? maxSalesDateRows[0]?.max_date;
  const totalGifted = giftedRows[0]?.total_gifted ?? 0;
  const totalSpend = cacClvCustomerRows.reduce((s: number, r: any) => s + r.total_spend, 0);
  const totalOrders = cacClvCustomerRows.reduce((s: number, r: any) => s + r.order_count, 0);
  const totalTenureYears = cacClvCustomerRows.reduce((s: number, r: any) => {
    const fpd = typeof r.first_purchase_date === "string" ? r.first_purchase_date : r.first_purchase_date.value;
    const tenureDays = Math.max(1, (new Date(datasetMaxDate).getTime() - new Date(fpd).getTime()) / 86400000);
    return s + tenureDays / 365;
  }, 0);
  const aov = totalOrders > 0 ? totalSpend / totalOrders : 0;
  const freq = totalTenureYears > 0 ? totalOrders / totalTenureYears : 0;
  const influencerClv = aov * freq * ASSUMED_CUSTOMER_LIFESPAN_YEARS;
  const influencerCac = cacClvCustomerRows.length > 0 ? totalGifted / cacClvCustomerRows.length : null;
  const cacClvRatio = influencerCac && influencerCac > 0 ? influencerClv / influencerCac : null;

  // --- Return rate: real returns / real purchases ---
  const totalReturns = returnsRows[0]?.n ?? 0;
  const totalPurchases = purchaseRows.length;
  const returnRatePct = totalPurchases > 0 ? (totalReturns / totalPurchases) * 100 : null;

  return {
    influencerRevenue,
    influencerCost,
    influencerRoiMultiple,
    marginRevenue,
    marginCogs,
    grossMarginPct,
    totalCustomersWithPurchases,
    churnedCount,
    retentionRatePct,
    influencerClv,
    influencerCac,
    cacClvRatio,
    totalReturns,
    totalPurchases,
    returnRatePct,
    totalCustomerCount: customerCountRows[0]?.n ?? 0,
  };
}

export async function getBenchmarkResults(): Promise<BenchmarkResult[]> {
  const m = await getRawPlatformMetrics();

  const platformValues: Record<string, { value: number | null; note: string }> = {
    influencer_roi: {
      value: m.influencerRoiMultiple !== null ? Math.round(m.influencerRoiMultiple * 100) / 100 : null,
      note: `Real: €${m.influencerRevenue.toLocaleString()} attributed revenue ÷ €${m.influencerCost.toLocaleString()} gifted cost across all real campaigns (influencer_product_performance).`,
    },
    gross_margin: {
      value: m.grossMarginPct !== null ? Math.round(m.grossMarginPct * 10) / 10 : null,
      note: `Real: (€${m.marginRevenue.toLocaleString()} revenue − €${m.marginCogs.toLocaleString()} COGS) ÷ revenue, summed across every real channel/quarter in finance_channel.`,
    },
    customer_retention: {
      value: m.retentionRatePct !== null ? Math.round(m.retentionRatePct * 10) / 10 : null,
      note: `Real: of ${m.totalCustomersWithPurchases} customers with a real purchase, ${m.totalCustomersWithPurchases - m.churnedCount} bought again within ${CHURN_WINDOW_DAYS} days of the dataset's latest date — same definition as the Churn Risk calculator.`,
    },
    cac_clv_ratio: {
      value: m.cacClvRatio !== null ? Math.round(m.cacClvRatio * 100) / 100 : null,
      note: `Real: influencer-channel CLV (€${Math.round(m.influencerClv).toLocaleString()}) ÷ CAC (€${m.influencerCac !== null ? Math.round(m.influencerCac).toLocaleString() : "n/a"}) — same formula as the CAC:CLV calculator.`,
    },
    return_rate: {
      value: m.returnRatePct !== null ? Math.round(m.returnRatePct * 10) / 10 : null,
      note: `Real: ${m.totalReturns} returns ÷ ${m.totalPurchases} real purchase events (sales_events).`,
    },
  };

  return BENCHMARKS.map((b) => ({
    ...b,
    platformValue: platformValues[b.id]?.value ?? null,
    platformNote: platformValues[b.id]?.note ?? "",
  }));
}
