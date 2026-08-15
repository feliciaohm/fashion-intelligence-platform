"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatTimestamp } from "@/components/DocLayout";

export interface StatItem {
  label: string;
  value: string;
}

export interface DashboardBlock {
  id: string;
  title: string;
  sourceQuestion: string | null;
  stats: StatItem[];
  computedAt: string;
  position: number;
}

// Best-effort numeric parse of an already-formatted stat value (e.g.
// "€12,400", "45.2%", "1,204 units") -- strictly for chart bar heights.
// The tooltip and stat tiles always show the real original string, never
// this parsed number, so nothing here can misrepresent the actual
// computed value -- it's only used to decide bar length.
function parseNumeric(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// The unit "shape" of a value -- everything that ISN'T the number itself
// (a leading currency symbol, a trailing "%" or "x", plain unitless). Two
// stats only belong on the same axis if this shape matches -- confirmed
// live why this matters: a real GMROI answer had "1.83x" (a ratio) next to
// "0" and "1" (plain category counts) parse to numbers fine on their own,
// but charting a ratio against counts on one shared axis is comparing
// unrelated things, not a real chartable series.
function unitShape(value: string): string {
  return value.replace(/[\d.,\s-]/g, "");
}

// Shared between /dashboards/[id] (the permanent, saved view) and the
// Studio canvas (the live in-progress view) -- one real rendering of a
// dashboard block, used everywhere a block is shown so the two never
// visually drift apart.
export default function DashboardBlockCard({ block }: { block: DashboardBlock }) {
  const chartData = block.stats
    .map((s) => ({ label: s.label, numeric: parseNumeric(s.value), display: s.value, shape: unitShape(s.value) }))
    .filter((s): s is { label: string; numeric: number; display: string; shape: string } => s.numeric !== null);
  const allSameShape = chartData.length > 0 && chartData.every((s) => s.shape === chartData[0].shape);
  const canChart = chartData.length >= 2 && chartData.length === block.stats.length && allSameShape;

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{block.title}</div>
        <span className="text-muted" style={{ fontSize: 11, whiteSpace: "nowrap", marginLeft: 12 }}>
          as of {formatTimestamp(new Date(block.computedAt))}
        </span>
      </div>
      {block.sourceQuestion && (
        <p className="text-muted" style={{ fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
          &quot;{block.sourceQuestion}&quot;
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(block.stats.length, 4)}, 1fr)`,
          gap: 12,
          marginBottom: canChart ? 16 : 0,
        }}
      >
        {block.stats.map((s, i) => (
          <div key={i}>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {canChart && (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--color-bg-sunken)" }}
                contentStyle={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={((_value: unknown, _name: unknown, item: any) => [item.payload.display, item.payload.label]) as any}
                labelFormatter={() => ""}
              />
              <Bar dataKey="numeric" fill="var(--color-accent)" radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
