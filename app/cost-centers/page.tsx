import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function formatName(name: string) {
  return name
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

async function getData() {
  const res = await fetch("http://localhost:3000/api/cost-centers", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch cost centers");
  return res.json();
}

export default async function CostCentersPage() {
  const data = await getData();

  const totalBudget = data.reduce((s: number, r: any) => s + r.budget, 0);
  const totalActual = data.reduce((s: number, r: any) => s + r.actual, 0);
  const totalVariance = totalActual - totalBudget;
  const totalVariancePct = totalBudget ? (totalVariance / totalBudget) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Budget",
      value: `€${totalBudget.toLocaleString()}`,
      delta: "across every department and month",
      direction: "neutral",
    },
    {
      label: "Total Actual",
      value: `€${totalActual.toLocaleString()}`,
      delta: `${totalVariancePct >= 0 ? "+" : ""}${totalVariancePct.toFixed(1)}% vs. budget`,
      direction: totalVariance <= 0 ? "good" : "critical",
    },
    {
      label: "Total Variance",
      value: `${totalVariance >= 0 ? "+" : ""}€${totalVariance.toLocaleString()}`,
      delta: totalVariance <= 0 ? "under budget" : "over budget",
      direction: totalVariance <= 0 ? "good" : "critical",
    },
  ];

  const latestPeriod = data.reduce((max: string, r: any) => (r.period > max ? r.period : max), data[0]?.period ?? "");
  const latestRows = data.filter((r: any) => r.period === latestPeriod);
  const worstDept = [...latestRows].sort((a: any, b: any) => (b.actual - b.budget) - (a.actual - a.budget))[0];

  const headline = worstDept
    ? `${formatName(worstDept.name)} is the largest variance department in ${latestPeriod} — ${worstDept.variance >= 0 ? "+" : ""}€${worstDept.variance.toLocaleString()} vs. budget.`
    : "No cost center data available.";
  const insightBoxText = worstDept
    ? `${formatName(worstDept.name)} ran ${worstDept.budget ? (((worstDept.actual - worstDept.budget) / worstDept.budget) * 100).toFixed(1) : "0"}% ${worstDept.variance >= 0 ? "over" : "under"} its ${latestPeriod} budget — worth a closer look before next month's plan.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Finance · Cost Centers</div>
      <h1 className="page-title">Cost Centers</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="cost-centers.csv" />
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
            </tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i}>
                <td>{formatName(r.name)}</td>
                <td>{r.period}</td>
                <td>€{r.budget.toLocaleString()}</td>
                <td>€{r.actual.toLocaleString()}</td>
                <td style={{ color: r.variance <= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {r.variance >= 0 ? "+" : ""}€{r.variance.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/variance-report", "/cost-allocation", "/finance-deep"]} />
    </div>
  );
}
