"use client";

import { useEffect, useState, use as usePromise } from "react";
import RelatedPages from "@/components/RelatedPages";
import { DocFooterNote, formatTimestamp } from "@/components/DocLayout";
import DashboardBlockCard, { type DashboardBlock } from "@/components/DashboardBlockCard";

interface Dashboard {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [blocks, setBlocks] = useState<DashboardBlock[] | null>(null);
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
          <DashboardBlockCard key={b.id} block={b} />
        ))}
      </div>

      <DocFooterNote timestamp={formatTimestamp(new Date())} />
      <RelatedPages hrefs={["/dashboards", "/intelligence"]} />
    </div>
  );
}
