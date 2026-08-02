// Shared data-quality primitives used by /api/data-quality and by every
// calculator/page that wants to show its own "X data points, Y excluded"
// indicator (components/DataQualityIndicator.tsx). Kept deliberately small
// and dependency-free so it can run both server-side (API routes) and
// client-side (the outlier include/exclude toggle on /data-quality).

// Real distinct country values found across sales_events, crm_customers,
// influencer_product_performance, and store_performance (checked directly
// against BigQuery, not assumed). "UK" is deliberately included even though
// it looks like a code already -- it isn't a real ISO 3166-1 alpha-2 code
// (that's "GB"), so normalizing it is a real fix, not a no-op.
export const COUNTRY_TO_ISO: Record<string, string> = {
  Australia: "AU",
  China: "CN",
  Denmark: "DK",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Italy: "IT",
  Japan: "JP",
  Netherlands: "NL",
  Norway: "NO",
  Singapore: "SG",
  "South Korea": "KR",
  Sweden: "SE",
  UK: "GB",
  US: "US",
};

export interface NormalizationChange {
  field: "country" | "currency";
  from: string;
  to: string;
  recordCount: number;
}

export function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  return COUNTRY_TO_ISO[raw] ?? raw;
}

// Every amount in this platform's real tables is already stored in EUR --
// verified there is no `currency` column anywhere in the schema and no
// symbol/ISO-code prefix in any revenue field. The normalizer exists (and is
// run for real on every /api/data-quality load) specifically so that the
// day a real multi-currency source is connected (e.g. a US-dollar Shopify
// store via Settings), it starts converting instead of silently mixing
// currencies -- not theater for a problem that doesn't exist yet.
const EUR_FX_TO_EUR: Record<string, number> = {
  USD: 0.92,
  GBP: 1.17,
  SEK: 0.088,
};

export function normalizeCurrencyToEur(amount: number, currency: string | null | undefined): number {
  if (!currency || currency === "EUR") return amount;
  const rate = EUR_FX_TO_EUR[currency];
  return rate ? Math.round(amount * rate * 100) / 100 : amount;
}

// Sentinel type: every ratio/rate calculation in this platform should return
// this instead of a raw number when the denominator is zero or the inputs
// are missing -- "Infinity", "-Infinity", and "NaN" are the exact failure
// mode a CFO screenshot exposes a demo with. Callers check
// `typeof result === "number"` to decide whether to render it or the label.
export const INSUFFICIENT_DATA = "Insufficient data" as const;
export type SafeDivideResult = number | typeof INSUFFICIENT_DATA;

export function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined): SafeDivideResult {
  if (numerator == null || denominator == null || denominator === 0 || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return INSUFFICIENT_DATA;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : INSUFFICIENT_DATA;
}

export interface OutlierResult<T> {
  mean: number;
  stddev: number;
  threshold: number;
  sigmaUsed: number;
  outliers: (T & { value: number; zScore: number })[];
  normal: (T & { value: number; zScore: number })[];
}

// Flags any point more than `sigma` standard deviations above the mean --
// deliberately one-sided (a suspiciously large order is the review case
// specified; a suspiciously small one is a return/discount, not a data
// quality concern the same way).
export function detectOutliers<T>(
  rows: T[],
  getValue: (row: T) => number,
  sigma = 3
): OutlierResult<T> {
  const values = rows.map(getValue);
  const n = values.length;
  const mean = n ? values.reduce((s, v) => s + v, 0) / n : 0;
  const variance = n ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0;
  const stddev = Math.sqrt(variance);
  const threshold = mean + sigma * stddev;

  const withZ = rows.map((row) => {
    const value = getValue(row);
    const zScore = stddev ? Math.round(((value - mean) / stddev) * 100) / 100 : 0;
    return { ...row, value, zScore };
  });

  return {
    mean: Math.round(mean * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    threshold: Math.round(threshold * 100) / 100,
    sigmaUsed: sigma,
    outliers: withZ.filter((r) => r.value > threshold),
    normal: withZ.filter((r) => r.value <= threshold),
  };
}
