import { NextResponse } from "next/server";
import { monthLabel, capitalize } from "@/lib/narrative";
import { getExecutiveMetrics } from "@/lib/insights-server";
import { getBenchmarkResults } from "@/lib/benchmarks-server";
import type { BenchmarkResult } from "@/lib/benchmarks";

function formatBenchmarkValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === ":1") return `${value.toFixed(2)}:1`;
  return `${value.toFixed(2)}x`;
}

// Raw numeric comparison -- literally is the platform's number above or
// below the industry average, independent of whether that's good or bad.
function benchmarkRawPct(b: BenchmarkResult): number {
  if (b.platformValue === null || !b.industryAverage) return 0;
  return ((b.platformValue - b.industryAverage) / b.industryAverage) * 100;
}

// Favorability-adjusted gap -- positive means "better than the industry
// average" regardless of metric direction (e.g. a lower return rate is a
// positive gapPct even though the raw number is literally below average).
function benchmarkGapPct(b: BenchmarkResult): number {
  const raw = benchmarkRawPct(b);
  return b.direction === "higher-better" ? raw : -raw;
}

export async function GET() {
  try {
    const [metrics, benchmarks] = await Promise.all([getExecutiveMetrics(), getBenchmarkResults()]);

    const scoredBenchmarks = benchmarks
      .filter((b) => b.platformValue !== null)
      .map((b) => ({ b, gapPct: benchmarkGapPct(b) }))
      .sort((a, b) => a.gapPct - b.gapPct);

    const worstBenchmark = scoredBenchmarks[0] ?? null;
    const bestBenchmark = scoredBenchmarks[scoredBenchmarks.length - 1] ?? null;
    const topRuleFinding = metrics.actionItems[0] ?? null;

    // --- Executive Summary: 2-3 sentences, revenue position + single biggest issue ---
    const revenueVariancePct = metrics.totalForecast ? ((metrics.totalActual - metrics.totalForecast) / metrics.totalForecast) * 100 : 0;
    const executiveSummary = [
      `${monthLabel(metrics.latestMonth)} revenue was €${metrics.totalActual.toLocaleString()}, ${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}% vs. forecast${metrics.revenueMoMChangePct !== null ? ` and ${metrics.revenueMoMChangePct >= 0 ? "+" : ""}${metrics.revenueMoMChangePct.toFixed(1)}% month-over-month` : ""}.`,
      topRuleFinding
        ? `The most pressing operational issue is that ${topRuleFinding.title.charAt(0).toLowerCase() + topRuleFinding.title.slice(1)}.`
        : `No rule-based conditions are currently above threshold across cost centers, campaigns, stores, churn, or CAC:CLV.`,
      worstBenchmark
        ? `Against real luxury-industry benchmarks, the widest gap is in ${worstBenchmark.b.label} — ${formatBenchmarkValue(worstBenchmark.b.platformValue!, worstBenchmark.b.unit)} vs. an industry average of ${formatBenchmarkValue(worstBenchmark.b.industryAverage, worstBenchmark.b.unit)}.`
        : "",
    ].filter(Boolean).join(" ");

    // --- Key Findings: 3 bullets with real numbers ---
    const keyFindings: string[] = [];
    keyFindings.push(
      `Revenue: €${metrics.totalActual.toLocaleString()} actual vs. €${metrics.totalForecast.toLocaleString()} forecast (${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}%)${metrics.worstChannel ? `, driven down by ${capitalize(metrics.worstChannel.channel)} at ${metrics.worstChannel.variancePct >= 0 ? "+" : ""}${metrics.worstChannel.variancePct.toFixed(1)}% vs. forecast` : ""}.`
    );
    if (topRuleFinding) keyFindings.push(`${topRuleFinding.title}: ${topRuleFinding.detail}`);
    if (worstBenchmark) {
      const rawPct = benchmarkRawPct(worstBenchmark.b);
      keyFindings.push(
        `${worstBenchmark.b.label} is ${formatBenchmarkValue(worstBenchmark.b.platformValue!, worstBenchmark.b.unit)}, ${Math.abs(rawPct).toFixed(1)}% ${rawPct >= 0 ? "above" : "below"} the industry average of ${formatBenchmarkValue(worstBenchmark.b.industryAverage, worstBenchmark.b.unit)} — the platform's least favorable benchmark this period (${worstBenchmark.b.source}).`
      );
    }

    // --- Strategic Implications: 3 bullets, real-number-grounded interpretation ---
    const strategicImplications: string[] = [];
    strategicImplications.push(
      metrics.overallChurnRatePct > 30
        ? `With ${metrics.overallChurnRatePct.toFixed(1)}% of customers inactive for 90+ days, recurring revenue is concentrated in an increasingly narrow, at-risk customer base — new-customer acquisition alone cannot offset this without a retention fix.`
        : `Customer retention (${metrics.overallChurnRatePct.toFixed(1)}% churned) is within a manageable range, so growth can lean on both acquisition and retention levers.`
    );
    strategicImplications.push(
      worstBenchmark
        ? `The ${Math.abs(worstBenchmark.gapPct).toFixed(1)}% gap to the industry average in ${worstBenchmark.b.label} is the platform's clearest lever for closing the distance to luxury-sector peers — see the Benchmark Intelligence page for the full comparison and sourcing.`
        : `No benchmark data is currently below threshold.`
    );
    strategicImplications.push(
      bestBenchmark && bestBenchmark.gapPct > 0
        ? `${bestBenchmark.b.label} is a genuine relative strength (${Math.abs(bestBenchmark.gapPct).toFixed(1)}% better than the industry average) — worth protecting and citing as evidence the underlying model works, even while other metrics lag.`
        : `No benchmark is currently outperforming its industry average — closing gaps should take priority over defending strengths this period.`
    );

    // --- Recommended Actions: 3 prioritized, expected impact framed against the real gap being closed ---
    const recommendedActions: { priority: number; action: string; expectedImpact: string }[] = [];
    if (topRuleFinding) {
      recommendedActions.push({
        priority: 1,
        action: `Address: ${topRuleFinding.title}.`,
        expectedImpact: `Directly closes the platform's single most severe rule-based finding this month (severity score ${topRuleFinding.severity.toFixed(1)}).`,
      });
    }
    if (worstBenchmark) {
      recommendedActions.push({
        priority: recommendedActions.length + 1,
        action: `Build a plan to close the ${worstBenchmark.b.label} gap toward the ${formatBenchmarkValue(worstBenchmark.b.industryAverage, worstBenchmark.b.unit)} industry average.`,
        expectedImpact: `Moves ${worstBenchmark.b.label} from ${formatBenchmarkValue(worstBenchmark.b.platformValue!, worstBenchmark.b.unit)} toward parity with luxury-sector peers — the platform's largest single benchmark gap.`,
      });
    }
    recommendedActions.push({
      priority: recommendedActions.length + 1,
      action:
        metrics.overallChurnRatePct > 30
          ? "Launch a targeted re-engagement campaign for customers approaching the 90-day inactivity threshold."
          : "Maintain current retention programs while investing incremental budget in acquisition.",
      expectedImpact:
        metrics.overallChurnRatePct > 30
          ? `Brings the ${metrics.overallChurnRatePct.toFixed(1)}% churn rate down toward the platform's own 30% alert threshold, protecting recurring revenue.`
          : "Preserves the current healthy retention base while acquisition spend scales.",
    });

    return NextResponse.json({
      month: metrics.latestMonth,
      monthLabel: monthLabel(metrics.latestMonth),
      executiveSummary,
      keyFindings,
      strategicImplications,
      recommendedActions,
      revenueActual: metrics.totalActual,
      revenueVariancePct,
      overallChurnRatePct: metrics.overallChurnRatePct,
      worstBenchmark: worstBenchmark
        ? { label: worstBenchmark.b.label, gapPct: worstBenchmark.gapPct }
        : null,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
