"use client";

export default function PrintButton({ label = "Export PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-ghost" onClick={() => window.print()}>
      {label}
    </button>
  );
}
