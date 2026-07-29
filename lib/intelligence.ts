// Client-safe: types, labels, and pure helpers only. No BigQuery import here --
// this file is imported by the client component app/intelligence/page.tsx, and
// importing the BigQuery Node client (even transitively, via lib/bigquery.ts)
// pulls in google-auth-library's Node-only deps (fs/net/tls/child_process),
// which breaks the client bundle. Server-only query logic lives in
// lib/intelligence-server.ts instead.

export const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export type DimensionKey =
  | "influencer"
  | "product"
  | "country"
  | "channel"
  | "department"
  | "time_period";

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  influencer: "Influencer",
  product: "Product",
  country: "Country",
  channel: "Channel",
  department: "Department",
  time_period: "Time Period",
};

export interface FilterTag {
  dimension: DimensionKey;
  value: string;
  label: string;
}

export const TIME_PERIODS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

// "Q2 2026" -> a DATE range (for DATE columns) and the matching "YYYY-MM"
// month strings (for the tables that store period as a string, e.g.
// finance_channel_monthly.month).
export function quarterToRange(label: string): { start: string; end: string; months: string[] } {
  const [q, yearStr] = label.split(" ");
  const quarter = Number(q.replace("Q", ""));
  const year = Number(yearStr);
  const startMonth = (quarter - 1) * 3 + 1;
  const months = [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, "0")}`);
  const start = `${months[0]}-01`;
  const endMonthNum = startMonth + 2;
  const lastDay = new Date(year, endMonthNum, 0).getDate();
  const end = `${year}-${String(endMonthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, months };
}
