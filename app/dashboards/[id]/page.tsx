"use client";

import { useEffect, useState, use as usePromise } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import RelatedPages from "@/components/RelatedPages";
import { DocFooterNote, formatTimestamp } from "@/components/DocLayout";

interface StatItem {
  label: string;
  value: string;
}

interface Block {
  id: string;
  title: string;
  sourceQuestion: string | null;
  stats: StatItem[];
  computedAt: string;
  position: number;
}

interface Dashboard {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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

function BlockCard({ block }: { block: Block }) {
  const chartData = block.stats
    .map((s) => ({ label: s.label, numeric: parseNumeric(s.value), display: s.value }))
    .filter((s): s is { label: string; numeric: number; display: string } => s.numeric !== null);
  const canChart = chartData.length >= 2 && chartData.length === block.stats.length;

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

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dashboards/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }
        setDashboard(json.dashboard);
        setBlocks(json.blocks);
      });
  }, [id]);

  if (error) {
    return (
      <div>
        <div className="page-eyebrow">Platform · Dashboards</div>
        <h1 className="page-title">Not found</h1>
        <p className="doc-insight-line">{error}</p>
        <RelatedPages hrefs={["/dashboards", "/intelligence"]} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-eyebrow">Platform · Dashboards</div>
      <h1 className="page-title">{dashboard?.name ?? "Loading…"}</h1>
      <p className="doc-insight-line">
        {blocks
          ? `${blocks.length} real exported result${blocks.length === 1 ? "" : "s"}, combined into one saved view.`
          : "Loading…"}
      </p>
      <hr className="doc-header-rule" />

      <div className="section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {blocks && blocks.length === 0 && (
          <p className="text-muted">
            No results added yet — go to the Command Center, ask a question, and click &quot;Add to Dashboard&quot;
            to bring it here.
          </p>
        )}
        {(blocks ?? []).map((b) => (
          <BlockCard key={b.id} block={b} />
        ))}
      </div>

      <DocFooterNote timestamp={formatTimestamp(new Date())} />
      <RelatedPages hrefs={["/dashboards", "/intelligence"]} />
    </div>
  );
}
