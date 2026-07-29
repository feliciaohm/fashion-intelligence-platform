// Server-only: the "first hour of any engagement" diagnostic strip -- six
// numbers, each with a status derived from a real, already-established
// benchmark where one exists (gross margin and CLV:CAC ratio reuse the same
// sourced thresholds as Benchmark Intelligence; revenue reuses the platform's
// own forecast). Where no defensible external or internal threshold exists
// (Customer Count, CAC in isolation), status is left neutral rather than
// inventing a fake threshold that would look precise but isn't grounded.
import { getExecutiveMetrics } from "@/lib/insights-server";
import { getRawPlatformMetrics } from "@/lib/benchmarks-server";
import { BENCHMARKS } from "@/lib/benchmarks";

export type MetricStatus = "good" | "warn" | "critical" | "neutral";

export interface QuickMetric {
  id: string;
  label: string;
  value: string;
  status: MetricStatus;
  benchmarkNote: string;
}

export interface QuickMetrics {
  metrics: QuickMetric[];
  methodology: string[];
}

export async function getQuickMetrics(): Promise<QuickMetrics> {
  const [exec, raw] = await Promise.all([getExecutiveMetrics(), getRawPlatformMetrics()]);

  const grossMarginBenchmark = BENCHMARKS.find((b) => b.id === "gross_margin")!;
  const cacClvBenchmark = BENCHMARKS.find((b) => b.id === "cac_clv_ratio")!;

  // 1. Total Revenue -- vs. this month's real forecast
  const revenueVariancePct = exec.totalForecast ? ((exec.totalActual - exec.totalForecast) / exec.totalForecast) * 100 : 0;
  const revenueStatus: MetricStatus = revenueVariancePct >= 0 ? "good" : revenueVariancePct >= -10 ? "warn" : "critical";

  // 2. Revenue Growth Rate (MoM)
  const momPct = exec.revenueMoMChangePct;
  const momStatus: MetricStatus = momPct === null ? "neutral" : momPct >= 5 ? "good" : momPct >= 0 ? "warn" : "critical";

  // 3. Gross Margin % -- vs. the real sourced luxury-industry benchmark
  const marginStatus: MetricStatus =
    raw.grossMarginPct === null
      ? "neutral"
      : raw.grossMarginPct >= grossMarginBenchmark.bestInClass!
      ? "good"
      : raw.grossMarginPct >= grossMarginBenchmark.industryAverage
      ? "warn"
      : "critical";

  // 4. Customer Count -- no external or internal benchmark for "the right count," shown for scale only
  // 5. CAC (influencer channel) -- no standalone benchmark; judged via the CLV:CAC ratio instead, not in isolation

  // 6. CLV:CAC Ratio -- vs. the real sourced growth-marketing threshold
  const ratioStatus: MetricStatus =
    raw.cacClvRatio === null
      ? "neutral"
      : raw.cacClvRatio >= cacClvBenchmark.bestInClass!
      ? "good"
      : raw.cacClvRatio >= cacClvBenchmark.industryAverage
      ? "warn"
      : "critical";

  const metrics: QuickMetric[] = [
    {
      id: "revenue",
      label: "Total Revenue",
      value: `€${exec.totalActual.toLocaleString()}`,
      status: revenueStatus,
      benchmarkNote: `${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}% vs. this month's real forecast`,
    },
    {
      id: "revenue_growth",
      label: "Revenue Growth (MoM)",
      value: momPct !== null ? `${momPct >= 0 ? "+" : ""}${momPct.toFixed(1)}%` : "n/a",
      status: momStatus,
      benchmarkNote: momPct !== null ? "vs. last month, real" : "no prior month to compare",
    },
    {
      id: "gross_margin",
      label: "Gross Margin",
      value: raw.grossMarginPct !== null ? `${raw.grossMarginPct.toFixed(1)}%` : "n/a",
      status: marginStatus,
      benchmarkNote: `vs. ${grossMarginBenchmark.industryAverage}% industry avg. / ${grossMarginBenchmark.bestInClass}% best-in-class`,
    },
    {
      id: "customer_count",
      label: "Customer Count",
      value: raw.totalCustomerCount.toLocaleString(),
      status: "neutral",
      benchmarkNote: "no external benchmark for scale — shown for context",
    },
    {
      id: "cac",
      label: "CAC (influencer channel)",
      value: raw.influencerCac !== null ? `€${Math.round(raw.influencerCac).toLocaleString()}` : "n/a",
      status: "neutral",
      benchmarkNote: "judged via the CLV:CAC ratio, not in isolation",
    },
    {
      id: "clv_cac_ratio",
      label: "CLV:CAC Ratio",
      value: raw.cacClvRatio !== null ? `${raw.cacClvRatio.toFixed(2)}:1` : "n/a",
      status: ratioStatus,
      benchmarkNote: `vs. ${cacClvBenchmark.industryAverage}:1 minimum / ${cacClvBenchmark.bestInClass}:1 excellent`,
    },
  ];

  const methodology = [
    `The six numbers a consultant would compute in the first hour of any engagement, refreshed live from real data every time this page loads.`,
    `Status colors are only applied where a real, defensible threshold exists: Revenue vs. this month's own real forecast; Revenue Growth vs. a flat 0%/5% split (a documented assumption, not a sourced benchmark); Gross Margin and CLV:CAC Ratio vs. the same real, sourced luxury-industry figures shown in full on the Benchmark Intelligence page.`,
    `Customer Count and CAC are shown neutrally (no color) rather than forced against an invented threshold — there's no defensible external benchmark for "the right" customer count in isolation, and CAC is only meaningful judged against CLV, which the ratio metric already covers.`,
  ];

  return { metrics, methodology };
}
