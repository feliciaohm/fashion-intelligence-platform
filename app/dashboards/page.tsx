"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RelatedPages from "@/components/RelatedPages";
import { DocInsightBox, DocFooterNote, formatTimestamp } from "@/components/DocLayout";

interface DashboardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardSummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/dashboards")
      .then((res) => res.json())
      .then((json) => setDashboards(json.dashboards ?? []));
  }

  useEffect(load, []);

  async function createDashboard(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNewName("");
      load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-eyebrow">Platform · Dashboards</div>
      <h1 className="page-title">Dashboards</h1>
      <p className="doc-insight-line">
        {dashboards
          ? `${dashboards.length} saved dashboard${dashboards.length === 1 ? "" : "s"} — real results exported from the Command Center, kept together under a name you chose.`
          : "Loading…"}
      </p>
      <hr className="doc-header-rule" />

      <div className="section">
        <h2 className="section-title">How this works</h2>
        <p className="section-subtitle">
          Ask a question in the <Link href="/intelligence">Command Center</Link>, click <strong>&quot;Add to
          Dashboard&quot;</strong> on the real answer you get back, and choose a dashboard to save it into — new
          or existing. Each block keeps the real numbers exactly as computed, plus the question that produced
          them and when. A dashboard can combine results from several different questions and searches into one
          named, saved view.
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">Create a new dashboard</h2>
        <form onSubmit={createDashboard} style={{ display: "flex", gap: 8, maxWidth: 480 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Q1 Marketing Review"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
        {error && <p style={{ color: "var(--status-critical)", fontSize: 12, marginTop: 6 }}>{error}</p>}
      </div>

      <div className="section">
        {dashboards && dashboards.length === 0 && (
          <p className="text-muted">
            No dashboards yet — create one above, or export your first result from the Command Center.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {(dashboards ?? []).map((d) => (
            <Link
              key={d.id}
              href={`/dashboards/${d.id}`}
              className="panel"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{d.name}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {d.blockCount} {d.blockCount === 1 ? "block" : "blocks"} · updated {formatTimestamp(new Date(d.updatedAt))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {dashboards && dashboards.length > 0 && (
        <DocInsightBox>
          {dashboards.length} dashboard{dashboards.length === 1 ? "" : "s"} saved, combining{" "}
          {dashboards.reduce((s, d) => s + d.blockCount, 0)} real exported results in total.
        </DocInsightBox>
      )}
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/intelligence", "/executive"]} />
    </div>
  );
}
