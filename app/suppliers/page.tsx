import ExportCsvButton from "@/components/ExportCsvButton";
import { selfFetch } from "@/lib/self-fetch";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

async function getData() {
  const res = await selfFetch("/api/suppliers", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  return res.json();
}

export default async function SuppliersPage() {
  const { suppliers, atRiskCount, totalSuppliers, avgOtd, totalSpend, thresholds } = await getData();

  const atRisk = suppliers.filter((s: any) => s.atRisk);
  const worstSupplier = [...suppliers].sort((a: any, b: any) => a.on_time_delivery_rate - b.on_time_delivery_rate)[0];

  const kpis: KpiItem[] = [
    {
      label: "Total Suppliers",
      value: `${totalSuppliers}`,
      delta: `€${totalSpend.toLocaleString()} estimated annual spend`,
      direction: "neutral",
    },
    {
      label: "Suppliers At Risk",
      value: `${atRiskCount}`,
      delta: `OTD below ${thresholds.otd}% or lead time over ${thresholds.leadTimeDays}d`,
      direction: atRiskCount === 0 ? "good" : "critical",
    },
    {
      label: "Avg. On-Time Delivery",
      value: `${avgOtd}%`,
      delta: avgOtd >= thresholds.otd ? "above risk threshold" : "below risk threshold",
      direction: avgOtd >= thresholds.otd ? "good" : "critical",
    },
  ];

  const headline = worstSupplier
    ? `${worstSupplier.supplier_name} (${worstSupplier.country}) has the weakest on-time delivery rate at ${worstSupplier.on_time_delivery_rate}%, against a ${thresholds.otd}% risk threshold.`
    : "No supplier data available.";
  const insightBoxText = atRiskCount > 0
    ? `${atRiskCount} of ${totalSuppliers} suppliers are flagged at risk — prioritize a delivery-performance review before the next reorder cycle, especially for single-sourced categories.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Commerce · Supplier Intelligence</div>
      <h1 className="page-title">Supplier Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <h2 className="section-title">Risk Alerts</h2>
        <p className="section-subtitle">
          Any supplier with on-time delivery below {thresholds.otd}% or lead time over {thresholds.leadTimeDays} days.
        </p>
      </div>

      {atRisk.length === 0 ? (
        <EmptyState label="No Risk Alerts" message="Every tracked supplier is currently within the delivery and lead-time thresholds." />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Country</th>
                <th>Category</th>
                <th>On-Time Delivery</th>
                <th>Lead Time</th>
                <th>Risk Reason</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((s: any) => (
                <tr key={s.supplier_id}>
                  <td>{s.supplier_name}</td>
                  <td>{s.country}</td>
                  <td>{s.category}</td>
                  <td style={{ color: s.on_time_delivery_rate < thresholds.otd ? "var(--status-critical)" : undefined }}>
                    {s.on_time_delivery_rate}%
                  </td>
                  <td style={{ color: s.lead_time_days > thresholds.leadTimeDays ? "var(--status-critical)" : undefined }}>
                    {s.lead_time_days}d
                  </td>
                  <td className="text-muted" style={{ fontSize: 12.5 }}>{s.riskReasons.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Supplier Scorecard</h2>
        <p className="section-subtitle">
          Lead time, on-time delivery, and cost trend per supplier. Spend is derived from real cost-of-goods and units sold
          in each supplier's product category (product_lifecycle), split evenly across suppliers serving that category —
          this dataset has no purchase-order-level table to source exact per-supplier spend from.
        </p>
      </div>

      <div className="data-table-toolbar no-print">
        <ExportCsvButton data={suppliers} filename="suppliers-scorecard.csv" />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Country</th>
              <th>Category</th>
              <th>Lead Time</th>
              <th>On-Time Delivery</th>
              <th>Cost / Unit</th>
              <th>MOQ</th>
              <th>Payment Terms</th>
              <th>Est. Spend</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s: any) => (
              <tr key={s.supplier_id}>
                <td>{s.supplier_name}</td>
                <td>{s.country}</td>
                <td>{s.category}</td>
                <td style={{ color: s.lead_time_days > thresholds.leadTimeDays ? "var(--status-critical)" : undefined }}>
                  {s.lead_time_days}d
                </td>
                <td style={{ color: s.on_time_delivery_rate < thresholds.otd ? "var(--status-critical)" : "var(--status-good)" }}>
                  {s.on_time_delivery_rate}%
                </td>
                <td>€{s.cost_per_unit.toFixed(2)}</td>
                <td>{s.minimum_order_quantity}</td>
                <td className="text-muted" style={{ fontSize: 12.5 }}>{s.payment_terms}</td>
                <td>€{s.estimatedSpend.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/decision-intelligence", "/product-lifecycle", "/wholesale"]} />
    </div>
  );
}
