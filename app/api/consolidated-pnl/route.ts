import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { monthLabel, formatDeptName, capitalize } from "@/lib/narrative";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
// No fixed-asset register or depreciation schedule exists in this dataset,
// so there is no real source for D&A. 2% of revenue is a documented,
// conservative planning assumption for a light-asset retail/wholesale
// business (leased stores, no owned manufacturing) -- named here exactly
// like the EOQ calculator's order-cost/holding-cost assumptions, not
// presented as derived from Maison Lumière's own books.
const ASSUMED_DA_RATE = 0.02;

function sum(rows: any[], key: string): number {
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}

export async function GET() {
  try {
    const [[channelRows], [costCenterRows]] = await Promise.all([
      bigquery.query(`SELECT * FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month, channel`),
      bigquery.query(`SELECT * FROM \`${PROJECT}.cost_centers\` ORDER BY period, name`),
    ]);

    const months = Array.from(new Set(channelRows.map((r: any) => r.month))).sort() as string[];
    const latestPeriod = months[months.length - 1];
    const priorPeriod = months.length > 1 ? months[months.length - 2] : null;

    const latestChannels = channelRows.filter((r: any) => r.month === latestPeriod);
    const priorChannels = priorPeriod ? channelRows.filter((r: any) => r.month === priorPeriod) : [];
    const latestCostCenters = costCenterRows.filter((r: any) => r.period === latestPeriod);
    const priorCostCenters = priorPeriod ? costCenterRows.filter((r: any) => r.period === priorPeriod) : [];

    const revenueActual = sum(latestChannels, "revenue_actual");
    const revenueBudget = sum(latestChannels, "revenue_forecast");
    const revenuePrior = sum(priorChannels, "revenue_actual");
    const cogsActual = sum(latestChannels, "cogs");
    const cogsPrior = sum(priorChannels, "cogs");
    // No separate COGS budget exists (finance_channel_monthly only budgets
    // revenue) -- budget COGS is the real actual COGS ratio applied to
    // budgeted revenue, so gross-profit-vs-budget is comparable rather than
    // silently assuming 100% budget gross margin.
    const cogsRatio = revenueActual > 0 ? cogsActual / revenueActual : 0;
    const cogsBudget = revenueBudget * cogsRatio;

    const grossProfitActual = revenueActual - cogsActual;
    const grossProfitBudget = revenueBudget - cogsBudget;
    const grossProfitPrior = revenuePrior - cogsPrior;

    const opexActual = sum(latestCostCenters, "actual");
    const opexBudget = sum(latestCostCenters, "budget");
    const opexPrior = sum(priorCostCenters, "actual");

    const ebitdaActual = grossProfitActual - opexActual;
    const ebitdaBudget = grossProfitBudget - opexBudget;
    const ebitdaPrior = grossProfitPrior - opexPrior;

    const daActual = revenueActual * ASSUMED_DA_RATE;
    const daBudget = revenueBudget * ASSUMED_DA_RATE;
    const daPrior = revenuePrior * ASSUMED_DA_RATE;

    const netMarginActual = ebitdaActual - daActual;
    const netMarginBudget = ebitdaBudget - daBudget;
    const netMarginPrior = ebitdaPrior - daPrior;

    const revenueByChannel = latestChannels.map((r: any) => ({
      channel: r.channel,
      actual: r.revenue_actual,
      budget: r.revenue_forecast,
      prior: priorChannels.find((p: any) => p.channel === r.channel)?.revenue_actual ?? null,
    }));

    const opexByDept = latestCostCenters.map((r: any) => ({
      name: r.name,
      actual: r.actual,
      budget: r.budget,
      prior: priorCostCenters.find((p: any) => p.name === r.name)?.actual ?? null,
    }));

    // Management commentary -- same rule-based, real-numbers-only narrative
    // pattern as /api/variance-report, not an LLM call, so this line never
    // depends on external API availability.
    const revenueVarianceVsBudgetPct = revenueBudget ? ((revenueActual - revenueBudget) / revenueBudget) * 100 : 0;
    const revenueVarianceVsPriorPct = revenuePrior ? ((revenueActual - revenuePrior) / revenuePrior) * 100 : 0;
    const ebitdaMarginActual = revenueActual ? (ebitdaActual / revenueActual) * 100 : 0;
    const ebitdaMarginPrior = revenuePrior ? (ebitdaPrior / revenuePrior) * 100 : 0;

    const worstOverspend = [...latestCostCenters].sort((a, b) => b.variance - a.variance)[0];
    const bestChannel = [...revenueByChannel].sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))[0];
    const worstChannel = [...revenueByChannel].sort((a, b) => (a.actual - a.budget) - (b.actual - b.budget))[0];

    const label = monthLabel(latestPeriod);
    const commentary: string[] = [];
    commentary.push(
      `${label} revenue was €${Math.round(revenueActual).toLocaleString()}, ${revenueVarianceVsBudgetPct >= 0 ? "+" : ""}${revenueVarianceVsBudgetPct.toFixed(1)}% vs. budget and ${revenueVarianceVsPriorPct >= 0 ? "+" : ""}${revenueVarianceVsPriorPct.toFixed(1)}% vs. ${priorPeriod ? monthLabel(priorPeriod) : "the prior period"}, driven ${bestChannel.actual >= bestChannel.budget ? "by" : "despite"} ${capitalize(bestChannel.channel)} running ${bestChannel.actual >= bestChannel.budget ? "+" : ""}€${Math.round(bestChannel.actual - bestChannel.budget).toLocaleString()} vs. plan.`
    );
    if (worstOverspend) {
      const dir = worstOverspend.variance >= 0 ? "overspent" : "underspent";
      commentary.push(
        `On costs, ${formatDeptName(worstOverspend.name)} ${dir} by €${Math.abs(worstOverspend.variance).toLocaleString()} against budget, the largest single driver of the €${Math.abs(opexActual - opexBudget).toLocaleString()} total opex variance.`
      );
    }
    if (worstChannel && worstChannel.channel !== bestChannel.channel && worstChannel.actual < worstChannel.budget) {
      commentary.push(
        `${capitalize(worstChannel.channel)} was the weakest channel vs. plan, €${Math.round(worstChannel.budget - worstChannel.actual).toLocaleString()} below budget.`
      );
    }
    commentary.push(
      `EBITDA margin was ${ebitdaMarginActual.toFixed(1)}% this period vs. ${ebitdaMarginPrior.toFixed(1)}% in ${priorPeriod ? monthLabel(priorPeriod) : "the prior period"} — ${ebitdaMarginActual >= ebitdaMarginPrior ? "an improvement" : "a decline"} of ${Math.abs(ebitdaMarginActual - ebitdaMarginPrior).toFixed(1)} points.`
    );

    return NextResponse.json({
      latestPeriod,
      latestPeriodLabel: label,
      priorPeriod,
      priorPeriodLabel: priorPeriod ? monthLabel(priorPeriod) : null,
      revenue: { actual: revenueActual, budget: revenueBudget, prior: revenuePrior },
      cogs: { actual: cogsActual, budget: cogsBudget, prior: cogsPrior },
      grossProfit: { actual: grossProfitActual, budget: grossProfitBudget, prior: grossProfitPrior },
      opex: { actual: opexActual, budget: opexBudget, prior: opexPrior },
      ebitda: { actual: ebitdaActual, budget: ebitdaBudget, prior: ebitdaPrior },
      da: { actual: daActual, budget: daBudget, prior: daPrior, assumedRate: ASSUMED_DA_RATE },
      netMargin: { actual: netMarginActual, budget: netMarginBudget, prior: netMarginPrior },
      revenueByChannel,
      opexByDept,
      commentary,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
