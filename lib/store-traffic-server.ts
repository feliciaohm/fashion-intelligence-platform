// Shared real computation behind /api/decision/store-traffic. Uses columns
// that were already real in store_performance (footfall, transactions,
// conversion_rate_pct, avg_transaction_value) but had never been surfaced
// as an actual insight anywhere -- just raw columns in the Store
// Performance data table. This is the first place they're used to compute
// something, not just displayed.
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export interface StoreTrafficRow {
  storeName: string;
  city: string;
  footfall: number;
  transactions: number;
  conversionRatePct: number;
  avgTransactionValue: number;
  revenue: number;
  // "attention" if this store's conversion rate is materially below the
  // platform's own average across all stores for the same period -- an
  // internal, relative comparison, not an external benchmark (unlike
  // Benchmark Intelligence, there's no sourced published "average luxury
  // retail conversion rate" being claimed here).
  status: "strong" | "adequate" | "attention";
}

export interface StoreTrafficSummary {
  period: string;
  stores: StoreTrafficRow[];
  totalFootfall: number;
  totalTransactions: number;
  blendedConversionRatePct: number;
  avgTransactionValue: number;
  attentionThreshold: number;
}

export async function getStoreTrafficSummary(): Promise<StoreTrafficSummary> {
  const [periodRows] = await bigquery.query(
    `SELECT MAX(period) AS period FROM \`${PROJECT}.store_performance\``
  );
  const period = periodRows[0]?.period;

  const [rows] = await bigquery.query({
    query: `
      SELECT store_name, city, footfall, transactions, conversion_rate_pct, avg_transaction_value, revenue
      FROM \`${PROJECT}.store_performance\`
      WHERE period = @period
      ORDER BY footfall DESC
    `,
    params: { period },
  });

  if (rows.length === 0) {
    return {
      period: period ?? "",
      stores: [],
      totalFootfall: 0,
      totalTransactions: 0,
      blendedConversionRatePct: 0,
      avgTransactionValue: 0,
      attentionThreshold: 0,
    };
  }

  const totalFootfall = rows.reduce((s: number, r: any) => s + r.footfall, 0);
  const totalTransactions = rows.reduce((s: number, r: any) => s + r.transactions, 0);
  const blendedConversionRatePct = totalFootfall > 0 ? (totalTransactions / totalFootfall) * 100 : 0;
  const avgTransactionValue = rows.reduce((s: number, r: any) => s + r.avg_transaction_value, 0) / rows.length;

  // Relative internal threshold: a store is flagged "attention" if its own
  // conversion rate is more than 20% below the blended average across all
  // stores this period -- a real, computable comparison against this
  // platform's own other stores, not a claimed external number.
  const attentionThreshold = blendedConversionRatePct * 0.8;

  const stores: StoreTrafficRow[] = rows.map((r: any) => ({
    storeName: r.store_name,
    city: r.city,
    footfall: r.footfall,
    transactions: r.transactions,
    conversionRatePct: r.conversion_rate_pct,
    avgTransactionValue: r.avg_transaction_value,
    revenue: r.revenue,
    status:
      r.conversion_rate_pct < attentionThreshold
        ? "attention"
        : r.conversion_rate_pct > blendedConversionRatePct * 1.1
        ? "strong"
        : "adequate",
  }));

  return {
    period,
    stores,
    totalFootfall,
    totalTransactions,
    blendedConversionRatePct: Math.round(blendedConversionRatePct * 10) / 10,
    avgTransactionValue: Math.round(avgTransactionValue),
    attentionThreshold: Math.round(attentionThreshold * 10) / 10,
  };
}
