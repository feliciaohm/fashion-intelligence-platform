import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await fetch("http://localhost:3000/api/customers", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export default async function CustomersPage() {
  const data = await getData();

  const segmentCounts = data.reduce((acc: any, c: any) => {
    acc[c.segment] = (acc[c.segment] || 0) + 1;
    return acc;
  }, {});
  const totalLtv = data.reduce((sum: number, c: any) => sum + (c.lifetime_value || 0), 0);
  const retainedCount = (segmentCounts.VIP ?? 0) + (segmentCounts.returning ?? 0);
  const retainedPct = data.length ? (retainedCount / data.length) * 100 : 0;
  const avgLtv = data.length ? totalLtv / data.length : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Customers",
      value: `${data.length}`,
      delta: "real purchasers, from sales_events",
      direction: "neutral",
    },
    {
      label: "VIP + Returning",
      value: `${retainedCount}`,
      delta: `${retainedPct.toFixed(1)}% of the base`,
      direction: retainedPct >= 30 ? "good" : "critical",
    },
    {
      label: "Total Lifetime Value",
      value: `€${totalLtv.toLocaleString()}`,
      delta: `avg. €${avgLtv.toLocaleString(undefined, { maximumFractionDigits: 0 })}/customer`,
      direction: "neutral",
    },
  ];

  const topCustomer = [...data].sort((a: any, b: any) => (b.lifetime_value || 0) - (a.lifetime_value || 0))[0];
  const headline = topCustomer
    ? `Customer ${topCustomer.customer_id.slice(0, 8)} has the highest lifetime value at €${topCustomer.lifetime_value.toLocaleString()}, segment: ${topCustomer.segment}.`
    : "No customer data available.";

  const newCount = data.length - retainedCount;
  const insightBoxText = `${newCount} of ${data.length} customers (${(100 - retainedPct).toFixed(1)}%) are still in the "new" segment — the largest real opportunity for a repeat-purchase push.`;

  return (
    <div>
      <div className="page-eyebrow">People · Customer Segments</div>
      <h1 className="page-title">Customers</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="customers.csv" />
        </div>
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Segment</th>
              <th>Country</th>
              <th>First Purchase</th>
              <th>Orders</th>
              <th>Lifetime Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any, i: number) => (
              <tr key={i}>
                <td>{c.customer_id.slice(0, 8)}</td>
                <td>
                  <span className="badge">{c.segment}</span>
                </td>
                <td>{c.country}</td>
                <td>{c.first_purchase_date?.value ?? c.first_purchase_date}</td>
                <td>{c.order_count}</td>
                <td>€{c.lifetime_value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/customer-journey", "/returns", "/decision-intelligence"]} />
    </div>
  );
}
