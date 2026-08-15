import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

async function getData() {
  const res = await selfFetch("/api/stores", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch store performance");
  return res.json();
}

export default async function StoresPage() {
  const data = await getData();

  const stores = Array.from(new Set<string>(data.map((r: any) => r.store_id as string))).map((id: string) => {
    const rows = data.filter((r: any) => r.store_id === id);
    const revenue = rows.reduce((s: number, r: any) => s + r.revenue, 0);
    const staffCost = rows.reduce((s: number, r: any) => s + r.staff_cost, 0);
    const rent = rows.reduce((s: number, r: any) => s + r.rent, 0);
    const avgConversion = rows.reduce((s: number, r: any) => s + r.conversion_rate_pct, 0) / rows.length;
    return {
      store_id: id,
      store_name: rows[0].store_name,
      city: rows[0].city,
      country: rows[0].country,
      revenue,
      staffCost,
      rent,
      avgConversion,
      contribution: revenue - staffCost - rent,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = stores.reduce((s, r) => s + r.revenue, 0);
  const totalStaffCost = stores.reduce((s, r) => s + r.staffCost, 0);
  const totalRent = stores.reduce((s, r) => s + r.rent, 0);
  const avgConversionAll = stores.reduce((s, r) => s + r.avgConversion, 0) / stores.length;
  const totalContribution = totalRevenue - totalStaffCost - totalRent;

  const periods = Array.from(new Set(data.map((r: any) => r.period))).sort();
  const mid = Math.floor(periods.length / 2);
  const olderPeriods = new Set(periods.slice(0, mid));
  const newerPeriods = new Set(periods.slice(mid));
  const olderRows = data.filter((r: any) => olderPeriods.has(r.period));
  const newerRows = data.filter((r: any) => newerPeriods.has(r.period));
  const olderRevenue = olderRows.reduce((s: number, r: any) => s + r.revenue, 0);
  const newerRevenue = newerRows.reduce((s: number, r: any) => s + r.revenue, 0);
  const revenueDeltaPct = pctDelta(olderRevenue, newerRevenue);
  const olderConversion = olderRows.length ? olderRows.reduce((s: number, r: any) => s + r.conversion_rate_pct, 0) / olderRows.length : 0;
  const newerConversion = newerRows.length ? newerRows.reduce((s: number, r: any) => s + r.conversion_rate_pct, 0) / newerRows.length : 0;
  const conversionDeltaPts = newerConversion - olderConversion;

  const kpis: KpiItem[] = [
    {
      label: "Total Retail Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier months` : "no prior period to compare",
      direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
    },
    {
      label: "Avg. Conversion Rate",
      value: `${avgConversionAll.toFixed(1)}%`,
      delta: `${conversionDeltaPts >= 0 ? "+" : ""}${conversionDeltaPts.toFixed(1)} pts vs. earlier months`,
      direction: conversionDeltaPts >= 0 ? "good" : "critical",
    },
    {
      label: "Total Contribution",
      value: `€${totalContribution.toLocaleString()}`,
      delta: `after €${totalStaffCost.toLocaleString()} staff + €${totalRent.toLocaleString()} rent`,
      direction: totalContribution >= 0 ? "good" : "critical",
    },
  ];

  const topStore = stores[0];
  const weakestStore = [...stores].sort((a, b) => a.contribution - b.contribution)[0];

  const headline = topStore
    ? `${topStore.store_name} is the top-performing store — €${topStore.revenue.toLocaleString()} revenue at ${topStore.avgConversion.toFixed(1)}% conversion.`
    : "No store performance data available.";

  const insightBoxText = weakestStore && weakestStore.store_id !== topStore?.store_id
    ? `${weakestStore.store_name} has the lowest contribution after staff and rent, at €${weakestStore.contribution.toLocaleString()} — worth reviewing footfall and staffing levels.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Store Performance</div>
      <h1 className="page-title">Store Performance</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">By Store</h2>
        <p className="section-subtitle">Sorted by revenue, Feb–Nov 2026 total</p>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={stores} filename="store-performance-by-store.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>City</th>
              <th>Revenue</th>
              <th>Staff Cost</th>
              <th>Rent</th>
              <th>Contribution</th>
              <th>Avg. Conversion</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.store_id}>
                <td>{s.store_name}</td>
                <td>{s.city}, {s.country}</td>
                <td>€{s.revenue.toLocaleString()}</td>
                <td>€{s.staffCost.toLocaleString()}</td>
                <td>€{s.rent.toLocaleString()}</td>
                <td style={{ color: s.contribution >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  €{s.contribution.toLocaleString()}
                </td>
                <td>{s.avgConversion.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Monthly Detail</h2>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={data} filename="store-performance-monthly.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Month</th>
              <th>Revenue</th>
              <th>Footfall</th>
              <th>Transactions</th>
              <th>Conversion</th>
              <th>Avg. Transaction</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.store_name}</td>
                <td>{r.period}</td>
                <td>€{r.revenue.toLocaleString()}</td>
                <td>{r.footfall.toLocaleString()}</td>
                <td>{r.transactions.toLocaleString()}</td>
                <td>{r.conversion_rate_pct}%</td>
                <td>€{r.avg_transaction_value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/finance-deep", "/value-drivers", "/decision-intelligence"]} />
    </div>
  );
}
