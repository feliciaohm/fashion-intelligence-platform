"use client";

import { ROLES, RoleId } from "@/lib/roles";

export default function RoleSelector({ onSelect }: { onSelect: (id: RoleId) => void }) {
  return (
    <div>
      <div className="page-eyebrow">Fashion Intelligence Platform</div>
      <h1 className="page-title" style={{ fontSize: 34, maxWidth: 640 }}>
        Who&apos;s using the platform today?
      </h1>
      <p className="page-subtitle" style={{ maxWidth: 560 }}>
        Pick a role and the platform shows you the modules that matter most to you first —
        the full platform is always one click away in the sidebar.
      </p>

      <div
        className="section"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 1,
          background: "var(--color-border)",
          border: "1px solid var(--color-border)",
        }}
      >
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className="panel"
            style={{
              display: "block",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              width: "100%",
              font: "inherit",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: "var(--color-ink)" }}>
              {role.label}
            </div>
            <div className="text-muted" style={{ lineHeight: 1.5 }}>{role.tagline}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
