import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Used only when a category has fewer than 2 distinct real price points to
// compute elasticity from -- this dataset has no historical price-CHANGE
// events (product_data holds one static price per product), so in-category
// cross-sectional variation is the only real signal available. When even
// that doesn't exist, we fall back to a commonly cited luxury-goods
// benchmark, and say so plainly rather than presenting it as measured.
const BENCHMARK_LUXURY_ELASTICITY = -0.4;

function linearRegressionSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return BENCHMARK_LUXURY_ELASTICITY;
  return (n * sumXY - sumX * sumY) / denom;
}

export async function POST(req: Request) {
  const { category, priceChangePct } = await req.json();

  if (!category || priceChangePct === undefined || priceChangePct === null) {
    return NextResponse.json({ error: "category and priceChangePct are required" }, { status: 400 });
  }

  try {
    const [rows] = await bigquery.query({
      query: `SELECT retail_price, cost_price, units_sold_direct, revenue_direct FROM \`${PROJECT}.product_lifecycle\` WHERE category = @category`,
      params: { category },
      types: { category: "STRING" },
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: `No products found in category "${category}"` }, { status: 404 });
    }

    // Aggregate to distinct real price points within the category.
    const byPrice = new Map<number, { units: number; revenue: number; costWeighted: number }>();
    rows.forEach((r: any) => {
      const existing = byPrice.get(r.retail_price) ?? { units: 0, revenue: 0, costWeighted: 0 };
      existing.units += r.units_sold_direct;
      existing.revenue += r.revenue_direct;
      existing.costWeighted += r.cost_price * r.units_sold_direct;
      byPrice.set(r.retail_price, existing);
    });
    const distinctPricePoints = Array.from(byPrice.entries())
      .filter(([, v]) => v.units > 0)
      .map(([price, v]) => ({ price, units: v.units }));

    let elasticity: number;
    let elasticityBasis: string;

    if (distinctPricePoints.length >= 3) {
      const points = distinctPricePoints.map((p) => ({ x: Math.log(p.price), y: Math.log(p.units) }));
      elasticity = linearRegressionSlope(points);
      elasticityBasis = `computed from a regression across ${distinctPricePoints.length} distinct real price points within ${category} (prices: ${distinctPricePoints.map((p) => `€${p.price}`).join(", ")})`;
    } else if (distinctPricePoints.length === 2) {
      const [a, b] = distinctPricePoints.sort((x, y) => x.price - y.price);
      const pctPriceDiff = ((b.price - a.price) / a.price) * 100;
      const pctUnitsDiff = ((b.units - a.units) / a.units) * 100;
      elasticity = pctPriceDiff !== 0 ? pctUnitsDiff / pctPriceDiff : BENCHMARK_LUXURY_ELASTICITY;
      elasticityBasis = `computed as a two-point elasticity between the only two real price levels in ${category}: €${a.price} (${a.units} units sold) and €${b.price} (${b.units} units sold)`;
    } else {
      elasticity = BENCHMARK_LUXURY_ELASTICITY;
      elasticityBasis = `${category} has only ${distinctPricePoints.length} real price point — not enough in-category price variation to compute elasticity empirically, so a standard luxury-goods benchmark (${BENCHMARK_LUXURY_ELASTICITY}) is used instead`;
    }

    const totalUnits = rows.reduce((s: number, r: any) => s + r.units_sold_direct, 0);
    const totalRevenue = rows.reduce((s: number, r: any) => s + r.revenue_direct, 0);
    const totalCostWeighted = rows.reduce((s: number, r: any) => s + r.cost_price * r.units_sold_direct, 0);
    const currentAvgPrice = totalRevenue / totalUnits;
    const currentAvgCost = totalCostWeighted / totalUnits;
    const currentGrossMargin = totalRevenue - totalCostWeighted;

    const pctUnitsChange = elasticity * priceChangePct;
    const projectedUnits = Math.round(totalUnits * (1 + pctUnitsChange / 100));
    const projectedAvgPrice = currentAvgPrice * (1 + priceChangePct / 100);
    const projectedRevenue = Math.round(projectedUnits * projectedAvgPrice);
    const projectedGrossMargin = Math.round(projectedRevenue - projectedUnits * currentAvgCost);

    const revenueChangePct = Math.round(((projectedRevenue - totalRevenue) / totalRevenue) * 1000) / 10;
    const marginChangePct = Math.round(((projectedGrossMargin - currentGrossMargin) / currentGrossMargin) * 1000) / 10;

    const methodology = [
      `Elasticity for ${category} is ${elasticityBasis}. An elasticity of ${elasticity.toFixed(2)} means a 1% price increase is associated with roughly a ${Math.abs(elasticity).toFixed(2)}% ${elasticity < 0 ? "decrease" : "increase"} in units sold.`,
      `Current baseline: ${totalUnits} units sold direct-channel at a revenue-weighted average price of €${currentAvgPrice.toFixed(0)}, for €${totalRevenue.toLocaleString()} in revenue and €${Math.round(currentGrossMargin).toLocaleString()} in gross margin.`,
      `A ${priceChangePct >= 0 ? "+" : ""}${priceChangePct}% price change projects a ${pctUnitsChange >= 0 ? "+" : ""}${pctUnitsChange.toFixed(1)}% change in units (elasticity × price change), applied to the current baseline. Cost price is held constant — this does not model any cost changes.`,
      `This is a cross-sectional estimate from real but limited in-category price variation (or an industry benchmark where that variation doesn't exist) — not a controlled price-change experiment. Treat it as directional.`,
    ];

    return NextResponse.json({
      inputs: { category, priceChangePct },
      elasticity: Math.round(elasticity * 100) / 100,
      distinctPricePointCount: distinctPricePoints.length,
      current: {
        units: totalUnits,
        avgPrice: Math.round(currentAvgPrice),
        revenue: totalRevenue,
        grossMargin: Math.round(currentGrossMargin),
      },
      projected: {
        units: projectedUnits,
        avgPrice: Math.round(projectedAvgPrice),
        revenue: projectedRevenue,
        grossMargin: projectedGrossMargin,
      },
      revenueChangePct,
      marginChangePct,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
