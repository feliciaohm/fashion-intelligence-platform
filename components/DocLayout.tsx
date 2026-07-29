// Shared building blocks for the Document-style page layout (McKinsey-doc
// spec): exactly 3 KPIs with real deltas, a highlighted single-insight box,
// and the data-source footer note. Used by every page as the redesign rolls
// out, so the structure stays identical everywhere rather than redrifting
// page by page.
export interface KpiItem {
  label: string;
  value: string;
  delta?: string;
  direction?: "good" | "critical" | "neutral";
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-strip no-print">
      {items.slice(0, 3).map((item) => (
        <div className="kpi-item" key={item.label}>
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value">{item.value}</div>
          {item.delta && <div className={`kpi-delta ${item.direction ?? "neutral"}`}>{item.delta}</div>}
        </div>
      ))}
    </div>
  );
}

export function DocInsightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-insight-box">
      <p>{children}</p>
    </div>
  );
}

export function DocFooterNote({ timestamp }: { timestamp: string }) {
  return (
    <p className="doc-footer-note">
      Data sourced from BigQuery · Last updated: {timestamp}
    </p>
  );
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
