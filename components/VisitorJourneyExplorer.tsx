"use client";

import { useMemo, useState } from "react";
import type { PostVisitorSummary, VisitorJourneyEntry } from "@/lib/visitor-journey-server";

type Journey = { influencer: string; productSlug: string; postDate: string; visitors: VisitorJourneyEntry[] };

function fmtTs(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function postKey(p: { influencer: string; productSlug: string; postDate: string }) {
  return `${p.influencer}|||${p.productSlug}|||${p.postDate}`;
}

type Mode = "all" | "date" | "influencer";

export default function VisitorJourneyExplorer({
  summaries,
  journeys,
}: {
  summaries: PostVisitorSummary[];
  journeys: Journey[];
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedInfluencer, setSelectedInfluencer] = useState<string>("");

  // Real values only -- both dropdowns are built from the actual posts in
  // this dataset, never a hardcoded list, so they can never offer a date or
  // influencer with no real data behind it.
  const distinctDates = useMemo(() => [...new Set(summaries.map((s) => s.postDate))].sort().reverse(), [summaries]);
  const distinctInfluencers = useMemo(() => [...new Set(summaries.map((s) => s.influencer))].sort(), [summaries]);

  const filtered = useMemo(() => {
    if (mode === "date" && selectedDate) return summaries.filter((s) => s.postDate === selectedDate);
    if (mode === "influencer" && selectedInfluencer) return summaries.filter((s) => s.influencer === selectedInfluencer);
    return summaries;
  }, [mode, selectedDate, selectedInfluencer, summaries]);

  return (
    <div>
      <div className="section" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {(["all", "date", "influencer"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="chip-button"
              style={{
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 999,
                border: mode === m ? "1px solid var(--color-ink)" : "1px solid var(--color-border)",
                background: mode === m ? "var(--color-accent-soft)" : "transparent",
                cursor: "pointer",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === "all" ? "All posts" : m === "date" ? "Search by date" : "Search by influencer"}
            </button>
          ))}
        </div>

        {mode === "date" && (
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginBottom: 16, maxWidth: 280 }}
          >
            <option value="">— Pick a real post date —</option>
            {distinctDates.map((d) => {
              const count = summaries.filter((s) => s.postDate === d).length;
              return (
                <option key={d} value={d}>
                  {d} ({count} post{count === 1 ? "" : "s"})
                </option>
              );
            })}
          </select>
        )}

        {mode === "influencer" && (
          <select
            value={selectedInfluencer}
            onChange={(e) => setSelectedInfluencer(e.target.value)}
            style={{ marginBottom: 16, maxWidth: 280 }}
          >
            <option value="">— Pick a real influencer —</option>
            {distinctInfluencers.map((inf) => {
              const count = summaries.filter((s) => s.influencer === inf).length;
              return (
                <option key={inf} value={inf}>
                  {inf} ({count} post{count === 1 ? "" : "s"})
                </option>
              );
            })}
          </select>
        )}

        {(mode === "date" && !selectedDate) || (mode === "influencer" && !selectedInfluencer) ? (
          <p className="text-muted" style={{ marginBottom: 16 }}>
            {mode === "date" ? "Pick a date above to see every real post that day." : "Pick an influencer above to see every real post they've made."}
          </p>
        ) : null}
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        {filtered.length === 0 ? (
          <p className="text-muted">No posts match this filter.</p>
        ) : (
          filtered.map((s) => {
            const journey = journeys.find((j) => postKey(j) === postKey(s));
            return (
              <details key={postKey(s)} className="panel" style={{ marginBottom: 10, padding: 0 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr",
                    gap: 12,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span>
                    <strong>{s.influencer}</strong> — {s.productSlug} <span className="text-muted">({s.postDate})</span>
                  </span>
                  <span>{s.visitorsInWindow} visitors</span>
                  <span className="text-muted">
                    {s.newVisitors} new / {s.returningVisitors} returning
                  </span>
                  <span className="text-muted">{s.visitorsWhoReturnedLater} came back later</span>
                  <span>{s.visitorsWhoPurchased} purchased</span>
                  <span>{s.revenueFromWindow ? `€${Math.round(s.revenueFromWindow).toLocaleString()}` : "—"}</span>
                </summary>
                <div style={{ padding: "0 16px 16px" }}>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Visitor ID</th>
                          <th>Captured At</th>
                          <th>New or Returning</th>
                          <th>Later Sessions</th>
                          <th>Last Activity</th>
                          <th>Purchased</th>
                          <th>Days to Purchase</th>
                          <th>Also Near</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journey?.visitors.map((v, vi) => (
                          <tr key={vi}>
                            <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>{v.visitorId.slice(0, 12)}…</td>
                            <td>{fmtTs(v.capturedAt)}</td>
                            <td>{v.wasNewVisitor ? "New" : "Returning"}</td>
                            <td>{v.laterSessionCount}</td>
                            <td>{fmtTs(v.lastActivity)}</td>
                            <td style={{ color: v.purchased ? "var(--status-good)" : "var(--color-ink-secondary)" }}>
                              {v.purchased ? "Yes" : "No"}
                            </td>
                            <td>{v.daysToPurchase ?? "—"}</td>
                            <td>
                              {v.ambiguousWith.length > 0 ? (
                                <span
                                  title={v.ambiguousWith.map((p) => `${p.influencer} — ${p.productSlug} (${p.postDate})`).join(", ")}
                                  style={{ color: "var(--status-critical)", fontSize: 11, cursor: "help", borderBottom: "1px dotted currentColor" }}
                                >
                                  {v.ambiguousWith.length} other post{v.ambiguousWith.length === 1 ? "" : "s"}
                                </span>
                              ) : (
                                <span className="text-muted" style={{ fontSize: 11 }}>
                                  Only this post
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
