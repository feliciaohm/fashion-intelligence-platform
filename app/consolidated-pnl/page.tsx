import ExportCsvButton from "@/components/ExportCsvButton";
import PrintButton from "@/components/PrintButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import { formatDeptName } from "@/lib/narrative";

async function getData() {
  const res = await fetch("http://localhost:3000/api/consolidated-pnl", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch consolidated P&L");
  return res.json();
}

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString()}`;
}

function VarianceCell({ actual, base }: { actual: number; base: number }) {
  const variance = actual - base;
  const pct = base ? (variance / base) * 100 : 0;
  return (
    <td style={{ color: variance >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
      {variance >= 0 ? "+" : ""}
      {euro(variance)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
    </td>
  );
}

export default async function ConsolidatedPnlPage() {
  const data = await getData();
  const {
    latestPeriodLabel,
    priorPeriodLabel,
    revenue,
    cogs,
    grossProfit,
    opex,
    ebitda,
    da,
    netMargin,
    revenueByChannel,
    opexByDept,
    commentary,
  } = data;

  const ebitdaMarginActual = revenue.actual ? (ebitda.actual / revenue.actual) * 100 : 0;
  const ebitdaMarginPrior = revenue.prior ? (ebitda.prior / revenue.prior) * 100 : 0;
  const netMarginPct = revenue.actual ? (netMargin.actual / revenue.actual) * 100 : 0;
  const revenueVsBudgetPct = revenue.budget ? ((revenue.actual - revenue.budget) / revenue.budget) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Revenue",
      value: euro(revenue.actual),
      delta: `${revenueVsBudgetPct >= 0 ? "+" : ""}${revenueVsBudgetPct.toFixed(1)}% vs. budget`,
      direction: revenueVsBudgetPct >= 0 ? "good" : "critical",
    },
    {
      label: "EBITDA",
      value: euro(ebitda.actual),
      delta: `${ebitdaMarginActual.toFixed(1)}% margin, vs. ${ebitdaMarginPrior.toFixed(1)}% last period`,
      direction: ebitdaMarginActual >= ebitdaMarginPrior ? "good" : "critical",
    },
    {
      label: "Net Margin",
      value: euro(netMargin.actual),
      delta: `${netMarginPct.toFixed(1)}% of revenue, after assumed ${(da.assumedRate * 100).toFixed(0)}% D&A`,
      direction: netMargin.actual >= 0 ? "good" : "critical",
    },
  ];

  const headline = `${latestPeriodLabel} revenue was ${euro(revenue.actual)} (${revenueVsBudgetPct >= 0 ? "+" : ""}${revenueVsBudgetPct.toFixed(1)}% vs. budget), landing at ${euro(ebitda.actual)} EBITDA and ${euro(netMargin.actual)} net margin.`;
  const insightBoxText = commentary[commentary.length - 1] ?? headline;

  const plRows = [
    { label: "Revenue", actual: revenue.actual, budget: revenue.budget, prior: revenue.prior },
    { label: "− COGS", actual: -cogs.actual, budget: -cogs.budget, prior: -cogs.prior },
    { label: "= Gross Profit", actual: grossProfit.actual, budget: grossProfit.budget, prior: grossProfit.prior, strong: true },
    { label: "− Operating Expenses", actual: -opex.actual, budget: -opex.budget, prior: -opex.prior },
    { label: "= EBITDA", actual: ebitda.actual, budget: ebitda.budget, prior: ebitda.prior, strong: true },
    { label: "− D&A (assumed)", actual: -da.actual, budget: -da.budget, prior: -da.prior },
    { label: "= Net Margin", actual: netMargin.actual, budget: netMargin.budget, prior: netMargin.prior, strong: true },
  ];

  return (
    <div>
      <div className="page-eyebrow">Finance · Consolidated P&amp;L</div>
      <div className="page-meta no-print">
        <span>Consolidated P&amp;L</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Consolidated P&amp;L</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">P&amp;L Summary</h2>
        <p className="section-subtitle">
          {latestPeriodLabel}, actual vs. budget vs. {priorPeriodLabel ?? "prior period"} — revenue by channel → gross profit → operating expenses → EBITDA → net margin
        </p>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Actual</th>
              <th>Budget</th>
              <th>{priorPeriodLabel ?? "Prior Period"}</th>
              <th>Var. vs. Budget</th>
            </tr>
          </thead>
          <tbody>
            {plRows.map((r) => (
              <tr key={r.label} style={r.strong ? { fontWeight: 600, borderTop: "1px solid var(--color-border-strong)" } : undefined}>
                <td>{r.label}</td>
                <td>{euro(r.actual)}</td>
                <td>{euro(r.budget)}</td>
                <td>{r.prior != null ? euro(r.prior) : "—"}</td>
                <VarianceCell actual={r.actual} base={r.budget} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Revenue by Channel</h2>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={revenueByChannel} filename="consolidated-pnl-revenue-by-channel.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Actual</th>
              <th>Budget</th>
              <th>{priorPeriodLabel ?? "Prior Period"}</th>
              <th>Var. vs. Budget</th>
            </tr>
          </thead>
          <tbody>
            {revenueByChannel.map((r: any) => (
              <tr key={r.channel}>
                <td style={{ textTransform: "capitalize" }}>{r.channel}</td>
                <td>{euro(r.actual)}</td>
                <td>{euro(r.budget)}</td>
                <td>{r.prior != null ? euro(r.prior) : "—"}</td>
                <VarianceCell actual={r.actual} base={r.budget} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Operating Expenses by Cost Center</h2>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={opexByDept} filename="consolidated-pnl-opex-by-dept.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cost Center</th>
              <th>Actual</th>
              <th>Budget</th>
              <th>{priorPeriodLabel ?? "Prior Period"}</th>
              <th>Var. vs. Budget</th>
            </tr>
          </thead>
          <tbody>
            {opexByDept.map((r: any) => (
              <tr key={r.name}>
                <td>{formatDeptName(r.name)}</td>
                <td>{euro(r.actual)}</td>
                <td>{euro(r.budget)}</td>
                <td>{r.prior != null ? euro(r.prior) : "—"}</td>
                <VarianceCell actual={r.actual} base={r.budget} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Management Commentary</h2>
        <p className="section-subtitle">Auto-generated from this period's real actual/budget/prior-period figures above — not hand-written.</p>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {commentary.map((line: string, i: number) => (
            <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-ink)" }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/finance-deep", "/variance-report", "/cost-allocation"]} />
    </div>
  );
}
