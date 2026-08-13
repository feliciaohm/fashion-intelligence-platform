"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ExportCsvButton from "@/components/ExportCsvButton";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

// Auto-poll interval for the "near real time" behavior: every edit made in
// the connected Google Sheets is visible here within this many seconds,
// without needing a manual re-import. This is real polling against Google's
// live CSV export, not a push subscription -- said explicitly in the UI
// below rather than implied.
const AUTO_REFRESH_SECONDS = 60;

interface GiftRoiRow {
  gift: { giftId: string; influencer: string; productName: string; cost: number; dateGifted: string; notes: string | null };
  posted: boolean;
  matchedPosts: { postId: string; influencer: string; datePosted: string; timePosted: string | null; postType: string | null; platform: string | null }[];
  productSlug: string | null;
  visitorsInWindow: number | null;
  visitorsWhoPurchased: number | null;
  attributedRevenue: number | null;
  roiPct: number | null;
  note: string | null;
}

function SheetImportForm({
  label,
  endpoint,
  hint,
  connected,
  onImported,
}: {
  label: string;
  endpoint: string;
  hint: string;
  connected: boolean;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setMsg(`Imported ${json.rowCount} rows${json.skipped ? ` (${json.skipped} skipped — missing required columns)` : ""}`);
      setSheetUrl("");
      onImported();
    } catch (err) {
      setMsg(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
        <span className="badge" style={{ borderColor: connected ? "var(--status-good)" : "var(--color-ink-muted)", color: connected ? "var(--status-good)" : "var(--color-ink-muted)" }}>
          {connected ? "connected" : "not connected"}
        </span>
      </div>
      <p className="text-muted" style={{ marginBottom: 10 }}>{hint}</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          required
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Importing…" : connected ? "Re-import" : "Import"}
        </button>
      </form>
      {msg && <p className="text-muted" style={{ marginTop: 8, fontSize: 12 }}>{msg}</p>}
    </div>
  );
}

export default function GiftingRoiPage() {
  const [rows, setRows] = useState<GiftRoiRow[] | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [connected, setConnected] = useState({ gifts: false, posts: false });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/gifting/roi");
    const json = await res.json();
    if (res.ok) {
      setRows(json.rows);
      setWindowDays(json.windowDays);
      setConnected(json.connected);
      setLastRefreshed(new Date());
    }
  }, []);

  const refreshFromSheets = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/gifting/refresh", { method: "POST" });
    } catch {
      // ignore -- load() below still shows whatever BigQuery currently has
    }
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-poll: re-pulls both connected Google Sheets on an interval so a row
  // typed into the sheet shows up here without a manual click. Only starts
  // once at least one sheet is connected.
  useEffect(() => {
    if (!connected.gifts && !connected.posts) return;
    pollRef.current = setInterval(refreshFromSheets, AUTO_REFRESH_SECONDS * 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connected.gifts, connected.posts, refreshFromSheets]);

  const posted = (rows ?? []).filter((r) => r.posted);
  const withRoi = (rows ?? []).filter((r) => r.roiPct !== null);
  const totalCost = (rows ?? []).reduce((s, r) => s + r.gift.cost, 0);
  const totalRevenue = (rows ?? []).reduce((s, r) => s + (r.attributedRevenue ?? 0), 0);
  const blendedRoi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : null;
  const postedPct = rows && rows.length ? (posted.length / rows.length) * 100 : 0;

  const kpis: KpiItem[] = rows
    ? [
        { label: "Gifts Logged", value: `${rows.length}`, delta: `${totalCost.toLocaleString()} total cost`, direction: "neutral" },
        { label: "Actually Posted", value: `${postedPct.toFixed(0)}%`, delta: `${posted.length} of ${rows.length} gifts`, direction: postedPct >= 50 ? "good" : "critical" },
        {
          label: "Blended ROI",
          value: blendedRoi !== null ? `${blendedRoi.toFixed(0)}%` : "n/a",
          delta: withRoi.length ? `across ${withRoi.length} gift(s) with real matched visitor data` : "no matched visitor data yet",
          direction: blendedRoi !== null ? (blendedRoi >= 0 ? "good" : "critical") : "neutral",
        },
      ]
    : [];

  const headline = rows
    ? rows.length === 0
      ? "No gifts logged yet — connect your Gifting Log sheet below to get started."
      : `${rows.length} gifts logged, ${posted.length} confirmed posted (${postedPct.toFixed(0)}%)${
          blendedRoi !== null ? `, blended ROI ${blendedRoi.toFixed(0)}% on the gifts with real matched visitor data` : ""
        }.`
    : "Loading…";

  const csvRows = (rows ?? []).map((r) => ({
    influencer: r.gift.influencer,
    product: r.gift.productName,
    cost: r.gift.cost,
    date_gifted: r.gift.dateGifted,
    posted: r.posted,
    matched_posts: r.matchedPosts.map((p) => p.datePosted).join("; "),
    product_matched: r.productSlug ?? "no match",
    visitors_in_window: r.visitorsInWindow,
    visitors_purchased: r.visitorsWhoPurchased,
    attributed_revenue: r.attributedRevenue,
    roi_pct: r.roiPct,
    note: r.note,
  }));

  return (
    <div>
      <div className="page-eyebrow">Marketing · Gifting ROI</div>
      <h1 className="page-title">Gifting ROI</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {rows && <KpiStrip items={kpis} />}

      <div className="section">
        <h2 className="section-title">How this works</h2>
        <p className="section-subtitle">
          Two Google Sheets tabs — one for who was gifted what, one for who actually posted — are cross-matched by
          influencer name. A gift counts as &quot;posted&quot; when that influencer has a real post within{" "}
          {windowDays} days on or after the gift date. When a post is matched, the product name is resolved against
          the real product catalog and the same timing-only Visitor Journey attribution used elsewhere on this
          platform measures real visitor lift and revenue in the hours after that post — never a links or discount
          codes involved.
        </p>
        <p className="section-subtitle" style={{ marginTop: 4 }}>
          Both sheets are polled automatically every {AUTO_REFRESH_SECONDS} seconds once connected, so a new row
          typed into either sheet shows up here without re-importing by hand. That&apos;s real polling against
          Google&apos;s live sheet, not an instant push — the &quot;Refresh Now&quot; button below forces an
          immediate check.
        </p>
      </div>

      <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <SheetImportForm
          label="Gifting Log"
          endpoint="/api/gifting/import-gifts"
          hint="Columns: Influencer, Product, Cost, Date Gifted (optionally Notes)."
          connected={connected.gifts}
          onImported={load}
        />
        <SheetImportForm
          label="Posting Log"
          endpoint="/api/gifting/import-posts"
          hint="Columns: Influencer, Date Posted (optionally Time Posted, Post Type, Platform)."
          connected={connected.posts}
          onImported={load}
        />
      </div>

      <div className="section">
        <div className="data-table-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn-ghost" onClick={refreshFromSheets} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh Now"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastRefreshed && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                Last checked {formatTimestamp(lastRefreshed)}
              </span>
            )}
            <ExportCsvButton data={csvRows} filename="gifting-roi.csv" />
          </div>
        </div>

        {rows && rows.length === 0 ? (
          <EmptyState label="No gifts yet" message="Connect the Gifting Log sheet above to see cross-matched ROI here." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Influencer</th>
                  <th>Product</th>
                  <th>Cost</th>
                  <th>Date Gifted</th>
                  <th>Posted?</th>
                  <th>Matched Post(s)</th>
                  <th>Visitors in Window</th>
                  <th>Purchased</th>
                  <th>Attributed Revenue</th>
                  <th>ROI</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.gift.giftId}>
                    <td>{r.gift.influencer}</td>
                    <td>{r.gift.productName}</td>
                    <td>{r.gift.cost.toLocaleString()}</td>
                    <td>{r.gift.dateGifted}</td>
                    <td>{r.posted ? "Yes" : "No"}</td>
                    <td>{r.matchedPosts.map((p) => p.datePosted).join(", ") || "—"}</td>
                    <td>{r.visitorsInWindow ?? "—"}</td>
                    <td>{r.visitorsWhoPurchased ?? "—"}</td>
                    <td>{r.attributedRevenue !== null ? r.attributedRevenue.toLocaleString() : "—"}</td>
                    <td>{r.roiPct !== null ? `${r.roiPct}%` : "—"}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{r.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows && rows.length > 0 && (
        <DocInsightBox>
          {blendedRoi !== null
            ? `${withRoi.length} of ${rows.length} gifts have real matched visitor data — blended ROI across those is ${blendedRoi.toFixed(0)}%. The rest are either unposted, or the product name didn't match the catalog.`
            : `No gift yet has both a matched post and a matched product, so no real ROI can be shown — check the Note column on each row for why.`}
        </DocInsightBox>
      )}
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/visitor-journey", "/roi", "/settings"]} />
    </div>
  );
}
