import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import PrintButton from "@/components/PrintButton";
import BoardReportGenerator from "@/components/BoardReportGenerator";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { buildInsightText } from "@/lib/insight-text";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await selfFetch("/api/variance-report", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch variance report");
  return res.json();
}

export default async function VarianceReportPage() {
  const { latestPeriod, latestPeriodLabel, narrative, costCenters, channels } = await getData();

  const latestCostCenters = costCenters.filter((r: any) => r.period === latestPeriod);
  const worstCostCenter = [...latestCostCenters].sort((a: any, b: any) => b.variance_pct - a.variance_pct)[0];
  const varianceInsightText = worstCostCenter
    ? buildInsightText({
        metric: `${worstCostCenter.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")} spend`,
        value: `€${worstCostCenter.actual.toLocaleString()}`,
        comparisonPct: worstCostCenter.variance_pct,
        direction: worstCostCenter.variance_pct >= 0 ? "above" : "below",
        comparisonLabel: `budget (€${worstCostCenter.budget.toLocaleString()})`,
        driver: "the largest cost-center variance this period",
        action: worstCostCenter.variance_pct > 0 ? "Review this department's spend against plan before next month's budget is set" : "No corrective action needed — this department is under budget",
      })
    : "";

  const totalBudget = latestCostCenters.reduce((s: number, r: any) => s + r.budget, 0);
  const totalActual = latestCostCenters.reduce((s: number, r: any) => s + r.actual, 0);
  const totalVariancePct = totalBudget ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Budget",
      value: `€${totalBudget.toLocaleString()}`,
      delta: latestPeriodLabel,
      direction: "neutral",
    },
    {
      label: "Total Actual Spend",
      value: `€${totalActual.toLocaleString()}`,
      delta: `${totalVariancePct >= 0 ? "+" : ""}${totalVariancePct.toFixed(1)}% vs. budget`,
      direction: totalVariancePct <= 0 ? "good" : "critical",
    },
    {
      label: worstCostCenter ? `${worstCostCenter.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")} Variance` : "Worst Variance",
      value: worstCostCenter ? `${worstCostCenter.variance_pct >= 0 ? "+" : ""}${worstCostCenter.variance_pct.toFixed(1)}%` : "n/a",
      delta: worstCostCenter ? `${worstCostCenter.variance >= 0 ? "+" : ""}€${worstCostCenter.variance.toLocaleString()} vs. budget` : "no data",
      direction: !worstCostCenter ? "neutral" : worstCostCenter.variance_pct <= 0 ? "good" : "critical",
    },
  ];

  const headline: string = narrative[0] ?? "No variance data available for this period.";
  const insightBoxText: string = narrative[1] ?? varianceInsightText ?? headline;

  return (
    <div>
      <div className="page-eyebrow">Finance · Variance Analysis</div>
      <div className="page-meta no-print">
        <span>Monthly Variance Report</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Monthly Variance Report</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>{latestPeriodLabel} — Summary</h2>
          {worstCostCenter && <CopyInsightButton text={varianceInsightText} />}
        </div>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {narrative.map((line: string, i: number) => (
            <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-ink)" }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      <BoardReportGenerator latestPeriod={latestPeriod} costCenters={costCenters} channels={channels} narrative={narrative} />

      <div className="section">
        <h2 className="section-title">Cost Centers — Budget vs. Actual</h2>
        <p className="section-subtitle">Every department, every month, Feb–Nov 2026</p>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={costCenters} filename="variance-report-cost-centers.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Period</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Variance</th>
              <th>Variance %</th>
            </tr>
          </thead>
          <tbody>
            {costCenters.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.name.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")}</td>
                <td>{r.period}</td>
                <td>€{r.budget.toLocaleString()}</td>
                <td>€{r.actual.toLocaleString()}</td>
                <td style={{ color: r.variance <= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {r.variance >= 0 ? "+" : ""}€{r.variance.toLocaleString()}
                </td>
                <td style={{ color: r.variance <= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {r.variance_pct >= 0 ? "+" : ""}{r.variance_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Channels — Actual vs. Forecast</h2>
        <p className="section-subtitle">Every channel, every month, Feb–Nov 2026</p>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={channels} filename="variance-report-channels.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Month</th>
              <th>Revenue (Actual)</th>
              <th>Revenue (Forecast)</th>
              <th>Variance</th>
              <th>Variance %</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((r: any, i: number) => (
              <tr key={i}>
                <td style={{ textTransform: "capitalize" }}>{r.channel}</td>
                <td>{r.month}</td>
                <td>€{r.revenue_actual.toLocaleString()}</td>
                <td>€{r.revenue_forecast.toLocaleString()}</td>
                <td style={{ color: r.variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {r.variance >= 0 ? "+" : ""}€{r.variance.toLocaleString()}
                </td>
                <td style={{ color: r.variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {r.variance_pct >= 0 ? "+" : ""}{r.variance_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/consolidated-pnl", "/cost-centers", "/executive"]} />
    </div>
  );
}
