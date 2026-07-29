import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await fetch("http://localhost:3000/api/returns", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch returns");
  return res.json();
}

export default async function ReturnsPage() {
  const data = await getData();

  const totalRefunded = data.reduce((s: number, r: any) => s + (r.refund_amount || 0), 0);
  const linkedToCampaign = data.filter((r: any) => r.influencer_campaign).length;
  const avgRefund = data.length ? totalRefunded / data.length : 0;
  const linkedPct = data.length ? (linkedToCampaign / data.length) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Total Returns",
      value: `${data.length}`,
      delta: "real returns, from sales_events",
      direction: "neutral",
    },
    {
      label: "Total Refunded",
      value: `€${totalRefunded.toLocaleString()}`,
      delta: `avg. €${avgRefund.toLocaleString(undefined, { maximumFractionDigits: 0 })}/return`,
      direction: "critical",
    },
    {
      label: "Linked to a Campaign",
      value: `${linkedToCampaign}`,
      delta: `${linkedPct.toFixed(1)}% of ${data.length} traceable`,
      direction: "neutral",
    },
  ];

  const reasonCounts: Record<string, number> = {};
  data.forEach((r: any) => { reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1; });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  const productRefunds: Record<string, number> = {};
  data.forEach((r: any) => { productRefunds[r.product_slug] = (productRefunds[r.product_slug] || 0) + (r.refund_amount || 0); });
  const topRefundProduct = Object.entries(productRefunds).sort((a, b) => b[1] - a[1])[0];

  const headline = topReason
    ? `"${topReason[0].replace(/_/g, " ")}" is the most common return reason — ${topReason[1]} of ${data.length} returns (${((topReason[1] / data.length) * 100).toFixed(1)}%).`
    : "No return data available.";
  const insightBoxText = topRefundProduct
    ? `${topRefundProduct[0]} accounts for the largest refund total — €${topRefundProduct[1].toLocaleString()} across all real returns.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Finance · Returns</div>
      <h1 className="page-title">Returns</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="returns.csv" />
        </div>
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Reason</th>
              <th>Return Date</th>
              <th>Refund Amount</th>
              <th>Influencer Campaign</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.product_slug}</td>
                <td>{r.reason.replace(/_/g, " ")}</td>
                <td>{r.return_date?.value ?? r.return_date}</td>
                <td>€{r.refund_amount}</td>
                <td>{r.influencer_campaign ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/customers", "/products", "/finance-deep"]} />
    </div>
  );
}
