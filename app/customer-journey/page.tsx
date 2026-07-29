import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

const CHURN_ALERT_THRESHOLD_PCT = 30;

async function getData() {
  const res = await fetch("http://localhost:3000/api/customer-journey", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch customer journey");
  return res.json();
}

export default async function CustomerJourneyPage() {
  const data = await getData();

  const avgDaysToConvert = data.reduce((s: number, r: any) => s + r.days_to_convert, 0) / data.length;
  const highChurn = data.filter((r: any) => r.churn_risk === "high").length;
  const vipCount = data.filter((r: any) => r.vip_segment === "VIP").length;
  const highChurnPct = data.length ? (highChurn / data.length) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Converting Customers",
      value: `${data.length}`,
      delta: "real purchasers tracked end-to-end",
      direction: "neutral",
    },
    {
      label: "High Churn Risk",
      value: `${highChurn}`,
      delta: `${highChurnPct.toFixed(1)}% vs. ${CHURN_ALERT_THRESHOLD_PCT}% alert threshold`,
      direction: highChurnPct <= CHURN_ALERT_THRESHOLD_PCT ? "good" : "critical",
    },
    {
      label: "Avg. Days to Convert",
      value: avgDaysToConvert.toFixed(1),
      delta: "first touch to purchase",
      direction: "neutral",
    },
  ];

  const headline = `${highChurn} of ${data.length} customers (${highChurnPct.toFixed(1)}%) are flagged high churn risk — ${highChurnPct > CHURN_ALERT_THRESHOLD_PCT ? "above" : "within"} the ${CHURN_ALERT_THRESHOLD_PCT}% alert threshold.`;
  const insightBoxText = `${vipCount} of ${data.length} converting customers (${((vipCount / data.length) * 100).toFixed(1)}%) are VIP-segment — the highest-value cohort to protect against churn first.`;

  return (
    <div>
      <div className="page-eyebrow">People · Customer Journey</div>
      <h1 className="page-title">Customer Journey</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      <KpiStrip items={kpis} />

      <div className="section">
        <div className="data-table-toolbar">
          <ExportCsvButton data={data} filename="customer-journey.csv" />
        </div>
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>First Touch</th>
              <th>Source</th>
              <th>Purchase Date</th>
              <th>Days to Convert</th>
              <th>Sessions</th>
              <th>Last Active</th>
              <th>Churn Risk</th>
              <th>Segment</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.customer_id.slice(0, 8)}</td>
                <td>{r.first_touch_date?.value ?? r.first_touch_date}</td>
                <td>{r.first_touch_source ?? "organic"}</td>
                <td>{r.purchase_date?.value ?? r.purchase_date}</td>
                <td>{r.days_to_convert}</td>
                <td>{r.total_sessions}</td>
                <td>{r.last_activity_date?.value ?? r.last_activity_date}</td>
                <td
                  style={{
                    color:
                      r.churn_risk === "high"
                        ? "var(--status-critical)"
                        : r.churn_risk === "low"
                        ? "var(--status-good)"
                        : "var(--color-ink-secondary)",
                  }}
                >
                  {r.churn_risk}
                </td>
                <td>{r.vip_segment}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/customers", "/growth-bridge", "/decision-intelligence"]} />
    </div>
  );
}
