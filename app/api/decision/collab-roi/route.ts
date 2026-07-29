import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function POST(req: Request) {
  const { collaborator, cost, targetMarket, category } = await req.json();

  if (!cost || !targetMarket || !category) {
    return NextResponse.json({ error: "cost, targetMarket, and category are required" }, { status: 400 });
  }

  try {
    // Every real campaign, joined to its product's category via product_lifecycle.
    const [campaigns] = await bigquery.query(
      `SELECT c.*, p.category
       FROM \`${PROJECT}.influencer_product_performance\` c
       JOIN \`${PROJECT}.product_lifecycle\` p ON p.product_slug = c.product_slug`
    );

    // Narrow to the closest real comparable set: same market + category first,
    // falling back to whichever single filter has enough campaigns to be
    // meaningful (3+) rather than silently returning a number computed from 1 row.
    const sameMarketAndCategory = campaigns.filter(
      (c: any) => c.country === targetMarket && c.category === category
    );
    const sameCategory = campaigns.filter((c: any) => c.category === category);
    const sameMarket = campaigns.filter((c: any) => c.country === targetMarket);

    let comparable = sameMarketAndCategory;
    let basis = `campaigns in ${category} run specifically in ${targetMarket}`;
    if (comparable.length < 3) {
      comparable = sameCategory.length >= 3 ? sameCategory : sameMarket.length >= 3 ? sameMarket : campaigns;
      basis =
        comparable === sameCategory
          ? `all ${category} campaigns across every market (too few ${targetMarket}-specific ${category} campaigns to use alone)`
          : comparable === sameMarket
          ? `all campaigns in ${targetMarket} across every category (too few ${category} campaigns run there)`
          : `all 40 historical campaigns (too few in ${category}/${targetMarket} specifically)`;
    }

    const avgRoiPct = comparable.reduce((s: number, c: any) => s + c.roi_pct, 0) / comparable.length;
    const totalGifted = comparable.reduce((s: number, c: any) => s + c.gifted_cost, 0);
    const totalRevenue = comparable.reduce((s: number, c: any) => s + c.total_revenue, 0);
    const revenuePerGiftedEuro = totalRevenue / totalGifted;

    const projectedRevenue = Math.round(cost * revenuePerGiftedEuro);
    const projectedRoiPct = Math.round(((projectedRevenue - cost) / cost) * 1000) / 10;

    // Halo effect: real category-wide direct revenue vs. the revenue
    // specifically attributed to gifted products within campaigns in that
    // category -- the gap is a proxy for spillover onto adjacent products.
    const [categoryRevenueRows] = await bigquery.query({
      query: `SELECT SUM(revenue_direct) AS total FROM \`${PROJECT}.product_lifecycle\` WHERE category = @category`,
      params: { category },
      types: { category: "STRING" },
    });
    const categoryTotalRevenue = categoryRevenueRows[0]?.total ?? 0;
    const giftedProductRevenue = sameCategory.reduce((s: number, c: any) => s + c.total_revenue, 0);
    const haloRevenue = Math.max(0, categoryTotalRevenue - giftedProductRevenue);
    const haloRatio = giftedProductRevenue > 0 ? haloRevenue / giftedProductRevenue : 0;
    const projectedHaloRevenue = Math.round(projectedRevenue * haloRatio);

    // Recommended attribution window: real days-to-convert for visitors whose
    // first touch came from an influencer post.
    const [journeyRows] = await bigquery.query(
      `SELECT days_to_convert FROM \`${PROJECT}.customer_journey\` WHERE first_touch_source LIKE 'influencer_%'`
    );
    const conversionDays = journeyRows.map((r: any) => r.days_to_convert).sort((a: number, b: number) => a - b);
    const p80Index = Math.min(conversionDays.length - 1, Math.ceil(conversionDays.length * 0.8) - 1);
    const recommendedWindowDays = conversionDays.length > 0 ? conversionDays[p80Index] : null;
    const avgConversionDays =
      conversionDays.length > 0 ? conversionDays.reduce((a: number, b: number) => a + b, 0) / conversionDays.length : null;

    const methodology = [
      `Projected revenue and ROI are based on ${comparable.length} real historical campaigns: ${basis}. Their combined €${totalGifted.toLocaleString()} in gifted cost produced €${totalRevenue.toLocaleString()} in attributed revenue — a real ratio of €${revenuePerGiftedEuro.toFixed(2)} revenue per €1 gifted, applied to your €${cost.toLocaleString()} input.`,
      `Average ROI across this comparable set is ${avgRoiPct.toFixed(1)}% — shown for context alongside the revenue-ratio-based projection above, which is what drives the headline number.`,
      categoryTotalRevenue > 0
        ? `Halo effect: ${category} products overall generated €${categoryTotalRevenue.toLocaleString()} in direct-channel revenue, while campaigns specifically gifting ${category} products are attributed €${giftedProductRevenue.toLocaleString()} of that. The €${haloRevenue.toLocaleString()} gap (a €${haloRatio.toFixed(2)} halo ratio per €1 of direct campaign revenue) is a proxy for spillover onto adjacent products in the same category — not a controlled measurement of causality.`
        : `No direct-channel revenue recorded for ${category} — halo effect can't be estimated for this category.`,
      recommendedWindowDays !== null
        ? `Recommended attribution window: ${recommendedWindowDays} days — the real 80th-percentile days-to-convert across ${conversionDays.length} visitors whose first touch came from an influencer post (average was ${avgConversionDays!.toFixed(1)} days). An 80th-percentile window is a common analytics convention: wide enough to capture most real conversions without extending indefinitely.`
        : `No influencer-attributed conversions recorded yet — attribution window can't be estimated from real data.`,
    ];

    return NextResponse.json({
      inputs: { collaborator, cost, targetMarket, category },
      comparableCampaignCount: comparable.length,
      avgRoiPct: Math.round(avgRoiPct * 10) / 10,
      revenuePerGiftedEuro: Math.round(revenuePerGiftedEuro * 100) / 100,
      projectedRevenue,
      projectedRoiPct,
      projectedHaloRevenue,
      haloRatio: Math.round(haloRatio * 100) / 100,
      recommendedWindowDays,
      avgConversionDays: avgConversionDays !== null ? Math.round(avgConversionDays * 10) / 10 : null,
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
