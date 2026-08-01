"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, setStoredRole, type RoleId } from "@/lib/roles";

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<RoleId | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    await setStoredRole(selected);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-page">
      <div className="login-mark">
        <div className="login-mark-glyph" />
        <span className="login-mark-text">Fashion Intelligence Platform</span>
      </div>

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

          <button type="submit" className="btn" disabled={!selected || loading} style={{ width: "100%", marginTop: 28 }}>
            {loading ? "Setting up…" : "Get started"}
          </button>
        </form>
      </div>
    </div>
  );
}
