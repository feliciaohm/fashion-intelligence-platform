// Shared real computation behind /api/decision/gmroi, extracted so
// lib/ai-demo-mode.ts can answer GMROI questions from the exact same numbers
// the GMROI calculator shows. See app/decision-intelligence's GMROI panel
// for the UI that consumes /api/decision/gmroi, which now just calls this.
import { bigquery } from "@/lib/bigquery";
import { safeDivide, INSUFFICIENT_DATA } from "@/lib/data-quality";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
export const GMROI_STRONG_BENCHMARK = 3.2;
export const GMROI_ATTENTION_THRESHOLD = 2.0;

export interface GmroiCategory {
  category: string;
  grossMargin: number;
  inventoryValue: number;
  gmroi: number | typeof INSUFFICIENT_DATA;
  status: "strong" | "attention" | "adequate" | "unknown";
}

export interface GmroiSummary {
  categories: GmroiCategory[];
  overallGmroi: number | typeof INSUFFICIENT_DATA;
  strongBenchmark: number;
  attentionThreshold: number;
  productCount: number;
}

export async function getGmroiSummary(): Promise<GmroiSummary> {
  const [rows] = await bigquery.query(`
    SELECT p.category, p.product_slug, p.cost_price, p.retail_price, p.units_sold_direct, i.stock_level
    FROM \`${PROJECT}.product_lifecycle\` p
    JOIN \`${PROJECT}.inventory\` i ON i.product_slug = p.product_slug
  `);

  const byCategory: Record<string, { grossMargin: number; inventoryValue: number }> = {};
  rows.forEach((r: any) => {
    const grossMargin = (r.retail_price - r.cost_price) * r.units_sold_direct;
    const inventoryValue = r.stock_level * r.cost_price;
    if (!byCategory[r.category]) byCategory[r.category] = { grossMargin: 0, inventoryValue: 0 };
    byCategory[r.category].grossMargin += grossMargin;
    byCategory[r.category].inventoryValue += inventoryValue;
  });

  const categories: GmroiCategory[] = Object.entries(byCategory).map(([category, v]) => {
    const gmroi = safeDivide(v.grossMargin, v.inventoryValue);
    const gmroiRounded = typeof gmroi === "number" ? Math.round(gmroi * 100) / 100 : gmroi;
    const status: GmroiCategory["status"] = typeof gmroiRounded !== "number"
      ? "unknown"
      : gmroiRounded >= GMROI_STRONG_BENCHMARK
      ? "strong"
      : gmroiRounded < GMROI_ATTENTION_THRESHOLD
      ? "attention"
      : "adequate";
    return {
      category,
      grossMargin: Math.round(v.grossMargin),
      inventoryValue: Math.round(v.inventoryValue),
      gmroi: gmroiRounded,
      status,
    };
  }).sort((a, b) => (typeof b.gmroi === "number" && typeof a.gmroi === "number" ? b.gmroi - a.gmroi : 0));

  const totalGrossMargin = rows.reduce((s: number, r: any) => s + (r.retail_price - r.cost_price) * r.units_sold_direct, 0);
  const totalInventoryValue = rows.reduce((s: number, r: any) => s + r.stock_level * r.cost_price, 0);
  const overallGmroiRaw = safeDivide(totalGrossMargin, totalInventoryValue);
  const overallGmroi = typeof overallGmroiRaw === "number" ? Math.round(overallGmroiRaw * 100) / 100 : overallGmroiRaw;

  return {
    categories,
    overallGmroi,
    strongBenchmark: GMROI_STRONG_BENCHMARK,
    attentionThreshold: GMROI_ATTENTION_THRESHOLD,
    productCount: rows.length,
  };
}
