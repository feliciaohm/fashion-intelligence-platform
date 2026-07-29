"use client";

import { useState } from "react";

const EXAMPLES = [
  "Which influencer gave the highest ROI?",
  "Which country generates the most revenue?",
  "Which products have negative influencer ROI?",
];

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runQuery(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.details || json.error || "Something went wrong");
      } else {
        setAnswer(json.answer);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runQuery(query);
        }}
        style={{ display: "flex", gap: 10 }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question — e.g. 'which influencer gave highest ROI?'"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="pill-row" style={{ marginTop: 10 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => runQuery(ex)}
            className="badge"
            style={{ border: "none", cursor: "pointer" }}
          >
            {ex}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted" style={{ marginTop: 16 }}>Querying BigQuery + Claude…</p>}

      {error && (
        <div className="panel" style={{ marginTop: 16, borderColor: "var(--status-critical)" }}>
          <p style={{ color: "var(--status-critical)", fontWeight: 600, marginBottom: 4 }}>
            AI query unavailable
          </p>
          <p className="text-muted">{error}</p>
        </div>
      )}

      {answer && (
        <div className="panel" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
          {answer}
        </div>
      )}
    </div>
  );
}
