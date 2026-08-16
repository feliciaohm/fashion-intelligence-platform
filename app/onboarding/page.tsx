"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, setStoredRole, type RoleId } from "@/lib/roles";

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<RoleId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await setStoredRole(selected);
      router.push("/");
      router.refresh();
    } catch (err) {
      // Most likely cause: a Postgres GRANT/RLS permission error on the
      // profiles table (see DATA_AUDIT.md / the same class of issue as the
      // proxy.ts role-check) -- surfaced now instead of hanging on
      // "Setting up..." forever with no feedback.
      console.error("ONBOARDING ERROR:", err);
      setError("Couldn't save your role — this usually means a permissions issue on the profiles table. Try again, or check that table's Row Level Security policies in Supabase.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="onboarding-card">
        <h1 className="login-title">What is your primary role?</h1>
        <p className="login-subtitle" style={{ marginBottom: 28 }}>
          This sets which modules open first. You can change it anytime in Settings.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="onboarding-radio-list">
            {ROLES.map((role) => (
              <label key={role.id} className="onboarding-radio-item">
                <input
                  type="radio"
                  name="role"
                  value={role.id}
                  checked={selected === role.id}
                  onChange={() => setSelected(role.id)}
                />
                <span className="onboarding-radio-dot" />
                <span className="onboarding-radio-label">{role.label}</span>
              </label>
            ))}
          </div>

          {error && (
            <p style={{ color: "var(--status-critical)", fontSize: 13, marginTop: 16, marginBottom: -8 }}>{error}</p>
          )}

          <button type="submit" className="btn" disabled={!selected || loading} style={{ width: "100%", marginTop: 28 }}>
            {loading ? "Setting up…" : "Get started"}
          </button>
        </form>
      </div>
    </div>
  );
}
