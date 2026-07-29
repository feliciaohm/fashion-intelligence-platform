import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { monthLabel, formatDeptName, capitalize } from "@/lib/narrative";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  const costCentersQuery = `SELECT * FROM \`${PROJECT}.cost_centers\` ORDER BY period, name`;
  const channelsQuery = `SELECT * FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month, channel`;

  try {
    const [[costCentersRaw], [channelsRaw]] = await Promise.all([
      bigquery.query(costCentersQuery),
      bigquery.query(channelsQuery),
    ]);

    const costCenters = costCentersRaw.map((r: any) => ({
      ...r,
      variance_pct: r.budget ? (r.variance / r.budget) * 100 : 0,
    }));
    const channels = channelsRaw.map((r: any) => {
      const variance = r.revenue_actual - r.revenue_forecast;
      return {
        ...r,
        variance,
        variance_pct: r.revenue_forecast ? (variance / r.revenue_forecast) * 100 : 0,
      };
    });

    const latestPeriod = costCenters.reduce(
      (max: string, r: any) => (r.period > max ? r.period : max),
      costCenters[0]?.period ?? ""
    );
    const latestCostCenters = costCenters.filter((r: any) => r.period === latestPeriod);
    const latestChannels = channels.filter((r: any) => r.month === latestPeriod);

    const totalBudget = latestCostCenters.reduce((s: number, r: any) => s + r.budget, 0);
    const totalActual = latestCostCenters.reduce((s: number, r: any) => s + r.actual, 0);
    const overallVariance = totalActual - totalBudget;

    const worstOverspend = [...latestCostCenters].sort((a, b) => b.variance - a.variance)[0];
    const worstUnderspend = [...latestCostCenters].sort((a, b) => a.variance - b.variance)[0];
    const bestChannel = [...latestChannels].sort((a, b) => b.variance - a.variance)[0];
    const worstChannel = [...latestChannels].sort((a, b) => a.variance - b.variance)[0];

    const label = monthLabel(latestPeriod);
    const narrative: string[] = [];

    narrative.push(
      `In ${label}, total cost center spend was €${totalActual.toLocaleString()} against a budget of €${totalBudget.toLocaleString()} — ${
        overallVariance >= 0 ? "an overspend" : "an underspend"
      } of €${Math.abs(overallVariance).toLocaleString()} (${((overallVariance / totalBudget) * 100).toFixed(1)}%).`
    );

    if (worstOverspend && worstOverspend.variance > 0) {
      narrative.push(
        `${formatDeptName(worstOverspend.name)} drove the largest overspend: €${worstOverspend.variance.toLocaleString()} over budget (${worstOverspend.variance_pct.toFixed(1)}%).`
      );
    }
    if (worstUnderspend && worstUnderspend.variance < 0 && worstUnderspend.name !== worstOverspend?.name) {
      narrative.push(
        `${formatDeptName(worstUnderspend.name)} came in furthest under budget: €${Math.abs(worstUnderspend.variance).toLocaleString()} below plan (${worstUnderspend.variance_pct.toFixed(1)}%).`
      );
    }
    if (bestChannel) {
      const dir = bestChannel.variance >= 0 ? "above" : "below";
      narrative.push(
        `On revenue, ${capitalize(bestChannel.channel)} led the month: €${Math.abs(bestChannel.variance).toLocaleString()} ${dir} forecast (${bestChannel.variance_pct.toFixed(1)}%).`
      );
    }
    if (worstChannel && worstChannel.channel !== bestChannel?.channel) {
      const dir = worstChannel.variance >= 0 ? "above" : "below";
      narrative.push(
        `${capitalize(worstChannel.channel)} was the weakest channel this month: €${Math.abs(worstChannel.variance).toLocaleString()} ${dir} forecast (${worstChannel.variance_pct.toFixed(1)}%).`
      );
    }

    return NextResponse.json({
      latestPeriod,
      latestPeriodLabel: label,
      narrative,
      costCenters,
      channels,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
