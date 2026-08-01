"use client";

import { useEffect, useState } from "react";
import { ROLES, getStoredRole, setStoredRole, type RoleId } from "@/lib/roles";

export default function RoleSettings() {
  const [current, setCurrent] = useState<RoleId | null | undefined>(undefined);
  const [selected, setSelected] = useState<RoleId | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStoredRole().then((r) => {
      setCurrent(r);
      setSelected(r);
    });
  }, []);

  async function save() {
    if (!selected || selected === current) return;
    setSaving(true);
    setSaved(false);
    await setStoredRole(selected);
    setCurrent(selected);
    setSaving(false);
    setSaved(true);
  }

  if (current === undefined) {
    return <p className="text-muted">Loading…</p>;
  }

  return (
    <div className="panel">
      <div className="onboarding-radio-list" style={{ borderTop: "none" }}>
        {ROLES.map((role) => (
          <label key={role.id} className="onboarding-radio-item">
            <input
              type="radio"
              name="settings-role"
              value={role.id}
              checked={selected === role.id}
              onChange={() => {
                setSelected(role.id);
                setSaved(false);
              }}
            />
            <span className="onboarding-radio-dot" />
            <span className="onboarding-radio-label">{role.label}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
        <button type="button" className="btn" onClick={save} disabled={saving || !selected || selected === current}>
          {saving ? "Saving…" : "Save role"}
        </button>
        {saved && <span style={{ fontSize: 12.5, color: "var(--color-accent)" }}>Saved</span>}
      </div>
    </div>
  );
}
