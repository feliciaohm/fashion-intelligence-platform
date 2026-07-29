// Server-only: the AI Search "demo mode" fallback. When the real Claude API
// is unavailable (no ANTHROPIC_API_KEY, or the account has no credits --
// exactly the situation this platform has been in since Pass 7), the AI
// Search box in Command Center still needs to answer the handful of
// questions any demo audience actually asks in the first 30 seconds. This
// engine does that with plain keyword pattern-matching over real BigQuery
// data -- no model call, no cost, no "AI unavailable" dead end.
//
// This is deliberately NOT a general-purpose NL→SQL engine. It recognizes
// five real question shapes (see PATTERN checks below) and answers each from
// the exact same real computations already used elsewhere in the platform
// (getRawPlatformMetrics for margin/churn, computeMarketSizing for
// expansion), so a demo-mode answer is never a different number than the
// equivalent page would show. Anything it doesn't recognize gets an honest
// "here's what I can answer" message instead of a guess.
import { bigquery } from "@/lib/bigquery";
import { getRawPlatformMetrics } from "@/lib/benchmarks-server";
import { computeMarketSizing, POPULATION, SIZING_COUNTRIES } from "@/lib/market-sizing-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const CHURN_ALERT_THRESHOLD_PCT = 30; // same threshold used by the Executive Summary insight engine

// Defaults used when a demo question implies a market-sizing run but doesn't
// specify a category/price point (a natural-language question almost never
// will) -- same defaults the Market Sizing calculator itself starts with.
const DEFAULT_SIZING_CATEGORY = "bags";
const DEFAULT_SIZING_PRICE_POINT = 2500;

export interface DemoAnswer {
  answer: string;
  matchedPattern: string;
}

const EXPANSION_RE = /\b(expand(ing)?|expansion|enter(ing)?|launch(ing)?|open(ing)?\s+(a\s+)?store|move\s+into)\b/i;
const CHURN_RE = /\bchurn\b/i;
const MARGIN_RE = /\b(gross\s+)?margin\b/i;
const MARKET_NOUN_RE = /\b(market|country|countries|region|geograph\w*)\b/i;
const PERFORM_RE = /\b(best|top|perform\w*|highest|strongest|winning)\b/i;
const INFLUENCER_RE = /\binfluencer/i;
const ROI_RE = /\b(roi|return on investment|highest|best|top)\b/i;

export const DEMO_EXAMPLE_QUESTIONS = [
  "Which influencer gave the highest ROI?",
  "What is our gross margin?",
  "Which market performs best?",
  "What is our churn rate?",
  "Should we expand to Sweden?",
];

export function demoModeUnavailableMessage(): string {
  return [
    "I don't recognize this specific question in demo mode yet — right now I can reliably answer:",
    ...DEMO_EXAMPLE_QUESTIONS.map((q) => `• ${q}`),
    "",
    "Try rephrasing using one of these, or use the Filter Palette above to explore the data directly. When a real Claude API key with credits is added, free-form questions like this one will work automatically.",
  ].join("\n");
}

export async function tryDemoAnswer(query: string): Promise<DemoAnswer | null> {
  const q = query.toLowerCase();

  if (EXPANSION_RE.test(q)) {
    const country = SIZING_COUNTRIES.find((c) => q.includes(c.toLowerCase()));
    if (country) {
      return { answer: await answerExpansion(country), matchedPattern: "market-expansion" };
    }
    return {
      answer: `I can run a real Market Sizing model (TAM/SAM/SOM) for any of these markets: ${SIZING_COUNTRIES.join(", ")}. Ask e.g. "Should we expand to Sweden?" and I'll size the opportunity from real data.`,
      matchedPattern: "market-expansion-no-country",
    };
  }

  if (CHURN_RE.test(q)) {
    return { answer: await answerChurn(), matchedPattern: "churn-rate" };
  }

  if (MARGIN_RE.test(q)) {
    return { answer: await answerMargin(), matchedPattern: "gross-margin" };
  }

  if (MARKET_NOUN_RE.test(q) && PERFORM_RE.test(q)) {
    return { answer: await answerBestMarket(), matchedPattern: "best-market" };
  }

  if (INFLUENCER_RE.test(q) && ROI_RE.test(q)) {
    return { answer: await answerTopInfluencer(), matchedPattern: "top-influencer-roi" };
  }

  return null;
}

async function answerChurn(): Promise<string> {
  const m = await getRawPlatformMetrics();
  const churnRatePct = m.retentionRatePct !== null ? 100 - m.retentionRatePct : null;
  if (churnRatePct === null) {
    return "No real purchasing customers found to compute a churn rate from.";
  }
  const alertLine =
    churnRatePct > CHURN_ALERT_THRESHOLD_PCT
      ? `That's well above the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`
      : `That's within the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`;
  return [
    `Churn rate: ${churnRatePct.toFixed(1)}% — ${m.churnedCount} of ${m.totalCustomersWithPurchases} real customers haven't purchased in 90+ days, relative to the dataset's most recent activity.`,
    alertLine,
    `For reference, real published luxury retailers typically target a 25–35% repeat-purchase rate but often measure far lower in practice (as low as 9.9% per industry reporting) — see Benchmark Intelligence for the full citation.`,
    `See the Churn Risk Model in Decision Intelligence for a full customer-level breakdown, or Customer Journey for the underlying segments.`,
  ].join(" ");
}

async function answerMargin(): Promise<string> {
  const m = await getRawPlatformMetrics();
  if (m.grossMarginPct === null) {
    return "No real finance data found to compute gross margin from.";
  }
  const vsAvg = m.grossMarginPct < 62 ? "below" : "above";
  return [
    `Gross margin: ${m.grossMarginPct.toFixed(1)}% — (€${Math.round(m.marginRevenue).toLocaleString()} revenue − €${Math.round(m.marginCogs).toLocaleString()} COGS) ÷ revenue, computed across every real channel and quarter in finance_channel.`,
    `That's ${vsAvg} the 62% luxury-apparel industry average (Recurve Capital / company filings) and below the 75% best-in-class figure for top-performing houses in leather goods and accessories — see Benchmark Intelligence for full sourcing.`,
    `See Finance Deep-Dive for the real channel-by-channel margin waterfall behind this number.`,
  ].join(" ");
}

async function answerBestMarket(): Promise<string> {
  // `country_performance_model` (the view the old free-form Claude prompt
  // also fed on) is a real, pre-existing bug: it collapses every row into a
  // single NULL-country aggregate rather than grouping by country -- not
  // something this feature caused, but not safe to surface literally to a
  // user either. `sales_events.country` is real, populated per-purchase
  // geography, so it's used directly here instead.
  const [countries] = await bigquery.query(`
    SELECT country, COUNT(*) AS events, SUM(revenue) AS total_revenue
    FROM \`${PROJECT}.sales_events\`
    WHERE event_name = 'purchase' AND revenue > 0 AND country IS NOT NULL
    GROUP BY country
    ORDER BY total_revenue DESC
  `);
  if (!countries.length) return "No real country-level revenue data found.";
  const [top, second, third] = countries;
  const lines = [
    `Best-performing market: ${top.country} — €${Math.round(top.total_revenue).toLocaleString()} real purchase revenue across ${top.events.toLocaleString()} tracked orders, the highest of the ${countries.length} markets Maison Lumière tracks.`,
  ];
  if (second) {
    lines.push(
      `Runner-up: ${second.country} (€${Math.round(second.total_revenue).toLocaleString()})${third ? `, then ${third.country} (€${Math.round(third.total_revenue).toLocaleString()})` : ""}.`
    );
  }
  lines.push(`See Store Performance or Wholesale Intelligence for the channel-level breakdown behind these numbers.`);
  return lines.join(" ");
}

async function answerTopInfluencer(): Promise<string> {
  const [rows] = await bigquery.query(`
    SELECT influencer, product_slug, platform, total_revenue, gifted_cost, roi_pct
    FROM \`${PROJECT}.influencer_product_performance\`
    ORDER BY roi_pct DESC
    LIMIT 5
  `);
  if (!rows.length) return "No real campaign performance data found.";
  const [top, second, third] = rows;
  const lines = [
    `Highest ROI: ${top.influencer} on the "${top.product_slug}" campaign (${top.platform}) — ${top.roi_pct.toFixed(1)}% ROI, €${Math.round(top.total_revenue).toLocaleString()} revenue from €${Math.round(top.gifted_cost).toLocaleString()} gifted cost.`,
  ];
  if (second) {
    lines.push(
      `Next best: ${second.influencer} on ${second.product_slug} (${second.roi_pct.toFixed(1)}%)${third ? `, then ${third.influencer} on ${third.product_slug} (${third.roi_pct.toFixed(1)}%)` : ""}.`
    );
  }
  lines.push(`See Influencer ROI for the full campaign-by-campaign breakdown.`);
  return lines.join(" ");
}

async function answerExpansion(country: string): Promise<string> {
  const result = await computeMarketSizing({
    country,
    category: DEFAULT_SIZING_CATEGORY,
    pricePoint: DEFAULT_SIZING_PRICE_POINT,
  });
  return [
    `Market Sizing for ${country} (using default assumptions — "${DEFAULT_SIZING_CATEGORY}" category at a €${DEFAULT_SIZING_PRICE_POINT.toLocaleString()} price point, since no category or price was specified; adjust these on the Market Sizing calculator in Decision Intelligence for a different scenario):`,
    `TAM ≈ €${result.tam.toLocaleString()}/year · SAM ≈ €${result.sam.toLocaleString()} · SOM ≈ €${result.som.toLocaleString()}.`,
    ...result.methodology,
  ].join("\n\n");
}
