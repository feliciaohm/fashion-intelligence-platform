import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { monthLabel } from "@/lib/narrative";
import { getExecutiveMetrics, buildFallbackInsight } from "@/lib/insights-server";

export async function GET() {
  try {
    const metrics = await getExecutiveMetrics();
    const { latestMonth, totalActual, totalForecast, worstCostCenter, worstChannel, belowThresholdCount, highChurnCount } = metrics;

    let insight = buildFallbackInsight({ worstCostCenter, worstChannel, belowThresholdCount, highChurnCount });
    let insightSource: "ai" | "rule-based" = "rule-based";

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 150,
          system: `You are the morning-briefing assistant for a fashion brand's CFO/CEO. Given these real computed metrics for ${monthLabel(latestMonth)}, write exactly ONE short, direct sentence (under 35 words) naming the single most important thing that needs attention. Use only the numbers given — never invent a figure. No preamble, just the sentence.`,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                month: latestMonth,
                revenue_actual: totalActual,
                revenue_forecast: totalForecast,
                worst_cost_center: worstCostCenter
                  ? { name: worstCostCenter.name, variance_pct: Math.round(worstCostCenter.variancePct * 10) / 10 }
                  : null,
                worst_channel: worstChannel
                  ? { channel: worstChannel.channel, variance_pct: Math.round(worstChannel.variancePct * 10) / 10 }
                  : null,
                products_below_margin_threshold: belowThresholdCount,
                high_churn_risk_customers: highChurnCount,
              }),
            },
          ],
        });
        const text = message.content
          .filter((block) => block.type === "text")
          .map((block) => (block as any).text)
          .join(" ")
          .trim();
        if (text) {
          insight = text;
          insightSource = "ai";
        }
      } catch (err) {
        console.error("EXECUTIVE INSIGHT AI ERROR (falling back to rule-based):", err);
      }
    }

    return NextResponse.json({
      month: latestMonth,
      monthLabel: monthLabel(latestMonth),
      revenueActual: totalActual,
      revenueForecast: totalForecast,
      revenueVariance: totalActual - totalForecast,
      priorMonth: metrics.priorMonth,
      priorMonthLabel: metrics.priorMonth ? monthLabel(metrics.priorMonth) : null,
      priorMonthRevenue: metrics.priorMonthRevenue,
      revenueMoMChangePct: metrics.revenueMoMChangePct,
      overallChurnRatePct: metrics.overallChurnRatePct,
      topProduct: metrics.topProduct,
      topInfluencer: metrics.topInfluencer,
      worstCostCenter,
      belowThresholdCount,
      highChurnCount,
      insight,
      insightSource,
      actionItems: metrics.actionItems,
      allFindingsCount: metrics.allFindings.length,
      channels: metrics.channels,
      costCenters: metrics.costCenters,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
