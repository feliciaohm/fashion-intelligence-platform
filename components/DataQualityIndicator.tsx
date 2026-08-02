import Link from "next/link";

// Dropped onto any page or calculator that does a real aggregation, so the
// number on screen always comes with its own provenance line instead of
// silently trusting every row equally -- see /data-quality for the checks
// this count reflects (duplicates, nulls, and outliers already excluded
// upstream of whatever `dataPoints`/`excluded` this instance was given).
export default function DataQualityIndicator({
  dataPoints,
  excluded = 0,
}: {
  dataPoints: number;
  excluded?: number;
}) {
  return (
    <p className="dq-indicator no-print">
      This calculation uses {dataPoints.toLocaleString()} data point{dataPoints === 1 ? "" : "s"}.
      {excluded > 0 ? ` ${excluded.toLocaleString()} were excluded.` : ""}{" "}
      <Link href="/data-quality">See data quality report</Link>.
    </p>
  );
}
