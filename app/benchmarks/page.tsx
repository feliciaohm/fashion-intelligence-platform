import PrintButton from "@/components/PrintButton";
import { selfFetch } from "@/lib/self-fetch";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { buildInsightText } from "@/lib/insight-text";
import type { BenchmarkResult } from "@/lib/benchmarks";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function gapPct(b: BenchmarkResult): number {
  if (b.platformValue === null || !b.industryAverage) return 0;
  const raw = ((b.platformValue - b.industryAverage) / b.industryAverage) * 100;
  return b.direction === "higher-better" ? raw : -raw;
}

async function getData(): Promise<{ benchmarks: BenchmarkResult[] }> {
  const res = await selfFetch("/api/benchmarks", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch benchmarks");
  return res.json();
}

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === ":1") return `${value.toFixed(2)}:1`;
  return `${value.toFixed(2)}x`;
}

function isFavorable(b: BenchmarkResult): boolean | null {
  if (b.platformValue === null) return null;
  const favorable = b.direction === "higher-better" ? b.platformValue >= b.industryAverage : b.platformValue <= b.industryAverage;
  return favorable;
}

function driverAndAction(b: BenchmarkResult, favorable: boolean | null): { driver: string; action: string } {
  const map: Record<string, { favDriver: string; favAction: string; unfavDriver: string; unfavAction: string }> = {
    influencer_roi: {
      favDriver: "well-targeted campaigns converting gifted product into attributed revenue",
      favAction: "Scale budget toward the influencer segments already outperforming this benchmark",
      unfavDriver: "gifted product cost outpacing campaign-attributed revenue",
      unfavAction: "Tighten influencer selection to comparables with proven attributed revenue before scaling gifting budget",
    },
    gross_margin: {
      favDriver: "a favorable cost-of-goods-sold to revenue ratio across channels",
      favAction: "Maintain current cost discipline and use the margin cushion to fund selective price or channel investment",
      unfavDriver: "cost of goods sold running high relative to revenue across channels",
      unfavAction: "Review COGS by channel and product category to close the gap to the luxury-sector average",
    },
    customer_retention: {
      favDriver: "a healthy share of customers returning to purchase within 90 days",
      favAction: "Continue current retention programs and monitor for early signs of drop-off",
      unfavDriver: "the majority of customers not returning to purchase again within 90 days",
      unfavAction: "Launch a re-engagement program targeting customers approaching the 90-day inactivity threshold",
    },
    cac_clv_ratio: {
      favDriver: "influencer-channel customers generating lifetime value well above acquisition cost",
      favAction: "Increase influencer acquisition spend while the channel remains at or above the healthy 3:1 threshold",
      unfavDriver: "acquisition cost running high relative to influencer-channel customer lifetime value",
      unfavAction: "Reduce CAC or focus spend on higher-LTV customer segments before scaling further",
    },
    return_rate: {
      favDriver: "sizing, fit, and quality control keeping returns low relative to the fashion-ecommerce norm",
      favAction: "Maintain current sizing, fit, and quality-control practices — no corrective action needed",
      unfavDriver: "returns running high relative to the fashion-ecommerce norm",
      unfavAction: "Audit the most-returned products for sizing or quality issues driving the gap",
    },
  };
  const m = map[b.id];
  if (!m) return { driver: "real underlying transaction data", action: "Review the methodology for this metric" };
  return favorable
    ? { driver: m.favDriver, action: m.favAction }
    : { driver: m.unfavDriver, action: m.unfavAction };
}

function BenchmarkBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const widthPct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 110, fontSize: 11.5, color: "var(--color-ink-muted, #6b6558)", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: "var(--color-bg-subtle, #f7f5f1)", borderRadius: 3, height: 16, position: "relative" }}>
        <div style={{ width: `${widthPct}%`, background: color, height: "100%", borderRadius: 3 }} />
      </div>
      <div style={{ width: 64, fontSize: 12, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default async function BenchmarksPage() {
  const { benchmarks } = await getData();

  const scored = benchmarks
    .filter((b) => b.platformValue !== null)
    .map((b) => ({ b, gap: gapPct(b) }))
    .sort((a, b) => a.gap - b.gap);
  const worst = scored[0];
  const best = scored[scored.length - 1];

  const topThreeIds = ["influencer_roi", "gross_margin", "cac_clv_ratio"];
  const kpis: KpiItem[] = topThreeIds
    .map((id) => benchmarks.find((b) => b.id === id))
    .filter((b): b is BenchmarkResult => Boolean(b) && b!.platformValue !== null)
    .map((b) => {
      const fav = isFavorable(b);
      return {
        label: b.label,
        value: formatValue(b.platformValue!, b.unit),
        delta: `vs. ${formatValue(b.industryAverage, b.unit)} industry avg.`,
        direction: fav === null ? "neutral" : fav ? "good" : "critical",
      } as KpiItem;
    });

  const headline = worst
    ? `${worst.b.label} is the widest gap to the industry average — ${formatValue(worst.b.platformValue!, worst.b.unit)} vs. ${formatValue(worst.b.industryAverage, worst.b.unit)}.`
    : "No benchmark data available.";
  const insightBoxText = best && best.b.id !== worst?.b.id
    ? `${best.b.label} is Maison Lumière's clearest relative strength at ${formatValue(best.b.platformValue!, best.b.unit)}, ${Math.abs(best.gap).toFixed(1)}% better than the industry average — worth protecting and citing as proof the model works.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Benchmark Comparison</div>
      <div className="page-meta no-print">
        <span>Benchmark Intelligence</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Benchmark Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      {benchmarks.map((b) => {
        const favorable = isFavorable(b);
        const comparisonPct = b.platformValue !== null && b.industryAverage ? ((b.platformValue - b.industryAverage) / b.industryAverage) * 100 : 0;
        const direction: "above" | "below" = comparisonPct >= 0 ? "above" : "below";
        const { driver, action } = driverAndAction(b, favorable);
        const insightText =
          b.platformValue !== null
            ? buildInsightText({
                metric: b.label,
                value: formatValue(b.platformValue, b.unit),
                comparisonPct,
                direction,
                comparisonLabel: `the industry average of ${formatValue(b.industryAverage, b.unit)}`,
                driver,
                action,
              })
            : "";
        const max = Math.max(b.platformValue ?? 0, b.industryAverage, b.bestInClass ?? 0) * 1.15;

        return (
          <div key={b.id} className="section panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div>
                <h2 className="section-title" style={{ marginBottom: 2 }}>{b.label}</h2>
                <div className={`stat-value ${favorable === null ? "" : favorable ? "good" : "critical"}`} style={{ fontSize: 26 }}>
                  {b.platformValue !== null ? formatValue(b.platformValue, b.unit) : "n/a"}
                </div>
              </div>
              {b.platformValue !== null && <CopyInsightButton text={insightText} />}
            </div>

            <div style={{ marginBottom: 14 }}>
              {b.platformValue !== null && <BenchmarkBar label="Maison Lumière" value={b.platformValue} max={max} color={favorable ? "var(--status-good)" : "var(--status-critical)"} />}
              <BenchmarkBar label="Industry Average" value={b.industryAverage} max={max} color="var(--color-ink-muted, #9c9585)" />
              {b.bestInClass !== null && <BenchmarkBar label="Best-in-Class" value={b.bestInClass} max={max} color="var(--color-accent, #1a1a1a)" />}
            </div>

            <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 6 }}>{b.platformNote}</p>
            <p className="text-muted" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>{b.note}</p>
            <p className="text-muted" style={{ fontSize: 11.5, fontStyle: "italic" }}>
              Source: <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">{b.source}</a>
            </p>
          </div>
        );
      })}

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consulting-summary", "/executive", "/decision-intelligence"]} />
    </div>
  );
}
