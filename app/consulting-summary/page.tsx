import PrintButton from "@/components/PrintButton";
import ConsultingSummaryCopyButton from "@/components/ConsultingSummaryCopyButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await fetch("http://localhost:3000/api/consulting-summary", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch consulting summary");
  return res.json();
}

export default async function ConsultingSummaryPage() {
  const data = await getData();

  const headline: string = data.executiveSummary.split(". ")[0] + ".";

  const kpis: KpiItem[] = [
    {
      label: "Revenue This Month",
      value: `€${data.revenueActual.toLocaleString()}`,
      delta: `${data.revenueVariancePct >= 0 ? "+" : ""}${data.revenueVariancePct.toFixed(1)}% vs. forecast`,
      direction: data.revenueVariancePct >= 0 ? "good" : "critical",
    },
    {
      label: "Churn Rate",
      value: `${data.overallChurnRatePct.toFixed(1)}%`,
      delta: `vs. 30% internal alert threshold`,
      direction: data.overallChurnRatePct <= 30 ? "good" : "critical",
    },
    {
      label: data.worstBenchmark ? `${data.worstBenchmark.label} Gap` : "Benchmark Gap",
      value: data.worstBenchmark ? `${Math.abs(data.worstBenchmark.gapPct).toFixed(1)}%` : "n/a",
      delta: data.worstBenchmark ? `${data.worstBenchmark.gapPct >= 0 ? "better" : "worse"} than industry average` : "no benchmark data",
      direction: !data.worstBenchmark ? "neutral" : data.worstBenchmark.gapPct >= 0 ? "good" : "critical",
    },
  ];

  const insightBoxText: string = data.priorityFindings[0]
    ? `${data.priorityFindings[0].finding} ${data.priorityFindings[0].magnitude}`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Consulting Summary</div>
      <div className="page-meta no-print">
        <span>Consulting Summary — {data.monthLabel}</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Consulting Summary</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <ConsultingSummaryCopyButton data={data} />

      <div className="section panel">
        <h2 className="section-title" style={{ marginBottom: 10 }}>Executive Summary</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--color-ink)" }}>{data.executiveSummary}</p>
      </div>

      <div className="section panel">
        <h2 className="section-title" style={{ marginBottom: 10 }}>Key Findings</h2>
        <ol style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 20 }}>
          {data.keyFindings.map((f: string, i: number) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-ink)" }}>{f}</li>
          ))}
        </ol>
      </div>

      <div className="section panel">
        <h2 className="section-title" style={{ marginBottom: 10 }}>Strategic Implications</h2>
        <ol style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 20 }}>
          {data.strategicImplications.map((s: string, i: number) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-ink)" }}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="section panel">
        <h2 className="section-title" style={{ marginBottom: 10 }}>Priority Findings</h2>
        <ol style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 20 }}>
          {data.priorityFindings.map((f: any) => (
            <li key={f.priority}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-ink)" }}>
                Priority {f.priority}: {f.finding}
              </div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                {f.magnitude}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/benchmarks", "/executive", "/variance-report"]} />
    </div>
  );
}
