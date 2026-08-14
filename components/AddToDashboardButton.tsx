"use client";

import { useState } from "react";

interface StatItem {
  label: string;
  value: string;
}

interface DashboardOption {
  id: string;
  name: string;
}

// Export action for layer 2 of the Dashboards feature (retrieval already
// happened via the Command Center's AI Search -- this is just "take the
// real result I already have and save it somewhere named"). Fetches the
// user's existing dashboards lazily, on open, rather than on every Command
// Center render.
export default function AddToDashboardButton({ title, sourceQuestion, stats }: { title: string; sourceQuestion: string; stats: StatItem[] }) {
  const [open, setOpen] = useState(false);
  const [dashboards, setDashboards] = useState<DashboardOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function openPicker() {
    setOpen(true);
    setResult(null);
    if (!dashboards) {
      const res = await fetch("/api/dashboards");
      const json = await res.json();
      setDashboards(json.dashboards ?? []);
    }
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      let dashboardId = selectedId;
      if (!dashboardId) {
        if (!newName.trim()) throw new Error("Pick an existing dashboard or name a new one");
        const createRes = await fetch("/api/dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson.error);
        dashboardId = createJson.dashboard.id;
      }

      const res = await fetch(`/api/dashboards/${dashboardId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceQuestion, stats }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult("Added.");
      setNewName("");
      setSelectedId("");
    } catch (err) {
      setResult(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={openPicker}>
        + Add to Dashboard
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: 12, marginTop: 8, background: "var(--color-bg-sunken)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add this result to a dashboard</div>
      {dashboards === null ? (
        <p className="text-muted" style={{ fontSize: 12 }}>Loading your dashboards…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dashboards.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                if (e.target.value) setNewName("");
              }}
              style={{ fontSize: 13 }}
            >
              <option value="">— choose an existing dashboard —</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (e.target.value) setSelectedId("");
              }}
              placeholder="…or name a new dashboard"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {result && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          {result}{" "}
          {result === "Added." && (
            <>
              —{" "}
              <a href="/dashboards" style={{ color: "var(--color-accent)" }}>
                view your dashboards
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
