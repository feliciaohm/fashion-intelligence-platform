"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ExportCsvButton from "@/components/ExportCsvButton";
import PrintButton from "@/components/PrintButton";
import RelatedPages from "@/components/RelatedPages";
import { DIMENSION_LABELS, DimensionKey, FilterTag } from "@/lib/intelligence";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/ai-demo-questions";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import EmptyState from "@/components/EmptyState";
import AddToDashboardButton from "@/components/AddToDashboardButton";

type DimensionValue = { value: string; label: string };
type Dimensions = Record<DimensionKey, DimensionValue[]>;

const DIMENSION_ORDER: DimensionKey[] = [
  "influencer",
  "product",
  "country",
  "channel",
  "department",
  "time_period",
];

function tagKey(t: FilterTag) {
  return `${t.dimension}:${t.value}`;
}

// Every result table is pulled from a real table that has its own dedicated
// page elsewhere in the platform -- this maps each Command Center result
// module back to the page that "owns" that data, and (where a real per-entity
// detail page exists) how to build that row's specific URL from its columns.
const MODULE_LINKS: Record<string, { href: string; label: string; rowHref?: (row: any) => string | null }> = {
  "Influencer Campaigns": {
    href: "/roi",
    label: "Influencer ROI",
    rowHref: (row) => (row.influencer ? `/influencer/${String(row.influencer).toLowerCase().replace(/\s+/g, "-")}` : null),
  },
  Products: {
    href: "/product-lifecycle",
    label: "Product Lifecycle",
    rowHref: (row) => (row.product_slug ? `/products/${row.product_slug}` : null),
  },
  "Finance by Channel": { href: "/finance-deep", label: "Finance Deep-Dive" },
  "Cost Centers": { href: "/cost-centers", label: "Cost Centers" },
  Customers: { href: "/customers", label: "Customers" },
  "Store Performance": { href: "/stores", label: "Store Performance" },
  "Wholesale Orders": { href: "/wholesale", label: "Wholesale Intelligence" },
  Returns: { href: "/returns", label: "Returns" },
};

export default function IntelligencePage() {
  return (
    <Suspense fallback={<p className="text-muted section">Loading Command Center…</p>}>
      <IntelligencePageInner />
    </Suspense>
  );
}

function IntelligencePageInner() {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterTag[]>([]);
  const [results, setResults] = useState<{ label: string; columns: string[]; rows: any[] }[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [askDemoMode, setAskDemoMode] = useState(false);
  const [askProvider, setAskProvider] = useState<"claude" | "gemini" | "demo-mode" | null>(null);
  const [askStats, setAskStats] = useState<KpiItem[]>([]);
  const [askFilters, setAskFilters] = useState<{ country?: string; product?: string; influencer?: string; quarter?: string }>({});
  // The last question actually submitted (kept even after the search box is
  // cleared) -- lets the answer panel silently re-run itself whenever the
  // active filters change, instead of requiring you to retype and press
  // Enter again just to see the same question re-scoped to a new filter.
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(null);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/intelligence/dimensions")
      .then((res) => res.json())
      .then(setDimensions);
  }, []);

  // Pre-apply a filter handed off from the global header search (?dimension=&value=)
  // or prefill the search box from a free-text query (?q=) once the real
  // dimension values are loaded (needed to resolve the real display label).
  useEffect(() => {
    if (!dimensions) return;
    const dim = searchParams.get("dimension") as DimensionKey | null;
    const val = searchParams.get("value");
    if (dim && val && DIMENSION_ORDER.includes(dim)) {
      const match = dimensions[dim]?.find((v) => v.value === val);
      const tag: FilterTag = { dimension: dim, value: val, label: match?.label ?? val };
      setActiveFilters((prev) => (prev.some((f) => tagKey(f) === tagKey(tag)) ? prev : [...prev, tag]));
    }
    const q = searchParams.get("q");
    if (q) {
      setSearchText(q);
      setShowSuggestions(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (activeFilters.length === 0) {
      setResults(null);
      return;
    }
    setLoadingResults(true);
    fetch("/api/intelligence/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: activeFilters }),
    })
      .then((res) => res.json())
      .then((json) => setResults(json.results ?? []))
      .finally(() => setLoadingResults(false));
  }, [activeFilters]);

  const suggestions: FilterTag[] = useMemo(() => {
    if (!dimensions || searchText.trim().length === 0) return [];
    const q = searchText.trim().toLowerCase();
    const matches: FilterTag[] = [];
    for (const dim of DIMENSION_ORDER) {
      for (const v of dimensions[dim]) {
        if (v.label.toLowerCase().includes(q)) {
          matches.push({ dimension: dim, value: v.value, label: v.label });
        }
      }
    }
    return matches.slice(0, 8);
  }, [dimensions, searchText]);

  // Question autocomplete: only considered once no filter-value match exists
  // (a real influencer/product/country name always wins first). Shows the
  // FULL list of all 10 real questions the moment there's no keyword match,
  // not a filtered subset -- there are only 10 total, so browsing the whole
  // list is more useful than guessing which words will surface which
  // question, and it's what was explicitly asked for over narrowing to
  // partial-word matches only.
  const questionSuggestions = useMemo(() => {
    if (!searchText.trim() || suggestions.length > 0) return [];
    return DEMO_EXAMPLE_QUESTIONS;
  }, [searchText, suggestions]);

  function addFilter(tag: FilterTag) {
    setActiveFilters((prev) => (prev.some((f) => tagKey(f) === tagKey(tag)) ? prev : [...prev, tag]));
    setSearchText("");
    setShowSuggestions(false);
  }

  function removeFilter(tag: FilterTag) {
    setActiveFilters((prev) => prev.filter((f) => tagKey(f) !== tagKey(tag)));
  }

  async function runAiQuestion(question: string) {
    if (!question.trim()) return;
    setAskLoading(true);
    setAskAnswer(null);
    setAskError(null);
    setAskDemoMode(false);
    setAskProvider(null);
    setAskStats([]);
    setLastAskedQuestion(question);
    // Four dimensions thread through -- the ones the AI engine can honestly
    // act on today (see AiFilters in lib/ai-demo-mode.ts for exactly which
    // metrics each one applies to, and why "store" and a separate
    // "campaign" don't exist as real filters). "time_period" here is a
    // quarter (e.g. "Q2 2026"), the real "date span" filter.
    const country = activeFilters.find((f) => f.dimension === "country")?.value;
    const product = activeFilters.find((f) => f.dimension === "product")?.value;
    const influencer = activeFilters.find((f) => f.dimension === "influencer")?.value;
    const quarter = activeFilters.find((f) => f.dimension === "time_period")?.value;
    setAskFilters({ country, product, influencer, quarter });
    try {
      const res = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, filters: { country, product, influencer, quarter } }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAskError(json.details || json.error || "Something went wrong");
      } else {
        setAskAnswer(json.answer);
        setAskDemoMode(Boolean(json.demoMode));
        setAskProvider(json.provider === "claude" || json.provider === "gemini" || json.provider === "demo-mode" ? json.provider : null);
        setAskStats(Array.isArray(json.stats) ? json.stats.map((s: { label: string; value: string }) => ({ label: s.label, value: s.value })) : []);
      }
    } catch (e) {
      setAskError(String(e));
    } finally {
      setAskLoading(false);
      setSearchText("");
      setShowSuggestions(false);
    }
  }

  // Real-time re-ask: whenever the active filters change (drag/click a chip
  // in, or remove one), silently re-run whatever AI question was last asked
  // with the new filters -- no retyping, no pressing Enter again. The
  // filter-palette table results below already did this (see the
  // useEffect keyed on activeFilters above); this is the same behavior for
  // the AI answer panel specifically. Guarded on lastAskedQuestion so this
  // never fires before any question has actually been asked.
  useEffect(() => {
    if (!lastAskedQuestion) return;
    runAiQuestion(lastAskedQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const exact = suggestions.find((s) => s.label.toLowerCase() === searchText.trim().toLowerCase());
    if (exact) {
      addFilter(exact);
    } else if (searchText.trim()) {
      runAiQuestion(searchText.trim());
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    try {
      addFilter(JSON.parse(data));
    } catch {
      // ignore malformed drag payloads
    }
  }

  const activeFilterSummary = activeFilters.map((f) => f.label).join(" + ");

  const totalMatchingRows = results?.reduce((s, r) => s + r.rows.length, 0) ?? 0;
  const topModule = results && results.length > 0 ? [...results].sort((a, b) => b.rows.length - a.rows.length)[0] : null;

  const kpis: KpiItem[] = dimensions
    ? [
        { label: "Influencers Tracked", value: `${dimensions.influencer?.length ?? 0}`, delta: "in the filter palette", direction: "neutral" },
        { label: "Products Tracked", value: `${dimensions.product?.length ?? 0}`, delta: "in the filter palette", direction: "neutral" },
        { label: "Countries Tracked", value: `${dimensions.country?.length ?? 0}`, delta: "in the filter palette", direction: "neutral" },
      ]
    : [];

  const headline = topModule
    ? `${activeFilterSummary} matches ${totalMatchingRows} row${totalMatchingRows === 1 ? "" : "s"} across ${results!.length} module${results!.length === 1 ? "" : "s"} — ${topModule.label} has the most, at ${topModule.rows.length}.`
    : dimensions
    ? `Search or filter across ${dimensions.influencer?.length ?? 0} influencers, ${dimensions.product?.length ?? 0} products, and ${dimensions.country?.length ?? 0} countries — results pull live from 8 modules at once.`
    : "Loading real values from BigQuery…";

  const insightBoxText = topModule
    ? `${topModule.label} is the module most affected by the current filter — see the table below, or open it directly for the full unfiltered view.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Command Center</div>
      <div className="page-meta no-print">
        <span>Command Center</span>
        <PrintButton />
      </div>
      <h1 className="page-title">Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section no-print" ref={searchBoxRef} style={{ position: "relative", maxWidth: 640 }}>
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search influencers, products, countries, channels, departments, quarters — or ask a question"
            style={{ width: "100%" }}
          />
        </form>

        {showSuggestions && suggestions.length > 0 && (
          <div
            className="panel"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 20,
              padding: 6,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {suggestions.map((s) => (
              <div
                key={tagKey(s)}
                onClick={() => addFilter(s)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>{s.label}</span>
                <span className="text-muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {DIMENSION_LABELS[s.dimension]}
                </span>
              </div>
            ))}
          </div>
        )}

        {searchText.trim() && suggestions.length === 0 && questionSuggestions.length > 0 && (
          <div
            className="panel"
            style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, padding: 6 }}
          >
            <div className="text-muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 10px" }}>
              All questions I can answer — click one
            </div>
            {questionSuggestions.map((q) => (
              <div
                key={q}
                onClick={() => runAiQuestion(q)}
                style={{ padding: "8px 10px", cursor: "pointer", fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {q}
              </div>
            ))}
          </div>
        )}

        {searchText.trim() && suggestions.length === 0 && questionSuggestions.length === 0 && (
          <p className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
            No matching keyword — press Enter to ask this as a question instead.
          </p>
        )}

        {!askLoading && !askAnswer && !askError && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span className="text-muted" style={{ fontSize: 11, alignSelf: "center", marginRight: 2 }}>
              Try asking:
            </span>
            {DEMO_EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setSearchText(q);
                  setShowSuggestions(false);
                  runAiQuestion(q);
                }}
                className="chip-button"
                style={{
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "inherit",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {(askLoading || askAnswer || askError) && (
        <div className="section">
          {askLoading && <p className="text-muted">Querying BigQuery + Claude…</p>}
          {askError && (
            <div className="panel" style={{ borderColor: "var(--status-critical)" }}>
              <p style={{ color: "var(--status-critical)", fontWeight: 600, marginBottom: 4 }}>
                AI query unavailable
              </p>
              <p className="text-muted">{askError}</p>
            </div>
          )}
          {askAnswer && (
            <div className="panel">
              <div className="stat-label" style={{ marginBottom: 8 }}>
                Answer ·{" "}
                {askProvider === "gemini"
                  ? "AI-generated (Gemini — free tier)"
                  : askProvider === "claude"
                  ? "AI-generated (Claude)"
                  : "Demo Mode — real data, rule-based"}
              </div>
              {(askFilters.country || askFilters.product || askFilters.influencer || askFilters.quarter) && (
                <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  Filtered to: {[askFilters.influencer, askFilters.product, askFilters.country, askFilters.quarter].filter(Boolean).join(" · ")}
                </p>
              )}
              {askStats.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <KpiStrip items={askStats} />
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{askAnswer}</div>
              {askStats.length > 0 && lastAskedQuestion && (
                <div style={{ marginTop: 12 }}>
                  <AddToDashboardButton
                    title={lastAskedQuestion}
                    sourceQuestion={lastAskedQuestion}
                    stats={askStats.map((s) => ({ label: s.label, value: s.value }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="section no-print">
        <h2 className="section-title">Filter Palette</h2>
        <p className="section-subtitle">Click, or drag into the zone below</p>

        {dimensions ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {DIMENSION_ORDER.map((dim) => (
              <div key={dim}>
                <div className="stat-label" style={{ marginBottom: 6 }}>{DIMENSION_LABELS[dim]}</div>
                <div className="pill-row">
                  {dimensions[dim].map((v) => {
                    const tag: FilterTag = { dimension: dim, value: v.value, label: v.label };
                    const active = activeFilters.some((f) => tagKey(f) === tagKey(tag));
                    return (
                      <div
                        key={v.value}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(tag))}
                        onClick={() => (active ? removeFilter(tag) : addFilter(tag))}
                        className="badge"
                        style={{
                          cursor: "grab",
                          borderColor: active ? "var(--color-accent)" : undefined,
                          color: active ? "var(--color-accent)" : undefined,
                          background: active ? "var(--color-accent-soft)" : undefined,
                        }}
                      >
                        {v.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">Loading real values from BigQuery…</p>
        )}
      </div>

      <div className="section no-print">
        <h2 className="section-title">Filter Zone</h2>
        <p className="section-subtitle">
          Multiple values in the same category combine with OR (Sweden + China = either market).
          Different categories combine with AND (Sweden + Q2 2026 = both).
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="panel"
          style={{
            minHeight: 84,
            border: "2px dashed var(--color-border-strong)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-start",
            alignContent: "flex-start",
          }}
        >
          {activeFilters.length === 0 ? (
            <p className="text-muted" style={{ margin: "auto" }}>
              Drop a filter chip here, or click one above
            </p>
          ) : (
            <>
              {activeFilters.map((f) => (
                <div
                  key={tagKey(f)}
                  className="badge"
                  style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)", display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span className="text-muted" style={{ fontSize: 9, textTransform: "uppercase" }}>
                    {DIMENSION_LABELS[f.dimension]}
                  </span>
                  {f.label}
                  <span
                    onClick={() => removeFilter(f)}
                    style={{ cursor: "pointer", fontWeight: 700 }}
                  >
                    ×
                  </span>
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => setActiveFilters([])}>
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <p className="text-muted section" style={{ marginBottom: -24 }}>
          Active filters: {activeFilterSummary}
        </p>
      )}

      <div className="section">
        <h2 className="section-title">Results</h2>
        {activeFilters.length === 0 && (
          <p className="section-subtitle">Add a filter above to see results across every module.</p>
        )}
        {loadingResults && <p className="text-muted">Querying every module…</p>}
      </div>

      {results && results.length === 0 && activeFilters.length > 0 && !loadingResults && (
        <EmptyState
          label="No Results"
          message="Try removing a filter or broadening your search — no module has data matching this combination."
        />
      )}

      {results?.map((r) => {
        const moduleLink = MODULE_LINKS[r.label];
        return (
        <div key={r.label}>
          <div className="section" style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div>
              <h3 className="section-title" style={{ fontSize: 13 }}>{r.label}</h3>
              <p className="section-subtitle">{r.rows.length} matching row{r.rows.length === 1 ? "" : "s"}</p>
            </div>
            {moduleLink && (
              <Link href={moduleLink.href} className="text-muted no-print" style={{ fontSize: 12, textDecoration: "underline", flexShrink: 0 }}>
                Open {moduleLink.label} →
              </Link>
            )}
          </div>

          {r.rows.length > 0 ? (
            <>
              <div className="data-table-toolbar no-print">
                <ExportCsvButton data={r.rows} filename={`intelligence-${r.label.toLowerCase().replace(/\s+/g, "-")}.csv`} />
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {r.columns.map((c) => (
                        <th key={c}>{c.replace(/_/g, " ")}</th>
                      ))}
                      {moduleLink?.rowHref && <th className="no-print"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((row, i) => {
                      const rowHref = moduleLink?.rowHref?.(row) ?? null;
                      return (
                        <tr key={i}>
                          {r.columns.map((c) => {
                            const v = row[c];
                            const display = v && typeof v === "object" && "value" in v ? v.value : v;
                            return <td key={c}>{display === null || display === undefined ? "—" : String(display)}</td>;
                          })}
                          {moduleLink?.rowHref && (
                            <td className="no-print">
                              {rowHref ? (
                                <Link href={rowHref} className="text-muted" style={{ textDecoration: "underline", fontSize: 12 }}>
                                  View →
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, color: "var(--color-accent)" }}>
                No Results
              </span>{" "}
              · No rows in this module for the current filters — try removing one filter or broadening your search.
            </p>
          )}
        </div>
        );
      })}

      {topModule && (
        <>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}

      <RelatedPages hrefs={["/explore", "/executive", "/decision-intelligence"]} />
    </div>
  );
}
