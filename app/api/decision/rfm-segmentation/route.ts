import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Assigns 1-5 by quintile rank across `values`, where the LAST position in
// `orderedIds` (after the caller sorts however "best" should mean 5) gets
// the top score. Ties are broken by array order, which only matters when a
// dimension isn't fully degenerate (handled separately below).
function quintileScore(orderedIds: string[]): Record<string, number> {
  const n = orderedIds.length;
  const scores: Record<string, number> = {};
  orderedIds.forEach((id, i) => {
    scores[id] = Math.min(5, Math.floor((i / n) * 5) + 1);
  });
  return scores;
}

export async function GET() {
  try {
    const [rows] = await bigquery.query(`
      SELECT c.customer_id, c.total_spend, c.order_count, c.country, c.segment AS crm_segment,
             j.days_since_last_activity
      FROM \`${PROJECT}.crm_customers\` c
      LEFT JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id
      WHERE j.days_since_last_activity IS NOT NULL
    `);

    // Recency: lower days-since-activity is better, so sort worst-first
    // (descending) -- the most recent customer lands last and gets score 5.
    const byRecencyDesc = [...rows].sort((a: any, b: any) => b.days_since_last_activity - a.days_since_last_activity);
    const rScores = quintileScore(byRecencyDesc.map((r: any) => r.customer_id));

    // Frequency: every real customer here has order_count = 1 (verified
    // directly against BigQuery -- zero repeat purchases exist in this
    // dataset yet, the same fact behind Growth Bridge's "zero retained
    // customers" finding). Quintile-ranking a constant is meaningless and
    // would just encode array order as fake differentiation, so F is held
    // at a neutral 3 for everyone until real repeat-purchase data exists.
    const orderCounts = rows.map((r: any) => r.order_count);
    const frequencyIsDegenerate = Math.max(...orderCounts) === Math.min(...orderCounts);
    let fScores: Record<string, number>;
    if (frequencyIsDegenerate) {
      fScores = Object.fromEntries(rows.map((r: any) => [r.customer_id, 3]));
    } else {
      const byFrequencyAsc = [...rows].sort((a: any, b: any) => a.order_count - b.order_count);
      fScores = quintileScore(byFrequencyAsc.map((r: any) => r.customer_id));
    }

    // Monetary: higher total_spend is better, sort ascending (best last).
    const byMonetaryAsc = [...rows].sort((a: any, b: any) => a.total_spend - b.total_spend);
    const mScores = quintileScore(byMonetaryAsc.map((r: any) => r.customer_id));

    // When F is degenerate (everyone tied at a neutral 3), requiring F≥4 or
    // F≤2 in the segment boundaries would make Champions, Lost, and New
    // Customers ALL structurally impossible at once -- verified directly
    // (only "At Risk" and "Developing" would ever populate). Real Recency
    // and Monetary variation is enough on its own to define all four
    // segments meaningfully, so F is dropped from the boundary conditions
    // (not from the displayed score) whenever it's degenerate.
    function segmentFor(r: number, f: number, m: number): string {
      if (frequencyIsDegenerate) {
        if (r >= 4 && m >= 4) return "Champions";
        if (r <= 2 && m >= 4) return "At Risk";
        if (r <= 2 && m <= 2) return "Lost";
        if (r >= 4 && m <= 2) return "New Customers";
        return "Developing";
      }
      if (r >= 4 && f >= 4 && m >= 4) return "Champions";
      if (r <= 2 && (f >= 4 || m >= 4)) return "At Risk";
      if (r <= 2 && f <= 2 && m <= 2) return "Lost";
      if (r >= 4 && f <= 2) return "New Customers";
      return "Developing";
    }

    const customers = rows.map((row: any) => {
      const r = rScores[row.customer_id];
      const f = fScores[row.customer_id];
      const m = mScores[row.customer_id];
      return {
        customer_id: row.customer_id,
        country: row.country,
        crm_segment: row.crm_segment,
        total_spend: row.total_spend,
        days_since_last_activity: row.days_since_last_activity,
        r,
        f,
        m,
        segment: segmentFor(r, f, m),
      };
    });

    const segmentCounts: Record<string, number> = {};
    customers.forEach((c) => {
      segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
    });

    return NextResponse.json({
      customers,
      segmentCounts,
      totalCustomers: customers.length,
      frequencyIsDegenerate,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
