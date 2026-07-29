// Server-only: the rule-based insight engine shared by /api/executive-summary
// and /api/consulting-summary, so both work from the exact same real
// BigQuery-computed numbers instead of running the queries twice and risking
// two slightly different answers to "what needs attention this month."
import { bigquery } from "@/lib/bigquery";
import { monthLabel, formatDeptName, capitalize } from "@/lib/narrative";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const MARGIN_THRESHOLD_PCT = 50;
const CHURN_ALERT_THRESHOLD_PCT = 30;
const CLV_CAC_HEALTHY_RATIO = 3;
const ASSUMED_CUSTOMER_LIFESPAN_YEARS = 2;

export interface ActionItem {
  rule: string;
  severity: number;
  title: string;
  detail: string;
}

// Rule 1: any cost center over budget by more than 10% for two consecutive months.
export function checkCostCenterOverspend(costCenterRows: any[]): ActionItem[] {
  const items: ActionItem[] = [];
  const names = Array.from(new Set(costCenterRows.map((r) => r.name)));
  names.forEach((name) => {
    const series = costCenterRows
      .filter((r) => r.name === name)
      .map((r) => ({ period: r.period, variancePct: r.budget ? ((r.actual - r.budget) / r.budget) * 100 : 0 }))
      .sort((a, b) => (a.period < b.period ? -1 : 1));
    for (let i = 1; i < series.length; i++) {
      if (series[i - 1].variancePct > 10 && series[i].variancePct > 10) {
        items.push({
          rule: "cost_center_overspend",
          severity: series[i].variancePct,
          title: `${formatDeptName(name)} over budget for 2+ consecutive months`,
          detail: `${formatDeptName(name)} ran ${series[i - 1].variancePct.toFixed(1)}% over budget in ${monthLabel(series[i - 1].period)} and ${series[i].variancePct.toFixed(1)}% over in ${monthLabel(series[i].period)} — two straight months above the 10% threshold.`,
        });
        break;
      }
    }
  });
  return items;
}

// Rule 2: any influencer campaign with ROI below the platform average.
export function checkLowRoiCampaigns(campaignRows: any[]): ActionItem[] {
  if (campaignRows.length === 0) return [];
  const avgRoi = campaignRows.reduce((s, r) => s + r.roi_pct, 0) / campaignRows.length;
  const below = campaignRows.filter((r) => r.roi_pct < avgRoi);
  if (below.length === 0) return [];
  const worst = [...below].sort((a, b) => a.roi_pct - b.roi_pct)[0];
  return [
    {
      rule: "low_roi_campaign",
      severity: avgRoi - worst.roi_pct,
      title: `${below.length} of ${campaignRows.length} campaigns are below the platform's average ROI`,
      detail: `Platform average campaign ROI is ${avgRoi.toFixed(1)}%. The worst is ${worst.influencer} on ${worst.product_slug} at ${worst.roi_pct.toFixed(1)}% ROI, ${(avgRoi - worst.roi_pct).toFixed(1)} points below average.`,
    },
  ];
}

// Rule 3: any store with declining revenue for three consecutive months.
export function checkDecliningStores(storeRows: any[]): ActionItem[] {
  const items: ActionItem[] = [];
  const storeIds = Array.from(new Set(storeRows.map((r) => r.store_id)));
  storeIds.forEach((storeId) => {
    const series = storeRows
      .filter((r) => r.store_id === storeId)
      .sort((a, b) => (a.period < b.period ? -1 : 1));
    for (let i = 2; i < series.length; i++) {
      if (series[i - 2].revenue > series[i - 1].revenue && series[i - 1].revenue > series[i].revenue) {
        const declinePct = ((series[i].revenue - series[i - 2].revenue) / series[i - 2].revenue) * 100;
        items.push({
          rule: "declining_store",
          severity: Math.abs(declinePct),
          title: `${series[0].store_name} revenue declining 3 straight months`,
          detail: `${series[0].store_name} fell from €${series[i - 2].revenue.toLocaleString()} (${monthLabel(series[i - 2].period)}) to €${series[i - 1].revenue.toLocaleString()} (${monthLabel(series[i - 1].period)}) to €${series[i].revenue.toLocaleString()} (${monthLabel(series[i].period)}) — ${Math.abs(declinePct).toFixed(1)}% down over the period.`,
        });
        break;
      }
    }
  });
  return items;
}

// Shared by the churn action-item rule, the Weekly Digest, and Benchmark
// Intelligence, so all three always report the exact same real number.
export function computeOverallChurnRatePct(purchaseRows: any[]): number {
  const maxDate = purchaseRows.reduce((max: Date, r: any) => (r.purchase_date > max ? r.purchase_date : max), purchaseRows[0]?.purchase_date ?? new Date(0));
  const byCustomer = new Map<string, Date>();
  purchaseRows.forEach((r: any) => {
    const existing = byCustomer.get(r.customer_id);
    if (!existing || r.purchase_date > existing) byCustomer.set(r.customer_id, r.purchase_date);
  });
  let churned = 0;
  byCustomer.forEach((lastDate) => {
    const days = (maxDate.getTime() - lastDate.getTime()) / 86400000;
    if (days > 90) churned++;
  });
  return byCustomer.size > 0 ? (churned / byCustomer.size) * 100 : 0;
}

// Rule 4: overall customer churn rate exceeds 30%.
export function checkChurnRate(purchaseRows: any[]): ActionItem[] {
  const maxDate = purchaseRows.reduce((max: Date, r: any) => (r.purchase_date > max ? r.purchase_date : max), purchaseRows[0]?.purchase_date ?? new Date(0));
  const byCustomer = new Map<string, Date>();
  purchaseRows.forEach((r: any) => {
    const existing = byCustomer.get(r.customer_id);
    if (!existing || r.purchase_date > existing) byCustomer.set(r.customer_id, r.purchase_date);
  });
  let churned = 0;
  byCustomer.forEach((lastDate) => {
    const days = (maxDate.getTime() - lastDate.getTime()) / 86400000;
    if (days > 90) churned++;
  });
  const churnRatePct = byCustomer.size > 0 ? (churned / byCustomer.size) * 100 : 0;
  if (churnRatePct <= CHURN_ALERT_THRESHOLD_PCT) return [];
  return [
    {
      rule: "high_churn",
      severity: churnRatePct - CHURN_ALERT_THRESHOLD_PCT,
      title: `Customer churn rate is ${churnRatePct.toFixed(1)}%, well above the ${CHURN_ALERT_THRESHOLD_PCT}% alert threshold`,
      detail: `${churned} of ${byCustomer.size} real purchasing customers haven't bought in over 90 days (relative to the dataset's most recent activity). See the Churn Risk Model in Decision Intelligence for the full segment breakdown.`,
    },
  ];
}

// Rule 5: CLV:CAC ratio falls below 3:1 for any channel with a computable ratio.
export function checkClvCacRatio(customerRows: any[], giftedCost: number, maxDate: string): ActionItem[] {
  const influencerCustomers = customerRows.filter((r) => r.acquisition === "influencer");
  if (influencerCustomers.length === 0) return [];
  const totalSpend = influencerCustomers.reduce((s, r) => s + r.total_spend, 0);
  const totalOrders = influencerCustomers.reduce((s, r) => s + r.order_count, 0);
  const totalTenureYears = influencerCustomers.reduce((s, r) => {
    const fpd = typeof r.first_purchase_date === "string" ? r.first_purchase_date : r.first_purchase_date.value;
    const days = Math.max(1, (new Date(maxDate).getTime() - new Date(fpd).getTime()) / 86400000);
    return s + days / 365;
  }, 0);
  const aov = totalOrders > 0 ? totalSpend / totalOrders : 0;
  const freq = totalTenureYears > 0 ? totalOrders / totalTenureYears : 0;
  const clv = aov * freq * ASSUMED_CUSTOMER_LIFESPAN_YEARS;
  const cac = giftedCost / influencerCustomers.length;
  const ratio = cac > 0 ? clv / cac : null;
  if (ratio === null || ratio >= CLV_CAC_HEALTHY_RATIO) return [];
  return [
    {
      rule: "low_clv_cac",
      severity: CLV_CAC_HEALTHY_RATIO - ratio,
      title: `Influencer channel CLV:CAC ratio is ${ratio.toFixed(2)}:1, below the ${CLV_CAC_HEALTHY_RATIO}:1 healthy threshold`,
      detail: `Customer lifetime value (€${Math.round(clv).toLocaleString()}) doesn't clear ${CLV_CAC_HEALTHY_RATIO}× acquisition cost (€${Math.round(cac).toLocaleString()}) for this channel. See CAC vs. CLV in Decision Intelligence.`,
    },
  ];
}

export function buildFallbackInsight(metrics: {
  worstCostCenter: any;
  worstChannel: any;
  belowThresholdCount: number;
  highChurnCount: number;
}): string {
  const { worstCostCenter, worstChannel, belowThresholdCount, highChurnCount } = metrics;

  if (worstCostCenter && worstCostCenter.variancePct > 15) {
    return `${formatDeptName(worstCostCenter.name)} overspent by ${worstCostCenter.variancePct.toFixed(1)}% this month — the largest cost variance across all departments. Worth a closer look before next month's budget is set.`;
  }
  if (worstChannel && worstChannel.variancePct < -10) {
    return `${capitalize(worstChannel.channel)} revenue came in ${Math.abs(worstChannel.variancePct).toFixed(1)}% below forecast this month, the weakest channel variance on the board.`;
  }
  if (belowThresholdCount > 0) {
    return `${belowThresholdCount} product${belowThresholdCount === 1 ? "" : "s"} ${belowThresholdCount === 1 ? "is" : "are"} priced below the ${MARGIN_THRESHOLD_PCT}% retail margin threshold — worth a pricing review this quarter.`;
  }
  if (highChurnCount > 20) {
    return `${highChurnCount} customers are currently flagged as high churn risk — the customer journey data suggests a re-engagement push could pay off.`;
  }
  return "No major anomalies this month — spend and revenue are tracking close to plan across every channel and cost center.";
}

export interface ExecutiveMetrics {
  latestMonth: string;
  totalActual: number;
  totalForecast: number;
  priorMonth: string | null;
  priorMonthRevenue: number | null;
  revenueMoMChangePct: number | null;
  overallChurnRatePct: number;
  topProduct: any;
  topInfluencer: any;
  worstCostCenter: any;
  worstChannel: any;
  belowThresholdCount: number;
  highChurnCount: number;
  allFindings: ActionItem[];
  actionItems: ActionItem[];
  channels: any[];
  costCenters: any[];
}

// Runs every real BigQuery query the insight engine needs and returns the
// fully-computed metrics -- the one place both /api/executive-summary and
// /api/consulting-summary pull from, so they never diverge or double-query.
export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  const [
    [channels],
    [costCenters],
    [products],
    [influencerRows],
    [churnRows],
    [storeRows],
    [campaignRows],
    [purchaseCustomerRows],
    [clvCustomerRows],
    [giftedRows],
    [maxDateRows],
  ] = await Promise.all([
    bigquery.query(`SELECT * FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month`),
    bigquery.query(`SELECT * FROM \`${PROJECT}.cost_centers\` ORDER BY period`),
    bigquery.query(`SELECT * FROM \`${PROJECT}.product_lifecycle\` ORDER BY revenue_direct DESC`),
    bigquery.query(`SELECT influencer, SUM(total_revenue) AS revenue, AVG(roi_pct) AS avg_roi
      FROM \`${PROJECT}.influencer_product_performance\` GROUP BY influencer ORDER BY revenue DESC`),
    bigquery.query(`SELECT churn_risk, COUNT(*) AS n FROM \`${PROJECT}.customer_journey\` GROUP BY churn_risk`),
    bigquery.query(`SELECT store_id, store_name, period, revenue FROM \`${PROJECT}.store_performance\` ORDER BY store_id, period`),
    bigquery.query(`SELECT influencer, product_slug, roi_pct FROM \`${PROJECT}.influencer_product_performance\``),
    bigquery.query(`
      SELECT s.user_pseudo_id AS customer_id, DATE(s.event_timestamp) AS purchase_date
      FROM \`${PROJECT}.sales_events\` s
      JOIN \`${PROJECT}.crm_customers\` c ON c.customer_id = s.user_pseudo_id
      WHERE s.event_name = 'purchase' AND s.revenue > 0`),
    bigquery.query(`
      SELECT c.customer_id, c.total_spend, c.order_count, c.first_purchase_date,
        CASE WHEN j.first_touch_source LIKE 'influencer_%' THEN 'influencer' ELSE 'organic' END AS acquisition
      FROM \`${PROJECT}.crm_customers\` c
      LEFT JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id`),
    bigquery.query(`SELECT SUM(gifted_cost) AS total FROM \`${PROJECT}.influencer_product_performance\``),
    bigquery.query(`SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``),
  ]);

  const latestMonth = costCenters.reduce(
    (max: string, r: any) => (r.period > max ? r.period : max),
    costCenters[0]?.period ?? ""
  );
  const latestCostCenters = costCenters.filter((r: any) => r.period === latestMonth);
  const latestChannels = channels
    .filter((r: any) => r.month === latestMonth)
    .map((r: any) => ({
      ...r,
      variance: r.revenue_actual - r.revenue_forecast,
      variance_pct: r.revenue_forecast ? ((r.revenue_actual - r.revenue_forecast) / r.revenue_forecast) * 100 : 0,
    }));

  const totalActual = latestChannels.reduce((s: number, r: any) => s + r.revenue_actual, 0);
  const totalForecast = latestChannels.reduce((s: number, r: any) => s + r.revenue_forecast, 0);

  const monthsSorted = Array.from(new Set(channels.map((r: any) => r.month))).sort() as string[];
  const priorMonth = monthsSorted[monthsSorted.length - 2] ?? null;
  const priorMonthRevenue = priorMonth
    ? channels.filter((r: any) => r.month === priorMonth).reduce((s: number, r: any) => s + r.revenue_actual, 0)
    : null;
  const revenueMoMChangePct = priorMonthRevenue ? ((totalActual - priorMonthRevenue) / priorMonthRevenue) * 100 : null;

  const costCentersWithVariance = latestCostCenters.map((r: any) => ({
    ...r,
    variance_pct: r.budget ? (r.variance / r.budget) * 100 : 0,
  }));
  const worstCostCenter = [...costCentersWithVariance].sort((a, b) => b.variance_pct - a.variance_pct)[0];
  const worstChannel = [...latestChannels].sort((a, b) => a.variance_pct - b.variance_pct)[0];

  const topProduct = products[0];
  const topInfluencer = influencerRows[0];
  const belowThresholdCount = products.filter((p: any) => p.retail_margin_pct < MARGIN_THRESHOLD_PCT).length;
  const highChurnCount = churnRows.find((r: any) => r.churn_risk === "high")?.n ?? 0;

  const maxDate = maxDateRows[0]?.max_date?.value ?? maxDateRows[0]?.max_date;
  const purchaseRowsNormalized = purchaseCustomerRows.map((r: any) => ({
    customer_id: r.customer_id,
    purchase_date: new Date(typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value),
  }));
  const giftedCostTotal = giftedRows[0]?.total ?? 0;

  const allFindings: ActionItem[] = [
    ...checkCostCenterOverspend(costCenters),
    ...checkLowRoiCampaigns(campaignRows),
    ...checkDecliningStores(storeRows),
    ...checkChurnRate(purchaseRowsNormalized),
    ...checkClvCacRatio(clvCustomerRows, giftedCostTotal, maxDate),
  ];
  const actionItems = [...allFindings].sort((a, b) => b.severity - a.severity).slice(0, 3);
  const overallChurnRatePct = Math.round(computeOverallChurnRatePct(purchaseRowsNormalized) * 10) / 10;

  return {
    latestMonth,
    totalActual,
    totalForecast,
    priorMonth,
    priorMonthRevenue,
    revenueMoMChangePct: revenueMoMChangePct !== null ? Math.round(revenueMoMChangePct * 10) / 10 : null,
    overallChurnRatePct,
    topProduct: topProduct ? { name: topProduct.product_name, revenue: topProduct.revenue_direct } : null,
    topInfluencer: topInfluencer
      ? { name: topInfluencer.influencer, revenue: topInfluencer.revenue, avgRoi: topInfluencer.avg_roi }
      : null,
    worstCostCenter: worstCostCenter
      ? { name: worstCostCenter.name, variance: worstCostCenter.variance, variancePct: worstCostCenter.variance_pct }
      : null,
    worstChannel: worstChannel
      ? { channel: worstChannel.channel, variance: worstChannel.variance, variancePct: worstChannel.variance_pct }
      : null,
    belowThresholdCount,
    highChurnCount,
    allFindings,
    actionItems,
    channels: latestChannels,
    costCenters: costCentersWithVariance,
  };
}
