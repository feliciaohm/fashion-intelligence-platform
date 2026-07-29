"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DIMENSION_LABELS, DimensionKey, FilterTag } from "@/lib/intelligence";

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

// Same suggestion source and matching logic as the Command Center's own
// search box (app/intelligence/page.tsx) -- kept as a separate, small
// component rather than sharing state, since this one only ever does one
// thing: pick a value, then hand off to /intelligence via a URL param.
export default function GlobalSearch() {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [searchText, setSearchText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focused && !dimensions) {
      fetch("/api/intelligence/dimensions")
        .then((res) => res.json())
        .then(setDimensions);
    }
  }, [focused, dimensions]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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

  function reset() {
    setSearchText("");
    setFocused(false);
    inputRef.current?.blur();
  }

  function goToFilter(tag: FilterTag) {
    router.push(`/intelligence?dimension=${encodeURIComponent(tag.dimension)}&value=${encodeURIComponent(tag.value)}`);
    reset();
  }

  // Pure submit logic, independent of any particular event type -- called
  // from both the form's onSubmit (mouse/native Enter) and the input's own
  // onKeyDown (explicit Enter check), so it doesn't depend on the browser's
  // native "Enter submits the form" behavior firing correctly.
  function submitSearch() {
    const exact = suggestions.find((s) => s.label.toLowerCase() === searchText.trim().toLowerCase());
    if (exact) {
      goToFilter(exact);
    } else if (searchText.trim()) {
      router.push(`/intelligence?q=${encodeURIComponent(searchText.trim())}`);
      reset();
    }
  }

  return (
    <div ref={boxRef} className={`global-search no-print${focused ? " expanded" : ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <svg className="global-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="11.2" y1="11.2" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitSearch();
            } else if (e.key === "Escape") {
              reset();
            }
          }}
          placeholder="Search the platform…"
          className="global-search-input"
        />
      </form>

      {focused && searchText.trim() && (
        <div className="global-search-suggestions">
          {suggestions.length > 0 ? (
            suggestions.map((s) => (
              <div key={`${s.dimension}:${s.value}`} onClick={() => goToFilter(s)} className="global-search-suggestion-row">
                <span>{s.label}</span>
                <span className="text-muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {DIMENSION_LABELS[s.dimension]}
                </span>
              </div>
            ))
          ) : (
            <div className="global-search-suggestion-row" style={{ cursor: "default" }}>
              <span className="text-muted">No matching keyword — press Enter to search in Command Center</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
