import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function dateOf(r: any): string {
  return r.order_date?.value ?? r.order_date ?? "";
}

function pctDelta(oldVal: number, newVal: number): number | null {
  if (oldVal === 0) return null;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

async function getData() {
  const res = await fetch("http://localhost:3000/api/wholesale", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch wholesale orders");
  return res.json();
}

export default async function WholesalePage() {
  const data = await getData();

  const retailers = Array.from(new Set<string>(data.map((r: any) => r.retailer as string))).map((name: string) => {
    const rows = data.filter((r: any) => r.retailer === name);
    const revenue = rows.reduce((s: number, r: any) => s + r.revenue, 0);
    const reorders = rows.filter((r: any) => r.is_reorder).length;
    return {
      retailer: name,
      orders: rows.length,
      revenue,
      reorderPct: (reorders / rows.length) * 100,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = data.reduce((s: number, r: any) => s + r.revenue, 0);
  const totalOrders = data.length;
  const totalReorders = data.filter((r: any) => r.is_reorder).length;

  const topProducts = Array.from(new Set<string>(data.map((r: any) => r.product_slug as string))).map((slug: string) => {
    const rows = data.filter((r: any) => r.product_slug === slug);
    const revenue = rows.reduce((s: number, r: any) => s + r.revenue, 0);
    const units = rows.reduce((s: number, r: any) => s + r.quantity, 0);
    return { product_slug: slug, orders: rows.length, units, revenue };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const sortedByDate = [...data].sort((a: any, b: any) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : 0));
  const mid = Math.floor(sortedByDate.length / 2);
  const older = sortedByDate.slice(0, mid);
  const newer = sortedByDate.slice(mid);
  const olderRevenue = older.reduce((s: number, r: any) => s + r.revenue, 0);
  const newerRevenue = newer.reduce((s: number, r: any) => s + r.revenue, 0);
  const revenueDeltaPct = pctDelta(olderRevenue, newerRevenue);
  const orderCountDelta = newer.length - older.length;

  const kpis: KpiItem[] = [
    {
      label: "Wholesale Revenue",
      value: `€${totalRevenue.toLocaleString()}`,
      delta: revenueDeltaPct !== null ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs. earlier orders` : "no prior cohort to compare",
      direction: revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "good" : "critical",
    },
    {
      label: "Reorder Rate",
      value: `${((totalReorders / totalOrders) * 100).toFixed(1)}%`,
      delta: `${totalReorders} of ${totalOrders} orders`,
      direction: "neutral",
    },
    {
      label: "Total Orders",
      value: `${totalOrders}`,
      delta: `${orderCountDelta >= 0 ? "+" : ""}${orderCountDelta} vs. earlier cohort`,
      direction: "neutral",
    },
  ];

  const topRetailer = retailers[0];
  const topProduct = topProducts[0];

  const headline = topRetailer
    ? `${topRetailer.retailer} is the largest wholesale partner — €${topRetailer.revenue.toLocaleString()} revenue across ${topRetailer.orders} orders, ${topRetailer.reorderPct.toFixed(1)}% reorder rate.`
    : "No wholesale order data available.";

  const insightBoxText = topProduct
    ? `${topProduct.product_slug} is the top wholesale product — €${topProduct.revenue.toLocaleString()} revenue across ${topProduct.units} units and ${topProduct.orders} orders.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Wholesale Intelligence</div>
      <h1 className="page-title">Wholesale Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">By Retailer</h2>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={retailers} filename="wholesale-by-retailer.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Retailer</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Reorder Rate</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.retailer}>
                <td>{r.retailer}</td>
                <td>{r.orders}</td>
                <td>€{r.revenue.toLocaleString()}</td>
                <td>{r.reorderPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Top Products by Wholesale Revenue</h2>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={topProducts} filename="wholesale-top-products.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Orders</th>
              <th>Units</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.product_slug}>
                <td>{p.product_slug}</td>
                <td>{p.orders}</td>
                <td>{p.units}</td>
                <td>€{p.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2 className="section-title">Order Detail</h2>
        <p className="section-subtitle">Most recent 30 orders shown — export downloads all {data.length}</p>
      </div>

      <div className="data-table-toolbar">
        <ExportCsvButton data={data} filename="wholesale-orders.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Retailer</th>
              <th>Product</th>
              <th>Order Date</th>
              <th>Quantity</th>
              <th>Wholesale Price</th>
              <th>Revenue</th>
              <th>Reorder</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.retailer}</td>
                <td>{r.product_slug}</td>
                <td>{r.order_date?.value ?? r.order_date}</td>
                <td>{r.quantity}</td>
                <td>€{r.wholesale_price}</td>
                <td>€{r.revenue.toLocaleString()}</td>
                <td>{r.is_reorder ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/product-lifecycle", "/suppliers", "/finance-deep"]} />
    </div>
  );
}
