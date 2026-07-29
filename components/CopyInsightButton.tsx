"use client";

import { useState } from "react";

export default function CopyInsightButton({ text, label = "Copy insight" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fails silently on non-secure contexts -- text stays visible/selectable.
    }
  }

  return (
    <button type="button" className="btn-ghost" onClick={handleCopy} style={{ fontSize: 12 }}>
      {copied ? "Copied ✓" : label}
    </button>
  );
}
