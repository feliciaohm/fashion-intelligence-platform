import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import PrintButton from "@/components/PrintButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import { BENCHMARKS } from "@/lib/benchmarks";
import DataQualityIndicator from "@/components/DataQualityIndicator";

async function getData() {
  const res = await selfFetch("/api/finance-deep", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch finance deep-dive");
  return res.json();
}

function WaterfallBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const pct = Math.max(2, (Math.abs(value) / max) * 100);
  const color =
    tone === "positive" ? "var(--status-good)" : tone === "negative" ? "var(--status-critical)" : "var(--color-accent)";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span className="text-muted">{label}</span>
        <span className="mono" style={{ color }}>
          {value < 0 ? "-" : ""}€{Math.abs(value).toLocaleString()}
        </span>
      </div>
      <div style={{ background: "var(--color-bg-sunken)", height: 8, border: "1px solid var(--color-border)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export default async function FinanceDeepPage() {
  const { channels, waterfall } = await getData();

  const byChannel: Record<string, { revenue: number; forecast: number; cogs: number }> = {};
  channels.forEach((r: any) => {
    if (!byChannel[r.channel]) byChannel[r.channel] = { revenue: 0, forecast: 0, cogs: 0 };
    byChannel[r.channel].revenue += r.revenue_actual;
    byChannel[r.channel].forecast += r.revenue_forecast;
    byChannel[r.channel].cogs += r.cogs;
  });

  const maxWaterfall = waterfall.revenue;

  const byChannelRows = Object.entries(byChannel).map(([channel, v]) => ({
    channel,
    revenue_actual: v.revenue,
    revenue_forecast: v.forecast,
    variance: v.revenue - v.forecast,
    cogs: v.cogs,
    gross_margin: v.revenue - v.cogs,
  }));

  const totalForecast = channels.reduce((s: number, r: any) => s + r.revenue_forecast, 0);
  const revenueVariancePct = totalForecast ? ((waterfall.revenue - totalForecast) / totalForecast) * 100 : 0;
  const grossMarginPct = waterfall.revenue > 0 ? ((waterfall.revenue - waterfall.cogs) / waterfall.revenue) * 100 : 0;
  const marginBenchmark = BENCHMARKS.find((b) => b.id === "gross_margin")!;

  const kpis: KpiItem[] = [
    {
      label: "Total Revenue",
      value: `€${waterfall.revenue.toLocaleString()}`,
      delta: `${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}% vs. €${totalForecast.toLocaleString()} forecast`,
      direction: revenueVariancePct >= 0 ? "good" : "critical",
    },
    {
      label: "Gross Margin",
      value: `${grossMarginPct.toFixed(1)}%`,
      delta: `vs. ${marginBenchmark.industryAverage}% industry avg. / ${marginBenchmark.bestInClass}% best-in-class`,
      direction: grossMarginPct >= marginBenchmark.bestInClass! ? "good" : grossMarginPct >= marginBenchmark.industryAverage ? "neutral" : "critical",
    },
    {
      label: "True Net Margin",
      value: `€${waterfall.net_margin.toLocaleString()}`,
      delta: `${waterfall.net_margin >= 0 ? "above" : "below"} breakeven, after returns + gifting`,
      direction: waterfall.net_margin >= 0 ? "good" : "critical",
    },
  ];

  const worstChannelByVariance = [...byChannelRows].sort((a, b) => a.variance - b.variance)[0];
  const headline = `True net margin is €${waterfall.net_margin.toLocaleString()} after €${waterfall.cogs.toLocaleString()} COGS, €${waterfall.returns.toLocaleString()} in returns, and €${waterfall.gifting.toLocaleString()} in gifting cost — revenue ran ${revenueVariancePct >= 0 ? "+" : ""}${revenueVariancePct.toFixed(1)}% vs. forecast.`;
  const insightBoxText = worstChannelByVariance
    ? `${worstChannelByVariance.channel.charAt(0).toUpperCase() + worstChannelByVariance.channel.slice(1)} is the weakest channel vs. forecast, at ${worstChannelByVariance.variance >= 0 ? "+" : ""}€${worstChannelByVariance.variance.toLocaleString()} — worth a closer look before next quarter's plan.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Finance · Channel P&amp;L</div>
      <div className="page-meta no-print">
        <span>Finance Deep-Dive</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Finance Deep-Dive</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">Margin Waterfall</h2>
        <p className="section-subtitle">
          Revenue → minus COGS → minus returns → minus gifting cost → true net margin
        </p>
      </div>

      <div className="chart-panel">
        <WaterfallBar label="Revenue" value={waterfall.revenue} max={maxWaterfall} tone="neutral" />
        <WaterfallBar label="− COGS" value={-waterfall.cogs} max={maxWaterfall} tone="negative" />
        <WaterfallBar label="− Returns" value={-waterfall.returns} max={maxWaterfall} tone="negative" />
        <WaterfallBar label="− Gifting Cost" value={-waterfall.gifting} max={maxWaterfall} tone="negative" />
        <div style={{ borderTop: "1px solid var(--color-border-strong)", marginTop: 18, paddingTop: 14 }}>
          <WaterfallBar
            label="= True Net Margin"
            value={waterfall.net_margin}
            max={maxWaterfall}
            tone={waterfall.net_margin >= 0 ? "positive" : "negative"}
          />
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">P&amp;L by Channel</h2>
        <p className="section-subtitle">Full year 2026, actual vs. forecast</p>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={byChannelRows} filename="finance-deep-by-channel.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Revenue (Actual)</th>
              <th>Revenue (Forecast)</th>
              <th>Variance</th>
              <th>COGS</th>
              <th>Gross Margin</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byChannel).map(([channel, v]) => {
              const variance = v.revenue - v.forecast;
              const grossMargin = v.revenue - v.cogs;
              return (
                <tr key={channel}>
                  <td style={{ textTransform: "capitalize" }}>{channel}</td>
                  <td>€{v.revenue.toLocaleString()}</td>
                  <td>€{v.forecast.toLocaleString()}</td>
                  <td style={{ color: variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    {variance >= 0 ? "+" : ""}
                    €{variance.toLocaleString()}
                  </td>
                  <td>€{v.cogs.toLocaleString()}</td>
                  <td>€{grossMargin.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Quarterly Detail</h2>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={channels} filename="finance-deep-quarterly.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Channel</th>
              <th>Revenue (Actual)</th>
              <th>Revenue (Forecast)</th>
              <th>Variance</th>
              <th>COGS</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((r: any, i: number) => {
              const variance = r.revenue_actual - r.revenue_forecast;
              return (
                <tr key={i}>
                  <td>{r.quarter}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.channel}</td>
                  <td>€{r.revenue_actual.toLocaleString()}</td>
                  <td>€{r.revenue_forecast.toLocaleString()}</td>
                  <td style={{ color: variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    {variance >= 0 ? "+" : ""}
                    €{variance.toLocaleString()}
                  </td>
                  <td>€{r.cogs.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DataQualityIndicator dataPoints={channels.length} />
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consolidated-pnl", "/variance-report", "/forecast"]} />
    </div>
  );
}
