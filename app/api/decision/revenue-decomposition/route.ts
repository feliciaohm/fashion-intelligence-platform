import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  try {
    // shopify_orders (named in the original request) has only 2 unrelated
    // rows and can't support this analysis. product_lifecycle has a single
    // static price per product with no time dimension, so it can't show a
    // real price change either. sales_events is the platform's only source
    // with both a real per-purchase price AND a real timestamp, so it's
    // used instead -- substituting the platform's actual best real source,
    // same pattern as prior passes when a named table didn't fit.
    //
    // Split into two equal-COUNT halves (not a calendar midpoint) because
    // this dataset's ~97 real ecommerce purchases cluster tightly around
    // each campaign's post date -- a calendar midpoint left 3 of 5
    // categories with zero purchases in one half. An equal-count split
    // (oldest half vs newest half) is a standard cohort-comparison
    // technique and keeps most categories present in both halves.
    const [rows] = await bigquery.query(`
      WITH ranked AS (
        SELECT s.revenue, p.category,
          NTILE(2) OVER (ORDER BY s.event_timestamp) AS half
        FROM \`${PROJECT}.sales_events\` s
        JOIN \`${PROJECT}.product_lifecycle\` p ON p.product_slug = s.product_slug
        WHERE s.event_name = 'purchase' AND s.revenue > 0
      )
      SELECT category, half, COUNT(*) AS units, SUM(revenue) AS revenue
      FROM ranked
      GROUP BY category, half
    `);

    type Cat = { units1: number; revenue1: number; units2: number; revenue2: number };
    const byCategory = new Map<string, Cat>();
    rows.forEach((r: any) => {
      const cat = byCategory.get(r.category) ?? { units1: 0, revenue1: 0, units2: 0, revenue2: 0 };
      if (r.half === 1) {
        cat.units1 = r.units;
        cat.revenue1 = r.revenue;
      } else {
        cat.units2 = r.units;
        cat.revenue2 = r.revenue;
      }
      byCategory.set(r.category, cat);
    });

    const totalUnits1 = Array.from(byCategory.values()).reduce((s, c) => s + c.units1, 0);
    const totalRevenue1 = Array.from(byCategory.values()).reduce((s, c) => s + c.revenue1, 0);
    const totalUnits2 = Array.from(byCategory.values()).reduce((s, c) => s + c.units2, 0);
    const totalRevenue2 = Array.from(byCategory.values()).reduce((s, c) => s + c.revenue2, 0);

    const blendedPrice1 = totalUnits1 > 0 ? totalRevenue1 / totalUnits1 : 0;
    const blendedPrice2 = totalUnits2 > 0 ? totalRevenue2 / totalUnits2 : 0;

    const totalGrowth = totalRevenue2 - totalRevenue1;
    const volumeEffect = (totalUnits2 - totalUnits1) * blendedPrice1;

    // Pure price effect: only categories with real sales in BOTH halves have
    // a defined price change. Categories present in only one half (a
    // category with zero sales in the other) are new/discontinued
    // portfolio changes, not a price movement, and are reported separately.
    let priceEffect = 0;
    const newCategories: { category: string; revenue: number }[] = [];
    const discontinuedCategories: { category: string; revenue: number }[] = [];
    byCategory.forEach((c, category) => {
      if (c.units1 > 0 && c.units2 > 0) {
        const price1 = c.revenue1 / c.units1;
        const price2 = c.revenue2 / c.units2;
        priceEffect += (price2 - price1) * c.units2;
      } else if (c.units1 === 0 && c.units2 > 0) {
        newCategories.push({ category, revenue: c.revenue2 });
      } else if (c.units1 > 0 && c.units2 === 0) {
        discontinuedCategories.push({ category, revenue: c.revenue1 });
      }
    });

    // Mix effect is the residual -- captures the portfolio-composition
    // shift (selling proportionally more/less of higher-priced categories),
    // including the new/discontinued category contributions folded in.
    const mixEffect = totalGrowth - volumeEffect - priceEffect;

    const categoryDetail = Array.from(byCategory.entries()).map(([category, c]) => ({
      category,
      units1: c.units1,
      revenue1: c.revenue1,
      avgPrice1: c.units1 > 0 ? Math.round((c.revenue1 / c.units1) * 100) / 100 : null,
      units2: c.units2,
      revenue2: c.revenue2,
      avgPrice2: c.units2 > 0 ? Math.round((c.revenue2 / c.units2) * 100) / 100 : null,
    }));

    const waterfall = [
      { label: "Earlier Cohort Revenue", value: totalRevenue1, isTotal: true },
      { label: "Volume Effect", value: Math.round(volumeEffect) },
      { label: "Price Effect", value: Math.round(priceEffect) },
      { label: "Mix Effect", value: Math.round(mixEffect) },
      { label: "Later Cohort Revenue", value: totalRevenue2, isTotal: true },
    ];

    const methodology = [
      `Data source: this dataset's shopify_orders table has only 2 unrelated rows and product_lifecycle has a single static price per product with no time dimension — neither can show a real price change over time. sales_events (real per-purchase price and timestamp) is used instead.`,
      `The ${totalUnits1 + totalUnits2} real revenue-positive purchases were split into two equal-count halves by date (not a calendar midpoint, which left several categories with zero purchases in one half) — the earlier ${totalUnits1} purchases vs. the later ${totalUnits2}.`,
      `Volume Effect = (total units, later − total units, earlier) × earlier cohort's blended price = €${Math.round(volumeEffect).toLocaleString()}. Price Effect = the real per-category price change applied to later-cohort volumes, summed only across categories with real sales in both halves = €${Math.round(priceEffect).toLocaleString()}. Mix Effect (€${Math.round(mixEffect).toLocaleString()}) is the residual — it captures the shift in which categories sold, including ${newCategories.length > 0 ? `${newCategories.map((c) => c.category).join(", ")} appearing only in the later cohort` : "no categories appearing only in one cohort"}${discontinuedCategories.length > 0 ? ` and ${discontinuedCategories.map((c) => c.category).join(", ")} appearing only in the earlier cohort` : ""}.`,
      `Sample size caveat: this is built from only ${totalUnits1 + totalUnits2} real transactions split across 5 categories and 2 cohorts — several category/cohort cells have single-digit purchase counts. Read the price and mix effects as directional, not precise, and prefer the category detail table below over the single dollar figures for judging reliability.`,
    ];

    return NextResponse.json({
      totalRevenue1,
      totalRevenue2,
      totalGrowth: Math.round(totalGrowth),
      volumeEffect: Math.round(volumeEffect),
      priceEffect: Math.round(priceEffect),
      mixEffect: Math.round(mixEffect),
      blendedPrice1: Math.round(blendedPrice1 * 100) / 100,
      blendedPrice2: Math.round(blendedPrice2 * 100) / 100,
      categoryDetail,
      newCategories,
      discontinuedCategories,
      waterfall,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
