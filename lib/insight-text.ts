// Client-safe, server-safe pure function -- kept separate from
// components/CopyInsightButton.tsx because that file is "use client",
// and Next.js can't call a function exported from a client module inside a
// server component (only render it as a component or pass it as a prop).

// Template fixed by design brief: "[METRIC] is [VALUE], [X]% [above/below]
// [benchmark/last period], driven by [primary driver]. Recommended action:
// [one sentence]."
export function buildInsightText({
  metric,
  value,
  comparisonPct,
  direction,
  comparisonLabel,
  driver,
  action,
}: {
  metric: string;
  value: string;
  comparisonPct: number;
  direction: "above" | "below";
  comparisonLabel: string;
  driver: string;
  action: string;
}): string {
  const pct = Math.abs(comparisonPct).toFixed(1);
  return `${metric} is ${value}, ${pct}% ${direction} ${comparisonLabel}, driven by ${driver}. Recommended action: ${action}.`;
}
