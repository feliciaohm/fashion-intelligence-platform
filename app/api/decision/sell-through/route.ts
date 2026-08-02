import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { safeDivide, INSUFFICIENT_DATA } from "@/lib/data-quality";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const SELL_THROUGH_FLAG_THRESHOLD = 70;

function pctOrInsufficient(sold: number, stock: number) {
  const result = safeDivide(sold, sold + stock);
  return typeof result === "number" ? Math.round(result * 1000) / 10 : result;
}

export async function GET() {
  try {
    const [[productRows], [rangeRows], [marketRows]] = await Promise.all([
      bigquery.query(`
        SELECT p.product_slug, p.category, p.season, p.units_sold_direct, i.stock_level
        FROM \`${PROJECT}.product_lifecycle\` p
        JOIN \`${PROJECT}.inventory\` i ON i.product_slug = p.product_slug
      `),
      bigquery.query(`SELECT MIN(DATE(event_timestamp)) AS min_date, MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``),
      bigquery.query(`
        SELECT country, COUNT(*) AS units_sold
        FROM \`${PROJECT}.sales_events\`
        WHERE event_name = 'purchase' AND revenue > 0 AND country IS NOT NULL
        GROUP BY country
        ORDER BY units_sold DESC
      `),
    ]);

    const minDate = new Date(rangeRows[0]?.min_date?.value ?? rangeRows[0]?.min_date);
    const maxDate = new Date(rangeRows[0]?.max_date?.value ?? rangeRows[0]?.max_date);
    const observedDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000));

    function aggregate(groupKey: "category" | "season") {
      const groups: Record<string, { sold: number; stock: number }> = {};
      productRows.forEach((r: any) => {
        const key = r[groupKey];
        if (!groups[key]) groups[key] = { sold: 0, stock: 0 };
        groups[key].sold += r.units_sold_direct || 0;
        groups[key].stock += r.stock_level || 0;
      });
      return Object.entries(groups).map(([key, g]) => {
        const sellThroughPct = pctOrInsufficient(g.sold, g.stock);
        const dailyVelocity = g.sold / observedDays;
        const daysToDeplete = dailyVelocity > 0 ? Math.round(g.stock / dailyVelocity) : null;
        return {
          [groupKey]: key,
          unitsSold: g.sold,
          unitsRemaining: g.stock,
          totalUnitsAvailable: g.sold + g.stock,
          sellThroughPct,
          belowThreshold: typeof sellThroughPct === "number" && sellThroughPct < SELL_THROUGH_FLAG_THRESHOLD,
          daysToDeplete,
        };
      });
    }

    const byCategory = aggregate("category");
    const bySeason = aggregate("season");

    const totalUnitsSoldAllMarkets = marketRows.reduce((s: number, r: any) => s + r.units_sold, 0);
    const byMarket = marketRows.map((r: any) => ({
      country: r.country,
      unitsSold: r.units_sold,
      shareOfTotalPct: totalUnitsSoldAllMarkets ? Math.round((r.units_sold / totalUnitsSoldAllMarkets) * 1000) / 10 : 0,
    }));

    const products = productRows.map((r: any) => ({
      product_slug: r.product_slug,
      category: r.category,
      season: r.season,
      unitsSold: r.units_sold_direct,
      unitsRemaining: r.stock_level,
      sellThroughPct: pctOrInsufficient(r.units_sold_direct, r.stock_level),
    }));

    return NextResponse.json({
      observedDays,
      threshold: SELL_THROUGH_FLAG_THRESHOLD,
      byCategory,
      bySeason,
      byMarket,
      products,
      insufficientDataLabel: INSUFFICIENT_DATA,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
