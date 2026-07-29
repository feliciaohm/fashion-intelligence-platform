import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const increasePct = Number(searchParams.get("increasePct") ?? "20");

  const query = `
    SELECT
      SUM(gifted_cost) AS historical_gifted_cost,
      SUM(total_revenue) AS historical_revenue,
      ROUND(SAFE_DIVIDE(SUM(total_revenue) - SUM(gifted_cost), SUM(gifted_cost)) * 100, 1) AS historical_roi_pct
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
  `;

  const topInfluencersQuery = `
    SELECT
      influencer,
      SUM(gifted_cost) AS gifted_cost,
      SUM(total_revenue) AS total_revenue,
      ROUND(SAFE_DIVIDE(SUM(total_revenue) - SUM(gifted_cost), SUM(gifted_cost)) * 100, 1) AS roi_pct
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
    GROUP BY influencer
    HAVING gifted_cost > 0
    ORDER BY roi_pct DESC
    LIMIT 5
  `;

  try {
    const [[historical]] = await bigquery.query(query);
    const [topInfluencers] = await bigquery.query(topInfluencersQuery);

    const historicalGiftedCost = historical.historical_gifted_cost;
    const historicalRevenue = historical.historical_revenue;
    const historicalRoiPct = historical.historical_roi_pct;

    const newGiftedCost = historicalGiftedCost * (1 + increasePct / 100);
    const additionalSpend = newGiftedCost - historicalGiftedCost;
    const projectedAdditionalRevenue = additionalSpend * (1 + historicalRoiPct / 100);
    const projectedTotalRevenue = historicalRevenue + projectedAdditionalRevenue;
    const projectedNetNewProfit = projectedAdditionalRevenue - additionalSpend;

    return NextResponse.json({
      increasePct,
      historical: {
        giftedCost: historicalGiftedCost,
        revenue: historicalRevenue,
        roiPct: historicalRoiPct,
      },
      projected: {
        giftedCost: Math.round(newGiftedCost),
        additionalSpend: Math.round(additionalSpend),
        additionalRevenue: Math.round(projectedAdditionalRevenue),
        totalRevenue: Math.round(projectedTotalRevenue),
        netNewProfit: Math.round(projectedNetNewProfit),
      },
      topRoiInfluencers: topInfluencers,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
