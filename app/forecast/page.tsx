import ExportCsvButton from "@/components/ExportCsvButton";
import PrintButton from "@/components/PrintButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await fetch("http://localhost:3000/api/forecast", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch forecast");
  return res.json();
}

export default async function ForecastPage() {
  const { channels, totals } = await getData();

  const totalsExport = totals.map((t: any) => ({
    month: t.month,
    conservative: t.conservative,
    base: t.base,
    optimistic: t.optimistic,
  }));

  const totalBase3mo = totals.reduce((s: number, t: any) => s + t.base, 0);
  const totalConservative3mo = totals.reduce((s: number, t: any) => s + t.conservative, 0);
  const totalOptimistic3mo = totals.reduce((s: number, t: any) => s + t.optimistic, 0);
  const fastestChannel = [...channels].sort((a: any, b: any) => b.growthRatePct - a.growthRatePct)[0];
  const slowestChannel = [...channels].sort((a: any, b: any) => a.growthRatePct - b.growthRatePct)[0];

  const kpis: KpiItem[] = totals.length
    ? [
        {
          label: `${totals[0].month} Forecast (Base)`,
          value: `€${totals[0].base.toLocaleString()}`,
          delta: `€${totals[0].conservative.toLocaleString()}–€${totals[0].optimistic.toLocaleString()} range`,
          direction: "neutral",
        },
        {
          label: "3-Month Total (Base)",
          value: `€${totalBase3mo.toLocaleString()}`,
          delta: `€${totalConservative3mo.toLocaleString()}–€${totalOptimistic3mo.toLocaleString()} range`,
          direction: "neutral",
        },
        ...(fastestChannel
          ? [{
              label: "Fastest-Growing Channel",
              value: `${fastestChannel.channel.charAt(0).toUpperCase() + fastestChannel.channel.slice(1)}`,
              delta: `${fastestChannel.growthRatePct >= 0 ? "+" : ""}${fastestChannel.growthRatePct}% MoM trend`,
              direction: fastestChannel.growthRatePct >= 0 ? "good" as const : "critical" as const,
            }]
          : []),
      ]
    : [];

  const headline = fastestChannel
    ? `${fastestChannel.channel.charAt(0).toUpperCase() + fastestChannel.channel.slice(1)} is trending fastest at ${fastestChannel.growthRatePct >= 0 ? "+" : ""}${fastestChannel.growthRatePct}% month-over-month — this is trend extrapolation, not a demand model.`
    : "No forecast data available.";
  const insightBoxText = slowestChannel && slowestChannel.channel !== fastestChannel?.channel
    ? `${slowestChannel.channel.charAt(0).toUpperCase() + slowestChannel.channel.slice(1)} has the weakest trailing trend at ${slowestChannel.growthRatePct >= 0 ? "+" : ""}${slowestChannel.growthRatePct}% MoM — worth watching if it turns negative.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Revenue Forecast</div>
      <div className="page-meta no-print">
        <span>Forecast</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Forecast</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <p className="text-muted section" style={{ maxWidth: 640, marginTop: 0 }}>
        This is a simple trend extrapolation, not a demand model — it can overstate momentum
        coming out of a strong seasonal launch (like FW26&apos;s Sept–Nov wholesale ramp) or
        understate a slowdown. Treat scenarios as directional, not exact.
      </p>

      <div className="section">
        <h2 className="section-title">Company-Wide, Next 3 Months</h2>
      </div>

      <div className="stat-grid section">
        {totals.map((t: any) => (
          <div className="stat-card" key={t.month}>
            <div className="stat-label">{t.month}</div>
            <div className="stat-value">€{t.base.toLocaleString()}</div>
            <div className="text-muted" style={{ marginTop: 6 }}>
              €{t.conservative.toLocaleString()} – €{t.optimistic.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={totalsExport} filename="forecast-company-wide.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Conservative</th>
              <th>Base</th>
              <th>Optimistic</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t: any) => (
              <tr key={t.month}>
                <td>{t.month}</td>
                <td>€{t.conservative.toLocaleString()}</td>
                <td>€{t.base.toLocaleString()}</td>
                <td>€{t.optimistic.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {channels.map((c: any) => (
        <div key={c.channel}>
          <div className="section">
            <h2 className="section-title" style={{ textTransform: "capitalize" }}>{c.channel}</h2>
            <p className="section-subtitle">
              Trailing trend: {c.growthRatePct >= 0 ? "+" : ""}{c.growthRatePct}% average month-over-month
            </p>
          </div>

          <div className="data-table-toolbar no-print">
            <ExportCsvButton data={c.projections} filename={`forecast-${c.channel}.csv`} />
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Conservative</th>
                  <th>Base</th>
                  <th>Optimistic</th>
                </tr>
              </thead>
              <tbody>
                {c.projections.map((p: any) => (
                  <tr key={p.month}>
                    <td>{p.month}</td>
                    <td>€{p.conservative.toLocaleString()}</td>
                    <td>€{p.base.toLocaleString()}</td>
                    <td>€{p.optimistic.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/scenario", "/finance-deep", "/decision-intelligence"]} />
    </div>
  );
}
