"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RelatedPages from "@/components/RelatedPages";
import { DocInsightBox, DocFooterNote, formatTimestamp } from "@/components/DocLayout";
import DashboardBlockCard, { type DashboardBlock } from "@/components/DashboardBlockCard";

interface DashboardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
}

interface StudioMessage {
  key: string;
  prompt: string;
  status: "pending" | "done" | "error";
  dashboardId?: string;
  blockCount?: number;
  error?: string;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardSummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Studio: session-only chat history of generations, plus a cache of each
  // one's real name/blocks so re-clicking a past message doesn't re-fetch.
  const [studioPrompt, setStudioPrompt] = useState("");
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, { name: string; blocks: DashboardBlock[] }>>({});
  const [generating, setGenerating] = useState(false);

  function load() {
    fetch("/api/dashboards")
      .then((res) => res.json())
      .then((json) => setDashboards(json.dashboards ?? []));
  }

  useEffect(load, []);

  async function loadIntoCanvas(dashboardId: string, key: string) {
    setActiveKey(key);
    if (cache[dashboardId]) return;
    const res = await fetch(`/api/dashboards/${dashboardId}`);
    const json = await res.json();
    if (!res.ok) return;
    setCache((c) => ({ ...c, [dashboardId]: { name: json.dashboard.name, blocks: json.blocks } }));
  }

  async function submitStudioPrompt(e: React.FormEvent) {
    e.preventDefault();
    const prompt = studioPrompt.trim();
    if (!prompt || generating) return;
    const key = `${Date.now()}`;
    setMessages((m) => [...m, { key, prompt, status: "pending" }]);
    setActiveKey(key);
    setStudioPrompt("");
    setGenerating(true);
    try {
      const res = await fetch("/api/dashboards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate dashboard");
      setMessages((m) =>
        m.map((msg) => (msg.key === key ? { ...msg, status: "done", dashboardId: json.dashboardId, blockCount: json.blockCount } : msg))
      );
      await loadIntoCanvas(json.dashboardId, key);
      load();
    } catch (err) {
      setMessages((m) =>
        m.map((msg) => (msg.key === key ? { ...msg, status: "error", error: String(err instanceof Error ? err.message : err) } : msg))
      );
    } finally {
      setGenerating(false);
    }
  }

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

  const activeMessage = messages.find((m) => m.key === activeKey);
  const activeDashboard = activeMessage?.dashboardId ? cache[activeMessage.dashboardId] : undefined;

  return (
    <div className="dash-beige">
      <div className="page-eyebrow">Platform · Dashboards</div>
      <h1 className="page-title">Dashboards</h1>
      <p className="doc-insight-line">
        {dashboards
          ? `${dashboards.length} saved dashboard${dashboards.length === 1 ? "" : "s"} — real results exported from the Command Center, kept together under a name you chose.`
          : "Loading…"}
      </p>
      <hr className="doc-header-rule" />

      <div className="section">
        <h2 className="section-title">Describe the dashboard you want</h2>
        <p className="section-subtitle">
          Type what you want to see below — the platform picks the matching real questions, computes each one for
          real against BigQuery, and builds a saved dashboard in seconds. No fabricated numbers: every block still
          comes from the same real calculators as the Command Center.
        </p>

        <div className="dash-studio">
          <div className="dash-studio-chat">
            <div className="dash-studio-chat-header">Studio</div>
            <div className="dash-studio-messages">
              {messages.length === 0 && (
                <p className="dash-studio-empty-chat">
                  Try something like &quot;Show me GMROI, sell-through, and our top influencer&apos;s ROI.&quot; Each
                  request becomes its own saved dashboard you can revisit anytime.
                </p>
              )}
              {messages.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`dash-studio-message${m.key === activeKey ? " active" : ""}`}
                  onClick={() => m.dashboardId && loadIntoCanvas(m.dashboardId, m.key)}
                  disabled={!m.dashboardId}
                >
                  <div className="dash-studio-message-prompt">{m.prompt}</div>
                  <div className={`dash-studio-message-status${m.status === "error" ? " error" : ""}`}>
                    {m.status === "pending" && "Building…"}
                    {m.status === "done" && `${m.blockCount} block${m.blockCount === 1 ? "" : "s"} built`}
                    {m.status === "error" && (m.error ?? "Failed")}
                  </div>
                </button>
              ))}
            </div>
            <form onSubmit={submitStudioPrompt} className="dash-studio-input-row">
              <input
                type="text"
                value={studioPrompt}
                onChange={(e) => setStudioPrompt(e.target.value)}
                placeholder="What would you like to see?"
                disabled={generating}
              />
              <button type="submit" className="dash-studio-send" disabled={generating || !studioPrompt.trim()}>
                {generating ? "…" : "Send"}
              </button>
            </form>
          </div>

          <div className="dash-studio-canvas">
            {!activeMessage && (
              <div className="dash-studio-empty-canvas">
                Nothing generated yet this visit — describe a dashboard on the left and watch it build here.
              </div>
            )}
            {activeMessage?.status === "pending" && (
              <div className="dash-studio-empty-canvas">Building &quot;{activeMessage.prompt}&quot;…</div>
            )}
            {activeMessage?.status === "error" && (
              <div className="dash-studio-empty-canvas">{activeMessage.error}</div>
            )}
            {activeMessage?.status === "done" && activeDashboard && (
              <>
                <div className="dash-studio-canvas-header">
                  <div className="dash-studio-canvas-title">{activeDashboard.name}</div>
                  {activeMessage.dashboardId && (
                    <Link href={`/dashboards/${activeMessage.dashboardId}`} className="text-muted" style={{ textDecoration: "underline", whiteSpace: "nowrap" }}>
                      Open saved dashboard →
                    </Link>
                  )}
                </div>
                {activeDashboard.blocks.map((b) => (
                  <DashboardBlockCard key={b.id} block={b} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">…or create an empty one and add to it manually</h2>
        <p className="section-subtitle">
          Ask a question in the <Link href="/intelligence">Command Center</Link>, click &quot;Add to Dashboard&quot;
          on the real answer you get back, and choose a dashboard to save it into — new or existing.
        </p>
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
