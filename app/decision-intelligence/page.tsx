"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CopyInsightButton from "@/components/CopyInsightButton";
import RelatedPages from "@/components/RelatedPages";
import { buildInsightText } from "@/lib/insight-text";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";
import DataQualityIndicator from "@/components/DataQualityIndicator";
import EmptyState from "@/components/EmptyState";
import type { MetricStatus, QuickMetric } from "@/lib/quick-metrics-server";

function toDirection(status: MetricStatus): "good" | "critical" | "neutral" {
  if (status === "good") return "good";
  if (status === "critical") return "critical";
  return "neutral";
}

const CATEGORIES = ["bags", "dresses", "knitwear", "outerwear", "tops"];

function Methodology({ lines }: { lines: string[] }) {
  return (
    <details className="section" style={{ marginTop: 20 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-ink-muted)",
        }}
      >
        Methodology — how this number was calculated
      </summary>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((line, i) => (
          <p key={i} className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            {line}
          </p>
        ))}
      </div>
    </details>
  );
}

function Histogram({ bins }: { bins: { binStart: number; binEnd: number; count: number }[] }) {
  const width = 640;
  const height = 140;
  const gap = 2;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const barWidth = (width - (bins.length - 1) * gap) / bins.length;
  const fmt = (v: number) => `€${(v / 1_000_000).toFixed(1)}M`;

  return (
    <svg viewBox={`0 0 ${width} ${height + 22}`} style={{ width: "100%", height: "auto" }}>
      {bins.map((b, i) => {
        const barHeight = (b.count / maxCount) * height;
        const x = i * (barWidth + gap);
        return (
          <rect
            key={i}
            x={x}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="var(--color-accent)"
            opacity={0.85}
          />
        );
      })}
      <line x1={0} y1={height} x2={width} y2={height} stroke="var(--color-border, #ddd)" strokeWidth={1} />
      <text x={0} y={height + 16} fontSize={10} fill="var(--color-ink-muted, #8b8578)">
        {fmt(bins[0]?.binStart ?? 0)}
      </text>
      <text x={width} y={height + 16} fontSize={10} textAnchor="end" fill="var(--color-ink-muted, #8b8578)">
        {fmt(bins[bins.length - 1]?.binEnd ?? 0)}
      </text>
    </svg>
  );
}

function StoreViabilityCalculator() {
  const [city, setCity] = useState("");
  const [rent, setRent] = useState("15000");
  const [staffCount, setStaffCount] = useState("6");
  const [customerProfile, setCustomerProfile] = useState("broad");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/store-viability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, rent: Number(rent), staffCount: Number(staffCount), customerProfile }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>1. New Store Viability Calculator</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Break-even timeline, Year 1–3 revenue, profitability odds, and online cannibalization risk — projected from Maison Lumière&apos;s own comparable stores.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Berlin" required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Est. monthly rent (€)</label>
            <input type="number" value={rent} onChange={(e) => setRent(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Staff count</label>
            <input type="number" value={staffCount} onChange={(e) => setStaffCount(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Customer profile</label>
            <select value={customerProfile} onChange={(e) => setCustomerProfile(e.target.value)} style={{ width: "100%" }}>
              <option value="broad">Broad market</option>
              <option value="vip">VIP-focused</option>
              <option value="new_to_brand">New-to-brand</option>
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter a city, rent, staff count, and customer profile, then calculate to see results.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Year 1 Revenue</div>
                  <div className="stat-value">€{result.projectedYear1Revenue.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Year 3 Revenue</div>
                  <div className="stat-value">€{result.projectedYear3Revenue.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Break-Even</div>
                  <div className="stat-value">{result.breakEvenMonths ? `${result.breakEvenMonths} mo` : "—"}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Profitability Odds</div>
                  <div className={`stat-value ${result.profitabilityOdds.pct >= 50 ? "good" : "critical"}`}>
                    {result.profitabilityOdds.pct}%
                  </div>
                </div>
              </div>
              <p className="text-muted" style={{ marginTop: 14 }}>
                Cannibalization risk:{" "}
                {result.cannibalization.available
                  ? `~€${result.cannibalization.estimatedAnnualImpact.toLocaleString()}/year shifted from existing online sales in ${city}`
                  : result.cannibalization.reason}
              </p>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function CollabRoiCalculator({ countries }: { countries: string[] }) {
  const [collaborator, setCollaborator] = useState("");
  const [cost, setCost] = useState("4000");
  const [targetMarket, setTargetMarket] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!targetMarket && countries.length > 0) setTargetMarket(countries[0]);
  }, [countries, targetMarket]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/collab-roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborator, cost: Number(cost), targetMarket, category }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>2. Collaboration ROI Predictor</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Projected revenue, halo effect on adjacent products, and recommended attribution window — from historical comparable campaigns.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Influencer / collab name</label>
            <input type="text" value={collaborator} onChange={(e) => setCollaborator(e.target.value)} placeholder="e.g. Influencer Q" required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Est. gifting/fee cost (€)</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Target market</label>
            <select value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} style={{ width: "100%" }}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Product category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter a collaborator, cost, market, and category, then calculate to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Projected Revenue</div>
                <div className="stat-value">€{result.projectedRevenue.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Projected ROI</div>
                <div className={`stat-value ${result.projectedRoiPct >= 0 ? "good" : "critical"}`}>{result.projectedRoiPct}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Halo Revenue</div>
                <div className="stat-value">€{result.projectedHaloRevenue.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Attribution Window</div>
                <div className="stat-value">{result.recommendedWindowDays ? `${result.recommendedWindowDays}d` : "—"}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function PriceElasticityCalculator() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priceChangePct, setPriceChangePct] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/price-elasticity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, priceChangePct: Number(priceChangePct) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>3. Price Elasticity Tool</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Projected impact on units, revenue, and gross margin from a proposed price change, by category.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Product category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Proposed price change (%)</label>
            <input type="number" value={priceChangePct} onChange={(e) => setPriceChangePct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Choose a category and price change, then calculate to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Projected Units</div>
                <div className="stat-value">{result.projected.units.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Projected Revenue</div>
                <div className={`stat-value ${result.revenueChangePct >= 0 ? "good" : "critical"}`}>
                  €{result.projected.revenue.toLocaleString()} ({result.revenueChangePct >= 0 ? "+" : ""}{result.revenueChangePct}%)
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Projected Gross Margin</div>
                <div className={`stat-value ${result.marginChangePct >= 0 ? "good" : "critical"}`}>
                  €{result.projected.grossMargin.toLocaleString()} ({result.marginChangePct >= 0 ? "+" : ""}{result.marginChangePct}%)
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Elasticity Used</div>
                <div className="stat-value">{result.elasticity}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function MarketExpansionCalculator({ countries }: { countries: string[] }) {
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!country && countries.length > 0) setCountry(countries[0]);
  }, [countries, country]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/market-expansion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  const strategyLabel: Record<string, string> = {
    online_first: "Online First",
    wholesale_first: "Wholesale First",
    retail_first: "Retail First",
  };

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>4. Market Expansion Analyzer</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Real traffic, customer, and influencer signals for a market, with a recommended entry strategy and timeline.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Target country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%" }}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Choose a target country, then analyze to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Customers</div>
                <div className="stat-value">{result.customerCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Influencers</div>
                <div className="stat-value">{result.influencerCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Recommended Strategy</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{strategyLabel[result.recommendedStrategy]}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Timeline</div>
                <div className="stat-value" style={{ fontSize: 13 }}>{result.timeline.split(" — ")[0]}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function MonteCarloForecastCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/monte-carlo-forecast");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>5. Monte Carlo Revenue Forecast</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        A Monte Carlo simulation runs 10,000 randomized versions of next quarter, each built from Maison
        Lumière&apos;s own real recent month-to-month growth and volatility, to show a realistic range of
        outcomes instead of a single guess. It&apos;s useful for setting expectations with the board and
        stress-testing plans against a genuine downside case, not just a base case.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Running 10,000 simulations…" : "Run Simulation"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the simulation to see the real forecast distribution.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">P10 (downside)</div>
                  <div className="stat-value critical">€{result.percentiles.p10.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">P25</div>
                  <div className="stat-value">€{result.percentiles.p25.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">P50 (median)</div>
                  <div className="stat-value good">€{result.percentiles.p50.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">P75</div>
                  <div className="stat-value">€{result.percentiles.p75.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">P90 (upside)</div>
                  <div className="stat-value good">€{result.percentiles.p90.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <CopyInsightButton
                  text={buildInsightText({
                    metric: "Median 3-month revenue forecast",
                    value: `€${result.percentiles.p50.toLocaleString()}`,
                    comparisonPct: result.percentiles.p10 ? ((result.percentiles.p50 - result.percentiles.p10) / result.percentiles.p10) * 100 : 0,
                    direction: "above",
                    comparisonLabel: `the P10 downside case (€${result.percentiles.p10.toLocaleString()})`,
                    driver: `${result.simulations.toLocaleString()} Monte Carlo simulations built from Maison Lumière's own real recent growth and volatility`,
                    action: "Plan budgets against the P25–P50 range and stress-test commitments against the P10 downside",
                  })}
                />
              </div>

              <p style={{ marginTop: 14 }}>
                There is an 80% probability that total revenue across the next 3 months (
                {result.forecastMonths.join(", ")}) lands between €{result.percentiles.p10.toLocaleString()} and €
                {result.percentiles.p90.toLocaleString()}. The median (most likely) outcome is €
                {result.percentiles.p50.toLocaleString()}. The downside scenario (bottom 10% of simulations) falls
                below €{result.percentiles.p10.toLocaleString()}; the upside scenario (top 10%) exceeds €
                {result.percentiles.p90.toLocaleString()}.
              </p>

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--color-ink-muted)",
                    marginBottom: 8,
                  }}
                >
                  Distribution of {result.simulations.toLocaleString()} simulated outcomes
                </div>
                <Histogram bins={result.histogram} />
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function CampaignImpactCalculator({ countries }: { countries: string[] }) {
  const [treatmentCountry, setTreatmentCountry] = useState("");
  const [controlCountry, setControlCountry] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState("2026-07-15");
  const [windowDays, setWindowDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!treatmentCountry && countries.length > 0) setTreatmentCountry(countries[0]);
    if (!controlCountry && countries.length > 1) setControlCountry(countries[1]);
  }, [countries, treatmentCountry, controlCountry]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/campaign-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatmentCountry, controlCountry, campaignStartDate, windowDays: Number(windowDays) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>
        6. Difference-in-Differences Campaign Analyzer
      </h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        This isolates a campaign&apos;s true effect from ordinary seasonal ups and downs by comparing the
        treatment market&apos;s change against a similar market that didn&apos;t run the campaign. It&apos;s
        the standard method strategy consultants use to separate &quot;the campaign worked&quot; from &quot;the
        whole category was up that month.&quot;
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Treatment country</label>
            <select value={treatmentCountry} onChange={(e) => setTreatmentCountry(e.target.value)} style={{ width: "100%" }}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Control country</label>
            <select value={controlCountry} onChange={(e) => setControlCountry(e.target.value)} style={{ width: "100%" }}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Campaign start date</label>
            <input
              type="date"
              value={campaignStartDate}
              onChange={(e) => setCampaignStartDate(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Measurement window</label>
            <select value={windowDays} onChange={(e) => setWindowDays(e.target.value)} style={{ width: "100%" }}>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Analyze"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Pick a treatment/control country pair and campaign date, then analyze to see results.</p>}
          {result && (
            <>
              {result.lowConfidence && (
                <p style={{ color: "var(--status-critical)", fontSize: 12.5, marginBottom: 14 }}>
                  ⚠ Small sample warning: the smallest of the four groups has only{" "}
                  {Math.min(
                    result.sampleSizes.treatmentBefore,
                    result.sampleSizes.treatmentAfter,
                    result.sampleSizes.controlBefore,
                    result.sampleSizes.controlAfter
                  )}{" "}
                  order(s) — treat this result as directional, not a precise estimate.
                </p>
              )}

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{treatmentCountry} (treatment)</td>
                      <td>€{result.treatment.before.revenue.toLocaleString()} ({result.treatment.before.n} orders)</td>
                      <td>€{result.treatment.after.revenue.toLocaleString()} ({result.treatment.after.n} orders)</td>
                      <td>
                        {result.pctChangeTreatment !== null
                          ? `${result.pctChangeTreatment >= 0 ? "+" : ""}${result.pctChangeTreatment}%`
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td>{controlCountry} (control)</td>
                      <td>€{result.control.before.revenue.toLocaleString()} ({result.control.before.n} orders)</td>
                      <td>€{result.control.after.revenue.toLocaleString()} ({result.control.after.n} orders)</td>
                      <td>
                        {result.pctChangeControl !== null
                          ? `${result.pctChangeControl >= 0 ? "+" : ""}${result.pctChangeControl}%`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="stat-grid" style={{ marginTop: 14 }}>
                <div className="stat-card">
                  <div className="stat-label">Campaign Lift (DiD)</div>
                  <div className={`stat-value ${(result.diDLiftPct ?? 0) >= 0 ? "good" : "critical"}`}>
                    {result.diDLiftPct !== null ? `${result.diDLiftPct >= 0 ? "+" : ""}${result.diDLiftPct} pp` : "n/a"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Incremental Revenue</div>
                  <div className={`stat-value ${(result.incrementalRevenueEuro ?? 0) >= 0 ? "good" : "critical"}`}>
                    {result.incrementalRevenueEuro !== null ? `€${result.incrementalRevenueEuro.toLocaleString()}` : "n/a"}
                  </div>
                </div>
              </div>

              {result.diDLiftPct !== null && (
                <>
                  <p style={{ marginTop: 14 }}>
                    The {treatmentCountry} campaign generated an estimated €{result.incrementalRevenueEuro.toLocaleString()}{" "}
                    in incremental revenue above baseline trends. {controlCountry} (control market){" "}
                    {result.pctChangeControl >= 0 ? "grew" : "declined"} {Math.abs(result.pctChangeControl)}% in the same
                    period — {treatmentCountry} {result.pctChangeTreatment >= 0 ? "grew" : "declined"}{" "}
                    {Math.abs(result.pctChangeTreatment)}%, giving a true campaign lift of {result.diDLiftPct} percentage
                    points.
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <CopyInsightButton
                      text={buildInsightText({
                        metric: `${treatmentCountry} campaign lift (difference-in-differences)`,
                        value: `${result.diDLiftPct >= 0 ? "+" : ""}${result.diDLiftPct} pp`,
                        comparisonPct: result.diDLiftPct,
                        direction: result.diDLiftPct >= 0 ? "above" : "below",
                        comparisonLabel: `${controlCountry}'s organic growth over the same window`,
                        driver: `€${result.incrementalRevenueEuro.toLocaleString()} in incremental revenue isolated from seasonal/market-wide trends`,
                        action: result.diDLiftPct >= 0
                          ? `Consider replicating this campaign structure in comparable markets`
                          : `Reassess campaign targeting or spend before running a similar campaign elsewhere`,
                      })}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function ClvAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/clv-analysis");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>7. Customer Lifetime Value (CLV) Analyzer</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        CLV = AOV × purchase frequency × assumed customer lifespan, broken down by acquisition channel, country,
        and segment. Answers which real customers are worth the most over time — and which channel produces them.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Analyzing…" : "Run Analysis"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the analysis to see real CLV by channel, segment, and country.</p>}
          {result && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)", marginBottom: 8 }}>
                By acquisition channel
              </div>
              <div className="stat-grid">
                {result.byChannel.map((c: any) => (
                  <div className="stat-card" key={c.key}>
                    <div className="stat-label" style={{ textTransform: "capitalize" }}>{c.key} ({c.customerCount} customers)</div>
                    <div className="stat-value">€{c.clv.toLocaleString()}</div>
                  </div>
                ))}
                <div className="stat-card">
                  <div className="stat-label">Wholesale (avg / partner)</div>
                  <div className="stat-value">€{result.wholesale.avgRevenuePerPartner.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 20, marginBottom: 8, color: "var(--color-ink-muted)" }}>
                By segment
              </div>
              <div className="stat-grid">
                {result.bySegment.map((s: any) => (
                  <div className="stat-card" key={s.key}>
                    <div className="stat-label" style={{ textTransform: "capitalize" }}>{s.key} ({s.customerCount})</div>
                    <div className="stat-value">€{s.clv.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 20, marginBottom: 8, color: "var(--color-ink-muted)" }}>
                By country
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Country</th><th>Customers</th><th>AOV</th><th>Annual Freq.</th><th>CLV</th></tr>
                  </thead>
                  <tbody>
                    {result.byCountry.map((c: any) => (
                      <tr key={c.key}>
                        <td>{c.key}</td>
                        <td>{c.customerCount}</td>
                        <td>€{c.aov.toLocaleString()}</td>
                        <td>{c.annualPurchaseFrequency}</td>
                        <td>€{c.clv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function CacClvCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/cac-clv");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>8. Customer Acquisition Cost (CAC) vs. CLV</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        CAC = total spend ÷ new customers acquired. A CLV:CAC ratio above 3:1 is the common bar for a
        profitable acquisition channel — below that, the channel is costing more than the customers it brings in are worth.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Calculating…" : "Run Analysis"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the analysis to see real CAC and CLV by channel.</p>}
          {result && (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Channel</th><th>Spend</th><th>New Customers</th><th>CAC</th><th>CLV</th><th>Ratio</th></tr>
                  </thead>
                  <tbody>
                    {result.channels.map((c: any) => (
                      <tr key={c.channel}>
                        <td style={{ textTransform: "capitalize" }}>{c.channel}</td>
                        <td>{c.spend !== null ? `€${c.spend.toLocaleString()}` : "—"}</td>
                        <td>{c.newCustomers !== null ? c.newCustomers : "—"}</td>
                        <td>{c.cac !== null ? `€${c.cac.toLocaleString()}` : "n/a"}</td>
                        <td>{c.clv !== null ? `€${c.clv.toLocaleString()}` : "n/a"}</td>
                        <td style={{ color: c.healthy === true ? "var(--status-good)" : c.healthy === false ? "var(--status-critical)" : undefined }}>
                          {c.ratio !== null ? `${c.ratio}:1${c.healthy ? " ✓" : " ⚠"}` : "n/a"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(() => {
                const influencer = result.channels.find((c: any) => c.channel === "influencer");
                if (!influencer || influencer.ratio === null) return null;
                const text = buildInsightText({
                  metric: "Influencer channel CLV:CAC ratio",
                  value: `${influencer.ratio}:1`,
                  comparisonPct: ((influencer.ratio - result.healthyRatioThreshold) / result.healthyRatioThreshold) * 100,
                  direction: influencer.ratio >= result.healthyRatioThreshold ? "above" : "below",
                  comparisonLabel: `the ${result.healthyRatioThreshold}:1 healthy threshold`,
                  driver: `€${influencer.cac?.toLocaleString()} CAC against €${influencer.clv?.toLocaleString()} CLV`,
                  action: influencer.healthy
                    ? "Scale influencer acquisition spend while the channel remains above the healthy threshold"
                    : "Reduce influencer CAC or target higher-LTV segments before scaling this channel further",
                });
                return (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <CopyInsightButton text={text} />
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function ChurnRiskCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/churn-risk");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>9. Churn Risk Model</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        For each customer segment: the real share who haven&apos;t purchased in 90 days, the retention rate, and
        the real gap between repeat purchases — plus a list of the customers most overdue to hear from you.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Calculating…" : "Run Analysis"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the analysis to see real churn risk by segment.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Overall Churn Rate</div>
                  <div className={`stat-value ${result.overallChurnRatePct > 30 ? "critical" : "good"}`}>{result.overallChurnRatePct}%</div>
                </div>
              </div>

              {(() => {
                const worstSegment = [...result.bySegment].sort((a: any, b: any) => b.churnRatePct - a.churnRatePct)[0];
                const text = buildInsightText({
                  metric: "Overall customer churn rate",
                  value: `${result.overallChurnRatePct}%`,
                  comparisonPct: result.overallChurnRatePct - 30,
                  direction: result.overallChurnRatePct >= 30 ? "above" : "below",
                  comparisonLabel: "the 30% alert threshold",
                  driver: worstSegment ? `the ${worstSegment.segment} segment at ${worstSegment.churnRatePct}% churn` : "underlying purchase-recency data",
                  action: result.overallChurnRatePct > 30
                    ? "Launch a re-engagement campaign targeting the highest-churn segment first"
                    : "No corrective action needed — churn is within the healthy range",
                });
                return (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <CopyInsightButton text={text} />
                  </div>
                );
              })()}

              <div className="data-table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Segment</th><th>Customers</th><th>Churn Rate</th><th>Retention Rate</th><th>Avg. Days Between Purchases</th></tr>
                  </thead>
                  <tbody>
                    {result.bySegment.map((s: any) => (
                      <tr key={s.segment}>
                        <td style={{ textTransform: "capitalize" }}>{s.segment}</td>
                        <td>{s.customerCount}</td>
                        <td style={{ color: s.churnRatePct > 30 ? "var(--status-critical)" : undefined }}>{s.churnRatePct}%</td>
                        <td>{s.retentionRatePct}%</td>
                        <td>{s.avgTimeBetweenPurchasesDays !== null ? `${s.avgTimeBetweenPurchasesDays}d (${s.repeatPurchaserCount} repeat customers)` : "n/a — no repeat purchasers in this segment"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)", marginTop: 20, marginBottom: 8 }}>
                Top 10 customers most at risk
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Customer</th><th>Segment</th><th>Days Since Last Purchase</th></tr>
                  </thead>
                  <tbody>
                    {result.atRisk.map((c: any) => (
                      <tr key={c.customer_id}>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.customer_id.slice(0, 8)}…</td>
                        <td style={{ textTransform: "capitalize" }}>{c.segment}</td>
                        <td style={{ color: "var(--status-critical)" }}>{c.daysSinceLastPurchase}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

const SIZING_COUNTRIES = [
  "Australia", "China", "Denmark", "Finland", "France", "Germany", "Italy", "Japan",
  "Netherlands", "Norway", "Singapore", "South Korea", "Sweden", "UK", "US",
];

function MarketSizingCalculator() {
  const [country, setCountry] = useState(SIZING_COUNTRIES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [pricePoint, setPricePoint] = useState("2500");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/market-sizing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, category, pricePoint: Number(pricePoint) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>10. Market Sizing Tool (TAM / SAM / SOM)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Total, serviceable, and obtainable market size for a candidate country — TAM from population and a
        luxury-penetration assumption, narrowed by Maison Lumière&apos;s real customer profile and real market-share
        trajectory. Helps answer: is this market worth entering, and how big is the realistic prize?
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Target country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%" }}>
              {SIZING_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Product category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Proposed price point (€)</label>
            <input type="number" value={pricePoint} onChange={(e) => setPricePoint(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Choose a country, category, and price point, then calculate to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">TAM</div>
                <div className="stat-value">€{result.tam.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">SAM</div>
                <div className="stat-value">€{result.sam.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">SOM</div>
                <div className="stat-value good">€{result.som.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function StoreNpvCalculator() {
  const [city, setCity] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [setupCost, setSetupCost] = useState("900000");
  const [annualOperatingCost, setAnnualOperatingCost] = useState("1200000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/decision/store-npv")
      .then((res) => res.json())
      .then((d) => {
        if (d.comparableStoreAvgAnnualRevenue) setAnnualRevenue(String(d.comparableStoreAvgAnnualRevenue));
      });
  }, []);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/store-npv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          annualRevenue: Number(annualRevenue),
          setupCost: Number(setupCost),
          annualOperatingCost: Number(annualOperatingCost),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>11. NPV &amp; Payback Period for Store Expansion</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Net present value, payback period, and internal rate of return for a proposed store — the standard
        capital-budgeting math for deciding whether an investment creates or destroys value.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Vienna" required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Est. annual revenue (€)</label>
            <input type="number" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Setup cost (€)</label>
            <input type="number" value={setupCost} onChange={(e) => setSetupCost(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Annual operating cost (€)</label>
            <input type="number" value={annualOperatingCost} onChange={(e) => setAnnualOperatingCost(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter a city, revenue, and cost estimates, then calculate to see results.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">NPV (5yr, 10% discount)</div>
                  <div className={`stat-value ${result.createsValue ? "good" : "critical"}`}>€{result.npv.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Payback Period</div>
                  <div className="stat-value">{result.paybackMonths !== null ? `${result.paybackMonths} mo` : "never"}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">IRR</div>
                  <div className="stat-value">{result.irrPct !== null ? `${result.irrPct}%` : "n/a"}</div>
                </div>
              </div>
              <p style={{ marginTop: 14 }}>
                This investment is projected to{" "}
                <strong style={{ color: result.createsValue ? "var(--status-good)" : "var(--status-critical)" }}>
                  {result.createsValue ? "create" : "destroy"} value
                </strong>{" "}
                at a 10% discount rate.
              </p>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function DemandDecompositionCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/demand-decomposition");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>12. Demand Decomposition (Trend + Pattern)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Splits real monthly revenue into an underlying growth trend and each month&apos;s deviation from it —
        the same idea behind ARIMA-style demand planning, scoped honestly to what a single year of data can
        actually support.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Decomposing…" : "Run Decomposition"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the decomposition to see the real trend vs. pattern breakdown.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Monthly Growth Trend</div>
                  <div className="stat-value good">+{result.monthlyGrowthRatePct}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Trend Fit (R²)</div>
                  <div className={`stat-value ${result.rSquared > 0.7 ? "good" : "critical"}`}>{result.rSquared}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <CopyInsightButton
                  text={buildInsightText({
                    metric: "Underlying monthly revenue growth trend",
                    value: `${result.monthlyGrowthRatePct >= 0 ? "+" : ""}${result.monthlyGrowthRatePct}%`,
                    comparisonPct: result.monthlyGrowthRatePct,
                    direction: result.monthlyGrowthRatePct >= 0 ? "above" : "below",
                    comparisonLabel: "a flat (0%) baseline",
                    driver: `a trend fit of R² = ${result.rSquared} across ${result.months.length} real months of revenue`,
                    action: result.rSquared > 0.7
                      ? "Use this trend line for planning purposes — the fit is strong enough to be directional"
                      : "Treat this trend as indicative only — the fit is too weak for precise planning",
                  })}
                />
              </div>

              <div className="data-table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Month</th><th>Actual</th><th>Trend</th><th>Deviation</th></tr>
                  </thead>
                  <tbody>
                    {result.months.map((m: any) => (
                      <tr key={m.month}>
                        <td>{m.monthLabel}</td>
                        <td>€{m.actual.toLocaleString()}</td>
                        <td>€{m.trend.toLocaleString()}</td>
                        <td style={{ color: m.residualPct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                          {m.residualPct >= 0 ? "+" : ""}{m.residualPct}%
                        </td>
                      </tr>
                    ))}
                    {result.forecastMonths.map((m: any) => (
                      <tr key={m.month} style={{ opacity: 0.6 }}>
                        <td>{m.monthLabel} (forecast)</td>
                        <td>—</td>
                        <td>€{m.trendOnly.toLocaleString()}</td>
                        <td>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ marginTop: 14 }}>
                Ran hottest above trend: {result.strongMonths.slice(0, 3).map((m: any) => m.monthLabel).join(", ") || "none"}.
                Ran coldest below trend: {result.weakMonths.slice(0, 3).map((m: any) => m.monthLabel).join(", ") || "none"}.
              </p>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function BrandValuationCalculator({ waccOverride }: { waccOverride: number | null }) {
  const [revenueGrowthPct, setRevenueGrowthPct] = useState("");
  const [ebitdaMarginPct, setEbitdaMarginPct] = useState("");
  const [discountRatePct, setDiscountRatePct] = useState("12");
  const [terminalGrowthPct, setTerminalGrowthPct] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/decision/brand-valuation")
      .then((res) => res.json())
      .then((d) => {
        if (d.suggestedGrowthRatePct !== undefined) setRevenueGrowthPct(String(d.suggestedGrowthRatePct));
        if (d.ebitdaMarginPct !== undefined) setEbitdaMarginPct(String(d.ebitdaMarginPct));
      });
  }, []);

  useEffect(() => {
    if (waccOverride !== null) setDiscountRatePct(String(waccOverride));
  }, [waccOverride]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/brand-valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenueGrowthPct: Number(revenueGrowthPct),
          ebitdaMarginPct: Number(ebitdaMarginPct),
          discountRatePct: Number(discountRatePct),
          terminalGrowthPct: Number(terminalGrowthPct),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>13. Brand Valuation (DCF)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        A discounted cash flow valuation — the same mechanics private equity firms use to price a fashion
        brand acquisition, projecting real current performance forward and discounting it back to today&apos;s value.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Revenue growth rate (%/yr)</label>
            <input type="number" value={revenueGrowthPct} onChange={(e) => setRevenueGrowthPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>EBITDA margin (%)</label>
            <input type="number" value={ebitdaMarginPct} onChange={(e) => setEbitdaMarginPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Discount rate (%){waccOverride !== null && <span style={{ color: "var(--color-accent)" }}> · from WACC</span>}
            </label>
            <input type="number" value={discountRatePct} onChange={(e) => setDiscountRatePct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Terminal growth rate (%)</label>
            <input type="number" value={terminalGrowthPct} onChange={(e) => setTerminalGrowthPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Valuing…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter growth, margin, and discount-rate assumptions, then calculate to see results.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Enterprise Value</div>
                  <div className="stat-value good">€{result.enterpriseValue.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Implied Revenue Multiple</div>
                  <div className="stat-value">{result.impliedRevenueMultiple}×</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Implied EBITDA Multiple</div>
                  <div className="stat-value">{result.impliedEbitdaMultiple}×</div>
                </div>
              </div>

              <div className="data-table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Year</th><th>Revenue</th><th>FCF</th><th>PV of FCF</th></tr>
                  </thead>
                  <tbody>
                    {result.years.map((y: any) => (
                      <tr key={y.year}>
                        <td>Year {y.year}</td>
                        <td>€{y.revenue.toLocaleString()}</td>
                        <td>€{y.fcf.toLocaleString()}</td>
                        <td>€{y.pv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function EoqCalculator() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/eoq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>14. Economic Order Quantity (EOQ)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        The optimal reorder quantity that minimizes combined ordering and holding cost — √(2DS ÷ H). Answers
        how much to order and how often, instead of guessing.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Product category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Choose a category, then calculate to see the optimal reorder quantity.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Optimal Order Quantity</div>
                  <div className="stat-value">{result.eoq.toLocaleString()} units</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Reorder Frequency</div>
                  <div className="stat-value">every {result.reorderIntervalDays}d</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Est. Annual Savings</div>
                  <div className="stat-value good">€{result.annualSavings.toLocaleString()}</div>
                </div>
              </div>
              {result.supplier && (
                <div className="stat-grid" style={{ marginTop: 12 }}>
                  <div className="stat-card">
                    <div className="stat-label">Reorder Point (real lead time)</div>
                    <div className="stat-value">{result.reorderPoint.toLocaleString()} units</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Fastest Supplier</div>
                    <div className="stat-value" style={{ fontSize: 16 }}>{result.supplier.name}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Real Lead Time / On-Time Rate</div>
                    <div className="stat-value" style={{ fontSize: 16 }}>{result.supplier.leadTimeDays}d / {result.supplier.onTimeDeliveryRate}%</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function MarketAdoptionCalculator({ countries }: { countries: string[] }) {
  const [country, setCountry] = useState("");
  const [p, setP] = useState("0.01");
  const [q, setQ] = useState("0.4");
  const [avgPrice, setAvgPrice] = useState("2330");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!country && countries.length > 0) setCountry(countries[0]);
  }, [countries, country]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/market-adoption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, p: Number(p), q: Number(q), avgPrice: Number(avgPrice) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>15. Market Adoption S-Curve (Bass Diffusion)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Projects how a new market or product adopts over time — innovators first, then imitators driven by
        word of mouth. Answers how long a new market takes to build momentum, in three scenarios.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Target country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%" }}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>p (innovation)</label>
            <input type="number" step="0.001" value={p} onChange={(e) => setP(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>q (imitation)</label>
            <input type="number" step="0.01" value={q} onChange={(e) => setQ(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Avg. price (€)</label>
            <input type="number" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Projecting…" : "Project"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Choose a country and adoption parameters, then project to see results.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Potential Market Size</div>
                  <div className="stat-value">{result.marketSize.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Adoption Inflects At</div>
                  <div className="stat-value">Year {result.inflectionYear}</div>
                </div>
              </div>

              <div className="data-table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>New Adopters (Conservative)</th>
                      <th>New Adopters (Base)</th>
                      <th>New Adopters (Optimistic)</th>
                      <th>Revenue (Base)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scenarios.base.map((row: any, i: number) => (
                      <tr key={row.year}>
                        <td>Year {row.year}</td>
                        <td>{result.scenarios.conservative[i].newAdopters.toLocaleString()}</td>
                        <td>{row.newAdopters.toLocaleString()}</td>
                        <td>{result.scenarios.optimistic[i].newAdopters.toLocaleString()}</td>
                        <td>€{row.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function CapmCalculator({ onResult }: { onResult: (expectedReturnPct: number) => void }) {
  const [riskFreeRatePct, setRiskFreeRatePct] = useState("3.5");
  const [marketReturnPct, setMarketReturnPct] = useState("8");
  const [beta, setBeta] = useState("0.7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/capm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskFreeRatePct: Number(riskFreeRatePct), marketReturnPct: Number(marketReturnPct), beta: Number(beta) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
      onResult(json.expectedReturnPct);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>16. CAPM (Cost of Equity)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        The expected return investors require for the risk of holding equity in this kind of business — feeds
        directly into the WACC calculator below as the cost of equity.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Risk-free rate (%)</label>
            <input type="number" step="0.1" value={riskFreeRatePct} onChange={(e) => setRiskFreeRatePct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Market return (%)</label>
            <input type="number" step="0.1" value={marketReturnPct} onChange={(e) => setMarketReturnPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Beta</label>
            <input type="number" step="0.05" value={beta} onChange={(e) => setBeta(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter risk-free rate, market return, and beta, then calculate to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Equity Risk Premium</div>
                <div className="stat-value">{result.equityRiskPremiumPct}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Expected Return (Cost of Equity)</div>
                <div className="stat-value good">{result.expectedReturnPct}%</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function WaccCalculator({ capmResult, onResult }: { capmResult: number | null; onResult: (waccPct: number) => void }) {
  const [equityValue, setEquityValue] = useState("100000000");
  const [debtValue, setDebtValue] = useState("30000000");
  const [costOfEquityPct, setCostOfEquityPct] = useState("6.65");
  const [costOfDebtPct, setCostOfDebtPct] = useState("5");
  const [taxRatePct, setTaxRatePct] = useState("25");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (capmResult !== null) setCostOfEquityPct(String(capmResult));
  }, [capmResult]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/wacc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equityValue: Number(equityValue),
          debtValue: Number(debtValue),
          costOfEquityPct: Number(costOfEquityPct),
          costOfDebtPct: Number(costOfDebtPct),
          taxRatePct: Number(taxRatePct),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
      onResult(json.waccPct);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>17. WACC (Weighted Average Cost of Capital)</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        The blended return the business needs to earn to satisfy both shareholders and lenders — the hurdle
        rate every investment should clear. Automatically becomes the Brand Valuation calculator&apos;s discount rate above.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Equity value (€)</label>
            <input type="number" value={equityValue} onChange={(e) => setEquityValue(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Debt value (€)</label>
            <input type="number" value={debtValue} onChange={(e) => setDebtValue(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Cost of equity (%){capmResult !== null && <span style={{ color: "var(--color-accent)" }}> · from CAPM</span>}
            </label>
            <input type="number" step="0.01" value={costOfEquityPct} onChange={(e) => setCostOfEquityPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Cost of debt (%)</label>
            <input type="number" step="0.1" value={costOfDebtPct} onChange={(e) => setCostOfDebtPct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Tax rate (%)</label>
            <input type="number" step="0.1" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Enter capital structure and cost assumptions, then calculate to see results.</p>}
          {result && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Equity / Debt Weight</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{result.equityWeightPct}% / {result.debtWeightPct}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">WACC</div>
                <div className="stat-value good">{result.waccPct}%</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function Waterfall({ bars }: { bars: { label: string; value: number; isTotal?: boolean }[] }) {
  const width = 640;
  const height = 220;
  const gap = 16;
  const barWidth = (width - (bars.length - 1) * gap) / bars.length;

  let cumulative = 0;
  const positioned = bars.map((b) => {
    if (b.isTotal) {
      const start = 0;
      const end = b.value;
      cumulative = b.value;
      return { ...b, start, end };
    }
    const start = cumulative;
    const end = cumulative + b.value;
    cumulative = end;
    return { ...b, start, end };
  });

  const maxVal = Math.max(...positioned.map((b) => Math.max(b.start, b.end)), 1);
  const minVal = Math.min(...positioned.map((b) => Math.min(b.start, b.end)), 0);
  const range = maxVal - minVal || 1;
  const scaleY = (v: number) => height - ((v - minVal) / range) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height + 34}`} style={{ width: "100%", height: "auto" }}>
      {positioned.map((b, i) => {
        const x = i * (barWidth + gap);
        const yTop = scaleY(Math.max(b.start, b.end));
        const yBottom = scaleY(Math.min(b.start, b.end));
        const barHeight = Math.max(1, yBottom - yTop);
        const color = b.isTotal ? "var(--color-ink)" : b.value >= 0 ? "var(--status-good)" : "var(--status-critical)";
        return (
          <g key={b.label}>
            <rect x={x} y={yTop} width={barWidth} height={barHeight} fill={color} opacity={b.isTotal ? 1 : 0.75} />
            <text x={x + barWidth / 2} y={yTop - 6} fontSize={11} textAnchor="middle" fill="var(--color-ink)">
              €{Math.round(b.value).toLocaleString()}
            </text>
            <text x={x + barWidth / 2} y={height + 20} fontSize={10} textAnchor="middle" fill="var(--color-ink-muted, #8b8578)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RevenueDecompositionCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/revenue-decomposition");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>18. Revenue Growth Decomposition</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Splits real revenue change into price, volume, and mix effects — the same waterfall format used in
        quarterly board presentations to answer: did we grow by charging more, selling more, or selling a
        different, pricier mix of products?
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Decomposing…" : "Run Decomposition"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Run the decomposition to see the real price/volume/mix bridge.</p>}
          {result && (
            <>
              <Waterfall bars={result.waterfall} />

              {(() => {
                const effects = [
                  { label: "Volume", value: result.volumeEffect },
                  { label: "Price", value: result.priceEffect },
                  { label: "Mix", value: result.mixEffect },
                ];
                const largest = [...effects].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
                const text = buildInsightText({
                  metric: "Revenue growth (cohort-over-cohort)",
                  value: `€${result.totalGrowth.toLocaleString()}`,
                  comparisonPct: result.totalRevenue1 ? (result.totalGrowth / result.totalRevenue1) * 100 : 0,
                  direction: result.totalGrowth >= 0 ? "above" : "below",
                  comparisonLabel: `the earlier cohort's revenue (€${result.totalRevenue1.toLocaleString()})`,
                  driver: `the ${largest.label} Effect (€${largest.value.toLocaleString()}), the largest of the three decomposed effects`,
                  action: largest.label === "Price"
                    ? "Evaluate whether the price change is sustainable or eroding volume before repeating it"
                    : largest.label === "Volume"
                    ? "Identify what drove the unit volume shift and whether it's repeatable"
                    : "Investigate the category mix shift behind this effect before assuming it will continue",
                });
                return (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <CopyInsightButton text={text} />
                  </div>
                );
              })()}

              <div className="data-table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Category</th><th>Earlier: Units / Avg Price</th><th>Later: Units / Avg Price</th></tr>
                  </thead>
                  <tbody>
                    {result.categoryDetail.map((c: any) => (
                      <tr key={c.category}>
                        <td style={{ textTransform: "capitalize" }}>{c.category}</td>
                        <td>{c.units1} / {c.avgPrice1 !== null ? `€${c.avgPrice1}` : "—"}</td>
                        <td>{c.units2} / {c.avgPrice2 !== null ? `€${c.avgPrice2}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function ChurnPredictionCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/churn-prediction");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>19. Churn Prediction Model</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Scores every current customer 0–100 on churn risk — a weighted scoring model (recency, frequency, AOV
        trend) that works without machine-learning infrastructure — and ranks the top 10 to act on first.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Scoring…" : "Score Customers"}
          </button>
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div className="calc-result">
          {!result && !error && <p className="calc-result-placeholder">Score customers to see the real churn-risk ranking.</p>}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Customers Scored</div>
                  <div className="stat-value">{result.customerCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average Risk Score</div>
                  <div className={`stat-value ${result.avgScore > 60 ? "critical" : "good"}`}>{result.avgScore}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)", marginTop: 20, marginBottom: 8 }}>
                Top 10 highest-risk customers
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Customer</th><th>Segment</th><th>Score</th><th>Days Since Purchase</th><th>Recommended Action</th></tr>
                  </thead>
                  <tbody>
                    {result.top10.map((c: any) => (
                      <tr key={c.customer_id}>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.customer_id.slice(0, 8)}…</td>
                        <td style={{ textTransform: "capitalize" }}>{c.segment}</td>
                        <td style={{ color: c.score >= 80 ? "var(--status-critical)" : undefined, fontWeight: 600 }}>{c.score}</td>
                        <td>{c.daysSinceLastPurchase}</td>
                        <td style={{ fontSize: 12 }}>{c.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {result && <Methodology lines={result.methodology} />}
    </div>
  );
}

function CagrRow({ label, data }: { label: string; data: any }) {
  const [start, setStart] = useState(String(data.avgEarly));
  const [end, setEnd] = useState(String(data.avgLate));
  const [years, setYears] = useState(String(data.years));

  const s = parseFloat(start);
  const e = parseFloat(end);
  const y = parseFloat(years);
  const cagrPct = s > 0 && y > 0 ? (Math.pow(e / s, 1 / y) - 1) * 100 : null;
  const doublingYears = cagrPct !== null && cagrPct > 0 ? Math.log(2) / Math.log(1 + cagrPct / 100) : null;
  const ruleOf72Years = cagrPct !== null && cagrPct > 0 ? 72 / cagrPct : null;
  const halvedCagrPct = doublingYears !== null && doublingYears > 0 ? (Math.pow(2, 2 / doublingYears) - 1) * 100 : null;
  const extreme = cagrPct !== null && Math.abs(cagrPct) > 100;

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize", marginBottom: 4 }}>{label}</div>

      <div className="calc-layout">
        <div className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Start (€)</label>
            <input type="number" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>End (€)</label>
            <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Years</label>
            <input type="number" step="0.1" value={years} onChange={(e) => setYears(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>

        <div className="calc-result">
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">CAGR</div>
              <div className={`stat-value ${cagrPct !== null && cagrPct >= 0 ? "good" : "critical"}`}>
                {cagrPct !== null ? `${cagrPct >= 0 ? "+" : ""}${cagrPct.toFixed(1)}%` : "n/a"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rule of 72 (approx. doubling)</div>
              <div className="stat-value">{ruleOf72Years !== null ? `${ruleOf72Years.toFixed(1)} yrs` : "—"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Exact Doubling Time</div>
              <div className="stat-value">{doublingYears !== null ? `${doublingYears.toFixed(1)} yrs` : "—"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Growth Rate to Halve That</div>
              <div className="stat-value">{halvedCagrPct !== null ? `${halvedCagrPct.toFixed(1)}%` : "—"}</div>
            </div>
          </div>

          {cagrPct !== null && doublingYears !== null && halvedCagrPct !== null && (
            <p style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
              {`At ${label}'s current CAGR of ${cagrPct.toFixed(1)}%, revenue will double in ${doublingYears.toFixed(1)} years. To halve that timeline, you'd need to grow at ${halvedCagrPct.toFixed(1)}%.`}
            </p>
          )}

          {extreme && (
            <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8, fontStyle: "italic" }}>
              This is an annualized run-rate from a ~{data.years}-year real window during a launch/ramp phase, not a
              steady-state growth expectation — treat the dollar trajectory as the useful signal, not the % as something
              to extrapolate for multiple years.
            </p>
          )}

          <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Real smoothed inputs: avg of {data.earlyWindowMonths.join(", ")} (€{data.avgEarly.toLocaleString()}) vs. avg of{" "}
            {data.lateWindowMonths.join(", ")} (€{data.avgLate.toLocaleString()}). Literal single-month endpoint version:{" "}
            {data.rawCagrPct !== null ? `${data.rawCagrPct >= 0 ? "+" : ""}${data.rawCagrPct}%` : "n/a"} (€
            {data.rawStart.revenue.toLocaleString()} in {data.rawStart.month} → €{data.rawEnd.revenue.toLocaleString()} in{" "}
            {data.rawEnd.month}, {data.rawYears} yrs).
          </p>
        </div>
      </div>
    </div>
  );
}

function CagrCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/cagr");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>20. CAGR &amp; Rule of 72</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        (End Value ÷ Start Value)^(1 ÷ Years) − 1 — the single most common calculation in board presentations.
        Pre-filled with Maison Lumière&apos;s real revenue by channel; every field is editable to test a scenario.
      </p>

      <button type="button" className="btn" onClick={run} disabled={loading}>
        {loading ? "Calculating…" : "Run Analysis"}
      </button>
      {error && <p style={{ color: "var(--status-critical)", marginTop: 12, fontSize: 12.5 }}>{error}</p>}
      {!result && !error && <p className="calc-result-placeholder" style={{ marginTop: 12 }}>Run the analysis to see real per-channel CAGR — each channel's Start/End/Years is editable below once loaded.</p>}

      {result && (
        <>
          <div className="section">
            <CagrRow label="Overall" data={result.series.overall} />
            {Object.entries(result.series)
              .filter(([k]) => k !== "overall")
              .map(([channel, data]) => (
                <CagrRow key={channel} label={channel} data={data} />
              ))}
          </div>
          <Methodology lines={result.methodology} />
        </>
      )}
    </div>
  );
}

function RfmSegmentationCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/rfm-segmentation");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  const SEGMENT_ORDER = ["Champions", "At Risk", "New Customers", "Developing", "Lost"];

  function tier(score: number): "Low" | "Mid" | "High" {
    if (score <= 2) return "Low";
    if (score >= 4) return "High";
    return "Mid";
  }

  const matrix = result
    ? (() => {
        const cells: Record<string, number> = {};
        result.customers.forEach((c: any) => {
          const fmAvg = (c.f + c.m) / 2;
          const rTier = tier(c.r);
          const fmTier = fmAvg >= 3.5 ? "High" : fmAvg <= 2.5 ? "Low" : "Mid";
          cells[`${rTier}|${fmTier}`] = (cells[`${rTier}|${fmTier}`] || 0) + 1;
        });
        return cells;
      })()
    : {};

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>21. RFM Segmentation</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Scores every real customer on Recency, Frequency, and Monetary value (quintiles 1–5 each) and maps them into
        Champions, At Risk, Lost, and New Customer segments.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Scoring…" : "Run Analysis"}
          </button>
        </div>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Run to score all real customers on R, F, and M.</p>}
          {result && (
            <>
              {result.frequencyIsDegenerate && (
                <p style={{ fontSize: 12.5, color: "var(--status-critical)", marginBottom: 14, fontStyle: "italic" }}>
                  Every real customer has purchased exactly once (order_count = 1) — the same "zero repeat purchase"
                  finding behind the Growth Bridge and Consulting Summary. Frequency is shown as a neutral score for
                  everyone below, and segment boundaries are defined by Recency and Monetary alone until real
                  repeat-purchase variation exists — including F would make Champions, Lost, and New Customers all
                  structurally impossible at once.
                </p>
              )}
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                {SEGMENT_ORDER.map((seg) => (
                  <div className="stat-card" key={seg}>
                    <div className="stat-label">{seg}</div>
                    <div className="stat-value">{result.segmentCounts[seg] || 0}</div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-muted)", marginBottom: 8 }}>
                Segment matrix — Recency × (Frequency + Monetary)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "auto repeat(3, 1fr)", gap: 1, background: "var(--color-border)", border: "1px solid var(--color-border)", marginBottom: 16 }}>
                <div className="panel" style={{ border: "none" }} />
                {["Low", "Mid", "High"].map((fm) => (
                  <div key={fm} className="panel" style={{ border: "none", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--color-ink-muted)" }}>
                    FM: {fm}
                  </div>
                ))}
                {["High", "Mid", "Low"].map((r) => (
                  <>
                    <div key={`label-${r}`} className="panel" style={{ border: "none", fontSize: 11, fontWeight: 600, color: "var(--color-ink-muted)", display: "flex", alignItems: "center" }}>
                      R: {r}
                    </div>
                    {["Low", "Mid", "High"].map((fm) => (
                      <div key={`${r}-${fm}`} className="panel" style={{ border: "none", textAlign: "center" }}>
                        <div className="stat-value" style={{ fontSize: 20 }}>{matrix[`${r}|${fm}`] || 0}</div>
                      </div>
                    ))}
                  </>
                ))}
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Country</th>
                      <th>R</th>
                      <th>F</th>
                      <th>M</th>
                      <th>Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.customers]
                      .sort((a: any, b: any) => SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment))
                      .slice(0, 20)
                      .map((c: any) => (
                        <tr key={c.customer_id}>
                          <td className="mono" style={{ fontSize: 11 }}>{c.customer_id.slice(0, 8)}</td>
                          <td>{c.country}</td>
                          <td>{c.r}</td>
                          <td>{c.f}</td>
                          <td>{c.m}</td>
                          <td>{c.segment}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <DataQualityIndicator dataPoints={result.totalCustomers} />
            </>
          )}
        </div>
      </div>

      {result && (
        <Methodology
          lines={[
            `Recency = real days_since_last_activity (customer_journey); Frequency = real order_count (crm_customers); Monetary = real total_spend (crm_customers).`,
            `Each dimension is ranked into quintiles 1 (worst 20%) to 5 (best 20%) across all ${result.totalCustomers} real customers.`,
            result.frequencyIsDegenerate
              ? `Frequency is held at a neutral score for every customer because order_count = 1 for all ${result.totalCustomers} real customers today — no repeat purchase exists yet in this dataset. Segment boundaries here use Recency and Monetary only: Champions = R≥4, M≥4. At Risk = R≤2, M≥4. Lost = R≤2, M≤2. New Customers = R≥4, M≤2. Everyone else is "Developing." Including a constant F in these boundaries would make three of the four named segments unreachable at once.`
              : `Champions = R≥4, F≥4, M≥4. At Risk = R≤2 with F≥4 or M≥4. Lost = R≤2, F≤2, M≤2. New Customers = R≥4, F≤2. Everyone else is "Developing." Frequency is ranked normally — real repeat-purchase variation exists in this dataset.`,
          ]}
        />
      )}
    </div>
  );
}

function CohortRetentionCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [channel, setChannel] = useState<"all" | "influencer" | "organic">("all");

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/cohort-retention");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  const filteredCohorts = result
    ? result.cohorts.filter((c: any) => channel === "all" || c.channel === channel)
    : [];

  function cellColor(pct: number | string): string {
    if (typeof pct !== "number") return "var(--color-bg-sunken)";
    const intensity = Math.min(1, pct / 60);
    const lightness = 88 - intensity * 55;
    return `hsl(38, 45%, ${lightness}%)`;
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>22. Cohort Retention Curves</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Groups real customers by acquisition month and tracks what share are still active at 30/60/90/180 days —
        filterable by acquisition channel.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Acquisition channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as any)} style={{ width: "100%" }}>
              <option value="all">All channels</option>
              <option value="influencer">Influencer</option>
              <option value="organic">Organic</option>
            </select>
          </div>
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Building cohorts…" : "Run Analysis"}
          </button>
        </div>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Run to build real acquisition-month cohorts.</p>}
          {result && channel === "organic" && result.channelCounts.organic === 0 ? (
            <EmptyState
              label="No Organic Cohorts"
              message="Every real customer in this dataset converted through an influencer touchpoint — there is no organic-acquired cohort to show yet. Switch to 'Influencer' or 'All channels.'"
            />
          ) : result ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Customers</th>
                      {result.checkpoints.map((cp: number) => (
                        <th key={cp}>Day {cp}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCohorts.map((c: any) => (
                      <tr key={`${c.cohortMonth}-${c.channel}`}>
                        <td className="mono">{c.cohortMonth}</td>
                        <td>{c.customerCount}</td>
                        {result.checkpoints.map((cp: number) => (
                          <td key={cp} style={{ background: cellColor(c.retention[cp]), textAlign: "center" }}>
                            {typeof c.retention[cp] === "number" ? `${c.retention[cp]}%` : "n/a"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted" style={{ fontSize: 11, marginTop: 10 }}>
                Dark = high retention, light = low. "n/a" means that cohort hasn't reached that checkpoint's age yet
                (right-censored), not zero retention.
              </p>
              <DataQualityIndicator dataPoints={filteredCohorts.reduce((s: number, c: any) => s + c.customerCount, 0)} />
            </>
          ) : null}
        </div>
      </div>

      {result && (
        <Methodology
          lines={[
            `Cohort = real first_purchase_date (crm_customers), grouped by month. "Retained at day N" means the customer's real last_activity_date (customer_journey) is at least N days after their first purchase — an activity-recency proxy, not a repeat-purchase count, since order_count = 1 for every real customer today.`,
            `Cohorts younger than a given checkpoint (relative to the latest real event, ${result.today.slice(0, 10)}) show "n/a" for that checkpoint rather than a misleading 0%.`,
            `Channel: every real customer's first_touch_source in this dataset is influencer-attributed — there is no organic cohort in the real data yet, shown honestly as an empty state rather than fabricated.`,
          ]}
        />
      )}
    </div>
  );
}

function TimeDecayAttributionCalculator() {
  const [lambda, setLambda] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/time-decay-attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lambda: Number(lambda) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>23. Time Decay Attribution</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Splits real purchase revenue across every real touchpoint in a customer's session history instead of giving
        100% credit to the last click — touchpoints closer to purchase get more credit via exponential decay.
      </p>

      <div className="calc-layout">
        <form onSubmit={calculate} className="calc-form">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Decay rate (λ)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={lambda}
              onChange={(e) => setLambda(e.target.value)}
              style={{ width: "100%" }}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              credit = e^(−λt), t = days before purchase. Higher λ concentrates credit closer to conversion.
            </p>
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </button>
        </form>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Set a decay rate and calculate to compare last-touch vs. time-decay attribution.</p>}
          {result && (
            <>
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-label">Customers Analyzed</div>
                  <div className="stat-value">{result.customersAnalyzed}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg. Touchpoints / Customer</div>
                  <div className="stat-value">{result.avgTouchpointsPerCustomer}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Multi-Touch Customers</div>
                  <div className="stat-value">{result.customersWithMultiTouch}</div>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Last-Touch Revenue</th>
                      <th>Time-Decay Revenue</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.map((row: any) => {
                      const diff = row.timeDecayRevenue - row.lastTouchRevenue;
                      return (
                        <tr key={row.source}>
                          <td>{row.source}</td>
                          <td>€{row.lastTouchRevenue.toLocaleString()}</td>
                          <td>€{row.timeDecayRevenue.toLocaleString()}</td>
                          <td style={{ color: diff >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                            {diff >= 0 ? "+" : ""}€{diff.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <DataQualityIndicator dataPoints={result.customersAnalyzed} />
            </>
          )}
        </div>
      </div>

      {result && (
        <Methodology
          lines={[
            `Touchpoints are every real sales_events row for a converting visitor at or before their real purchase timestamp (avg ${result.avgTouchpointsPerCustomer} touchpoints/customer, ${result.customersWithMultiTouch} of ${result.customersAnalyzed} customers had more than one).`,
            `Time-decay weight per touchpoint = e^(−λt), t = real days between that touchpoint and the purchase, normalized to sum to 1 per customer, then multiplied by that customer's real purchase revenue.`,
            `Last-touch credits 100% of revenue to the real traffic_source of the touchpoint closest to purchase (often the purchase event's own source when no earlier touchpoint exists).`,
            `λ = ${result.lambda} in this run — a documented, user-adjustable planning parameter, not derived from this dataset (no labeled ground-truth attribution exists to fit it against).`,
          ]}
        />
      )}
    </div>
  );
}

function SellThroughRateCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/sell-through");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>24. Sell-Through Rate</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Units sold ÷ total units available, by category and season, with a projected depletion date at current
        velocity. Categories below 70% are flagged.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Calculating…" : "Run Analysis"}
          </button>
        </div>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Run to see real sell-through by category, season, and market.</p>}
          {result && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-muted)", marginBottom: 8 }}>
                By category
              </p>
              <div className="data-table-wrap" style={{ marginBottom: 18 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Sold</th>
                      <th>Remaining</th>
                      <th>Sell-Through</th>
                      <th>Days to Deplete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byCategory.map((r: any) => (
                      <tr key={r.category}>
                        <td style={{ textTransform: "capitalize" }}>{r.category}</td>
                        <td>{r.unitsSold}</td>
                        <td>{r.unitsRemaining}</td>
                        <td style={{ color: r.belowThreshold ? "var(--status-critical)" : "var(--status-good)", fontWeight: 600 }}>
                          {typeof r.sellThroughPct === "number" ? `${r.sellThroughPct}%` : r.sellThroughPct}
                        </td>
                        <td>{r.daysToDeplete != null ? `${r.daysToDeplete}d` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-muted)", marginBottom: 8 }}>
                By season
              </p>
              <div className="data-table-wrap" style={{ marginBottom: 18 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Season</th>
                      <th>Sold</th>
                      <th>Remaining</th>
                      <th>Sell-Through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bySeason.map((r: any) => (
                      <tr key={r.season}>
                        <td>{r.season}</td>
                        <td>{r.unitsSold}</td>
                        <td>{r.unitsRemaining}</td>
                        <td style={{ color: r.belowThreshold ? "var(--status-critical)" : "var(--status-good)", fontWeight: 600 }}>
                          {typeof r.sellThroughPct === "number" ? `${r.sellThroughPct}%` : r.sellThroughPct}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-muted)", marginBottom: 8 }}>
                Units sold by market
              </p>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Units Sold</th>
                      <th>Share of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byMarket.map((r: any) => (
                      <tr key={r.country}>
                        <td>{r.country}</td>
                        <td>{r.unitsSold}</td>
                        <td>{r.shareOfTotalPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataQualityIndicator dataPoints={result.products.length} />
            </>
          )}
        </div>
      </div>

      {result && (
        <Methodology
          lines={[
            `Sell-through % = real units_sold_direct ÷ (units_sold_direct + real stock_level), by category and season (product_lifecycle joined to inventory).`,
            `Days to deplete = current real stock_level ÷ real daily sales velocity (units_sold_direct ÷ ${result.observedDays}-day observed window). Shown as "—" where velocity is zero.`,
            `"By market" shows each country's real share of total units sold (sales_events) — inventory in this dataset isn't split by market, so this is a sales distribution, not a per-market inventory sell-through rate. Named plainly rather than implying a market-level stock denominator that doesn't exist.`,
            `Categories below the ${result.threshold}% threshold are flagged in red.`,
          ]}
        />
      )}
    </div>
  );
}

function GmroiCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/gmroi");
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setResult(json);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    strong: "var(--status-good)",
    adequate: "var(--color-ink)",
    attention: "var(--status-critical)",
    unknown: "var(--color-ink-muted)",
  };

  return (
    <div className="panel">
      <h2 className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>25. GMROI</h2>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Gross margin ÷ average inventory value, by category — the single number that says whether inventory
        investment is actually paying back.
      </p>

      <div className="calc-layout">
        <div className="calc-form">
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? "Calculating…" : "Run Analysis"}
          </button>
        </div>

        <div className="calc-result">
          {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5 }}>{error}</p>}
          {!result && !error && <p className="calc-result-placeholder">Run to see real GMROI by category against the luxury benchmark.</p>}
          {result && (
            <>
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-label">Overall GMROI</div>
                  <div className="stat-value">{result.overallGmroi}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Strong Benchmark</div>
                  <div className="stat-value">≥ {result.strongBenchmark}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Needs Attention Below</div>
                  <div className="stat-value">{result.attentionThreshold}</div>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Gross Margin</th>
                      <th>Inventory Value</th>
                      <th>GMROI</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.categories.map((c: any) => (
                      <tr key={c.category}>
                        <td style={{ textTransform: "capitalize" }}>{c.category}</td>
                        <td>€{c.grossMargin.toLocaleString()}</td>
                        <td>€{c.inventoryValue.toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: statusColor[c.status] }}>{c.gmroi}</td>
                        <td style={{ color: statusColor[c.status], textTransform: "capitalize" }}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataQualityIndicator dataPoints={result.productCount} />
            </>
          )}
        </div>
      </div>

      {result && (
        <Methodology
          lines={[
            `Gross margin = real (retail_price − cost_price) × real units_sold_direct, summed by category (product_lifecycle). Used in place of finance_pnl, which is real but too sparse (2 rows, 1 period) to break out by category.`,
            `Inventory value = real stock_level × real cost_price, summed by category (inventory joined to product_lifecycle).`,
            `Benchmark: GMROI ≥ ${result.strongBenchmark} is considered strong in luxury fashion; below ${result.attentionThreshold} is flagged as requiring attention.`,
          ]}
        />
      )}
    </div>
  );
}

type DiTab = "financial" | "market" | "customer" | "risk";

const DI_TABS: { id: DiTab; label: string }[] = [
  { id: "financial", label: "Financial Models" },
  { id: "market", label: "Market & Growth" },
  { id: "customer", label: "Customer Intelligence" },
  { id: "risk", label: "Risk & Operations" },
];

const DI_TAB_COUNTS: Record<DiTab, number> = { financial: 7, market: 6, customer: 6, risk: 6 };

function LinkOutCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="link-out-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
          <p className="text-muted" style={{ lineHeight: 1.5 }}>{description}</p>
        </div>
        <span className="text-muted" style={{ fontSize: 18, flexShrink: 0 }}>→</span>
      </div>
    </Link>
  );
}

function CrossTabChip({ label, tab, onGo }: { label: string; tab: DiTab; onGo: (tab: DiTab) => void }) {
  return (
    <button
      type="button"
      onClick={() => onGo(tab)}
      className="badge"
      style={{ cursor: "pointer", border: "1px dashed var(--color-border-strong)" }}
    >
      {label} — see {DI_TABS.find((t) => t.id === tab)?.label} →
    </button>
  );
}

export default function DecisionIntelligencePage() {
  const [countries, setCountries] = useState<string[]>([]);
  const [capmResult, setCapmResult] = useState<number | null>(null);
  const [waccResult, setWaccResult] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DiTab>("financial");
  const [metrics, setMetrics] = useState<QuickMetric[] | null>(null);

  useEffect(() => {
    fetch("/api/intelligence/dimensions")
      .then((res) => res.json())
      .then((d) => setCountries(d.country?.map((c: any) => c.value) ?? []));
    fetch("/api/quick-metrics")
      .then((res) => res.json())
      .then((d) => setMetrics(d.metrics ?? null))
      .catch(() => setMetrics(null));
  }, []);

  const clvCac = metrics?.find((m) => m.id === "clv_cac_ratio");
  const margin = metrics?.find((m) => m.id === "gross_margin");
  const momGrowth = metrics?.find((m) => m.id === "revenue_growth");

  const kpis: KpiItem[] = [clvCac, margin, momGrowth]
    .filter((m): m is QuickMetric => Boolean(m))
    .map((m) => ({ label: m.label, value: m.value, delta: m.benchmarkNote, direction: toDirection(m.status) }));

  const priorityMetric = metrics?.find((m) => m.status === "critical") ?? metrics?.find((m) => m.status === "warn") ?? metrics?.[0];
  const headline = priorityMetric
    ? `${priorityMetric.label} is ${priorityMetric.value} — ${priorityMetric.benchmarkNote}.`
    : "Twenty-five calculators, each grounded in real BigQuery data, are ready to run below.";
  const secondaryMetric = metrics?.find((m) => m !== priorityMetric && (m.status === "good" || m.status === "critical"));
  const insightBoxText = secondaryMetric
    ? `${secondaryMetric.label} is ${secondaryMetric.value} — ${secondaryMetric.benchmarkNote}. Run the calculators below to model what closing this gap, or protecting this strength, is actually worth.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Intelligence · Decision Calculators</div>
      <h1 className="page-title">Decision Intelligence</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="tab-bar no-print">
        {DI_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            <span className="tab-count">({DI_TAB_COUNTS[t.id]})</span>
          </button>
        ))}
      </div>

      {activeTab === "financial" && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 0 }}>
          <StoreViabilityCalculator />
          <StoreNpvCalculator />
          <BrandValuationCalculator waccOverride={waccResult} />
          <CapmCalculator onResult={setCapmResult} />
          <WaccCalculator capmResult={capmResult} onResult={setWaccResult} />
          <CagrCalculator />
          <GmroiCalculator />
        </div>
      )}

      {activeTab === "market" && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 0 }}>
          <MarketSizingCalculator />
          <MarketAdoptionCalculator countries={countries} />
          <MarketExpansionCalculator countries={countries} />
          <CollabRoiCalculator countries={countries} />
          <DemandDecompositionCalculator />
          <TimeDecayAttributionCalculator />
          <LinkOutCard
            href="/growth-bridge"
            title="Growth Bridge →"
            description="The standard consulting revenue bridge — expansion, new business, churn, and price — on its own dedicated page, since it's built from full-page waterfall visuals rather than a single form-driven calculator."
          />
          <CrossTabChip label="CAGR & Rule of 72" tab="financial" onGo={setActiveTab} />
        </div>
      )}

      {activeTab === "customer" && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 0 }}>
          <ClvAnalyzer />
          <CacClvCalculator />
          <ChurnRiskCalculator />
          <ChurnPredictionCalculator />
          <RfmSegmentationCalculator />
          <CohortRetentionCalculator />
          <LinkOutCard
            href="/growth-bridge"
            title="Cohort Analysis (Growth Bridge) →"
            description="Splits real customers into new / retained / churned cohorts to show exactly where revenue change came from — lives on its own page alongside the waterfall chart it's built around."
          />
        </div>
      )}

      {activeTab === "risk" && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 0 }}>
          <MonteCarloForecastCalculator />
          <CampaignImpactCalculator countries={countries} />
          <PriceElasticityCalculator />
          <RevenueDecompositionCalculator />
          <EoqCalculator />
          <SellThroughRateCalculator />
          <LinkOutCard
            href="/value-drivers"
            title="Sensitivity Tornado Chart →"
            description="Every real business lever's ±20% impact on total revenue, ranked — lives on the Value Driver Tree page alongside the tree it's built from."
          />
        </div>
      )}

      <DocInsightBox>{insightBoxText}</DocInsightBox>
      <DocFooterNote timestamp={formatTimestamp(new Date())} />

      <RelatedPages hrefs={["/suppliers", "/value-drivers", "/growth-bridge", "/data-quality"]} />
    </div>
  );
}
