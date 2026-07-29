import type { QuickMetric } from "@/lib/quick-metrics-server";

const DOT_COLOR: Record<string, string> = {
  good: "var(--status-good)",
  warn: "#c9a227",
  critical: "var(--status-critical)",
  neutral: "var(--color-ink-muted, #9c9585)",
};

export default function QuickMetricsPanel({ metrics }: { metrics: QuickMetric[] }) {
  return (
    <div className="section panel no-print">
      <div className="stat-label" style={{ marginBottom: 4 }}>Quick Metrics — the first-hour diagnostic</div>
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
        The six numbers a consultant checks first on any engagement, refreshed live from real data.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 14,
        }}
      >
        {metrics.map((m) => (
          <div key={m.id} style={{ borderLeft: `3px solid ${DOT_COLOR[m.status]}`, paddingLeft: 10 }}>
            <div className="text-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, color: "var(--color-ink)" }}>{m.value}</div>
            <div className="text-muted" style={{ fontSize: 10.5, marginTop: 2 }}>{m.benchmarkNote}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
