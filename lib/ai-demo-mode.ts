// Server-only: the AI Search "demo mode" fallback. When the real Claude API
// is unavailable (no ANTHROPIC_API_KEY, or the account has no credits --
// exactly the situation this platform has been in since Pass 7), the AI
// Search box in Command Center still needs to answer the handful of
// questions any demo audience actually asks in the first 30 seconds. This
// engine does that with plain keyword pattern-matching over real BigQuery
// data -- no model call, no cost, no "AI unavailable" dead end.
//
// This is deliberately NOT a general-purpose NL→SQL engine. It recognizes
// ten real question shapes and answers each from the exact same real
// computations already used elsewhere in the platform (getRawPlatformMetrics
// for margin/churn, computeMarketSizing for expansion,
// getSellThroughSummary/getGmroiSummary/getReturnsSummary/getEoqSummary/
// getGrowthBridgeSummary for their respective Decision Intelligence
// calculators), so a demo-mode answer is never a different number than the
// equivalent page would show. Anything it doesn't recognize gets an honest
// "here's what I can answer" message instead of a guess.
//
// Routing: incoming questions go through classifyQuery() first -- Anthropic's
// "Building Effective Agents" routing pattern (see
// https://www.anthropic.com/engineering/building-effective-agents) -- which
// sorts a question into one of four categories (kpi_lookup / reorder /
// scenario / general_search) before any answer logic runs, instead of
// falling through one long if/else chain. classifyQuery() tries three tiers
// in order: real Claude Haiku (ANTHROPIC_API_KEY, the paid real-client tier),
// then real Gemini via Google AI Studio (GEMINI_API_KEY, free -- see
// lib/gemini-server.ts), then classifyWithRules() -- the exact same regex
// priority order this file used before routing existed, so every question
// this platform could already answer keeps answering identically no matter
// which tier is active. Each category's handler then does its own (smaller,
// scoped) regex dispatch to pick the specific real computation to run,
// reusing the answerXxx() functions below unchanged.
//
// Deliberately does NOT suggest actions or recommendations of any kind.
// This platform's job is to surface real data, real calculations, and real
// benchmarks -- it never tells a person what to do with them. That decision
// belongs to whoever's reading the numbers, not to this engine. (An earlier
// pass here briefly added a "recommendedAction" field, Sana-inspired; it was
// removed after review as being exactly the kind of thing this platform
// should not do.)
import Anthropic from "@anthropic-ai/sdk";
import { isGeminiConfigured, classifyWithGemini } from "@/lib/gemini-server";
import { bigquery } from "@/lib/bigquery";
import { getRawPlatformMetrics } from "@/lib/benchmarks-server";
import { computeMarketSizing, POPULATION, SIZING_COUNTRIES } from "@/lib/market-sizing-server";
import { getSellThroughSummary } from "@/lib/sell-through-server";
import { getGmroiSummary } from "@/lib/gmroi-server";
import { getReturnsSummary } from "@/lib/returns-server";
import { getEoqSummary } from "@/lib/eoq-server";
import { getGrowthBridgeSummary } from "@/lib/growth-bridge-server";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/ai-demo-questions";
import { quarterToRange } from "@/lib/intelligence";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const CHURN_ALERT_THRESHOLD_PCT = 30; // same threshold used by the Executive Summary insight engine

// Defaults used when a demo question implies a market-sizing run but doesn't
// specify a category/price point (a natural-language question almost never
// will) -- same defaults the Market Sizing calculator itself starts with.
const DEFAULT_SIZING_CATEGORY = "bags";
const DEFAULT_SIZING_PRICE_POINT = 2500;

// Same 5 real product categories the EOQ/GMROI/Sell-Through calculators use
// (source of truth: the CATEGORIES constant in app/decision-intelligence) --
// needed here to pull a category out of a free-form reorder question.
const DEMO_CATEGORIES = ["bags", "dresses", "knitwear", "outerwear", "tops"];

// A small structured fact to render as a stat card next to the prose answer
// (Command Center's "Ask" panel) -- e.g. { label: "Churn rate", value: "18.3%" }.
// Always derived from the exact same numbers already in the prose, never a
// separate computation, so the card and the sentence can never disagree.
export interface StatItem {
  label: string;
  value: string;
}

export interface DemoAnswer {
  answer: string;
  matchedPattern: string;
  stats?: StatItem[];
  category?: QueryCategory;
  classificationConfidence?: number;
}

// The subset of Command Center's active Filter Palette selections that AI
// answers can honestly act on. Deliberately narrow: not every filter
// dimension has a matching column in every source table (see the per-metric
// notes below), and threading a filter that doesn't exist in the underlying
// table would mean either silently ignoring it or fabricating a number --
// both worse than just saying so.
//
// Note on "campaign": this dataset has no separate campaign_id/campaign_name
// column anywhere -- a campaign IS one influencer + one product + one
// post_date row in influencer_product_performance (confirmed directly
// against the live schema). So there's no distinct "campaign" filter here;
// filtering by influencer (optionally + product) already scopes to a
// specific real campaign, which is what `influencer` below is for.
export interface AiFilters {
  country?: string;
  product?: string; // product_slug
  influencer?: string;
  quarter?: string; // one of TIME_PERIODS, e.g. "Q2 2026" -- the "date span" filter
}

const NO_FILTERS: AiFilters = {};

const EXPANSION_RE = /\b(expand(ing)?|expansion|enter(ing)?|launch(ing)?|open(ing)?\s+(a\s+)?store|move\s+into)\b/i;
const CHURN_RE = /\bchurn\b/i;
const MARGIN_RE = /\b(gross\s+)?margin\b/i;
const MARKET_NOUN_RE = /\b(market|country|countries|region|geograph\w*)\b/i;
const PERFORM_RE = /\b(best|top|perform\w*|highest|strongest|winning)\b/i;
const INFLUENCER_RE = /\binfluencer/i;
const ROI_RE = /\b(roi|return on investment|highest|best|top)\b/i;
const SELL_THROUGH_RE = /\bsell[\s-]?through\b/i;
const GMROI_RE = /\bgmroi\b/i;
const RETURNS_RE = /\breturns?\b/i;
const REORDER_RE = /\b(reorder|re-order|eoq|economic order quantity|how much should we order)\b/i;
const REVENUE_DRIVER_RE = /\b(why\s+(did|has|is|does)\s+(the\s+)?revenue|revenue\s+(driver|drivers|drop|dropped|decline|declined|fell|fall|increase|increased|grow|grew|growth|change|changed)|driver[s]?\s+(of|behind)\s+revenue|what\s+(drove|caused|explains)\s+(the\s+)?revenue)\b/i;

export { DEMO_EXAMPLE_QUESTIONS };

export function demoModeUnavailableMessage(): string {
  return [
    "I don't recognize this specific question in demo mode yet — right now I can reliably answer:",
    ...DEMO_EXAMPLE_QUESTIONS.map((q) => `• ${q}`),
    "",
    "Try rephrasing using one of these, or use the Filter Palette above to explore the data directly. When a real Claude API key with credits is added, free-form questions like this one will work automatically.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Routing step (Anthropic "Building Effective Agents" routing pattern)
// ---------------------------------------------------------------------------

export type QueryCategory = "kpi_lookup" | "reorder" | "scenario" | "general_search";

export interface QueryClassification {
  category: QueryCategory;
  confidence: number; // 0..1
  method: "llm-anthropic" | "llm-gemini" | "fallback-rules";
}

const VALID_CATEGORIES: QueryCategory[] = ["kpi_lookup", "reorder", "scenario", "general_search"];
// Below this, the LLM classifier itself isn't sure enough to route to a
// specific handler -- safer to say "I don't recognize this" than to guess
// and risk running the wrong calculator.
const CONFIDENCE_FLOOR = 0.6;
// Small, cheap model -- classification is a one-word decision, not a task
// that needs Sonnet-level reasoning. See lib/eoq-server.ts / DATA_AUDIT.md
// for the cost discussion behind keeping this on the cheapest tier.
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";

const CLASSIFY_SYSTEM_PROMPT = `You are a query router for a fashion-brand analytics platform. Classify the user's question into exactly one category:
- kpi_lookup: asks for a specific named metric (GMROI, sell-through, CLV, ROAS, gross margin, churn rate, ROI, revenue by market, etc.)
- reorder: asks about order quantity, reorder point, or EOQ for a product category
- scenario: a hypothetical "what if" question (market expansion/entry, a pricing change, a budget shift, pausing an influencer)
- general_search: anything else -- product, influencer, or customer lookups that are not a single named KPI

Respond with ONLY a JSON object and nothing else: {"category": "kpi_lookup" | "reorder" | "scenario" | "general_search", "confidence": <number between 0 and 1>}`;

// Classifies a question into one of the four routing categories, trying
// three tiers in order and never throwing or blocking the query:
//   1. Real Claude Haiku (only if ANTHROPIC_API_KEY is set -- the paid,
//      real-client tier)
//   2. Real Gemini via Google AI Studio (only if GEMINI_API_KEY is set --
//      genuinely free, see lib/gemini-server.ts for the terms this relies
//      on)
//   3. classifyWithRules() -- deterministic regex fallback, always available
// Each tier's own function returns null (never throws) on any failure --
// bad/missing key, unparseable response, rate limit, network error -- so
// classifyQuery just falls to the next tier down.
export async function classifyQuery(question: string): Promise<QueryClassification> {
  if (process.env.ANTHROPIC_API_KEY) {
    const result = await classifyWithAnthropic(question);
    if (result) {
      if (result.confidence < CONFIDENCE_FLOOR) {
        return { category: "general_search", confidence: result.confidence, method: "llm-anthropic" };
      }
      return { category: result.category, confidence: result.confidence, method: "llm-anthropic" };
    }
  }

  if (isGeminiConfigured()) {
    const result = await classifyWithGemini(question);
    if (result) {
      if (result.confidence < CONFIDENCE_FLOOR) {
        return { category: "general_search", confidence: result.confidence, method: "llm-gemini" };
      }
      return { category: result.category, confidence: result.confidence, method: "llm-gemini" };
    }
  }

  return classifyWithRules(question);
}

async function classifyWithAnthropic(question: string): Promise<{ category: QueryCategory; confidence: number } | null> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 60,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    });
    const raw = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("")
      .trim();
    return parseClassificationJson(raw);
  } catch (error) {
    console.error("CLASSIFY QUERY ERROR (Anthropic, falling back to Gemini/rules):", error);
    return null;
  }
}

function parseClassificationJson(raw: string): { category: QueryCategory; confidence: number } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]);
    if (!VALID_CATEGORIES.includes(obj.category) || typeof obj.confidence !== "number") return null;
    return { category: obj.category, confidence: Math.max(0, Math.min(1, obj.confidence)) };
  } catch {
    return null;
  }
}

// Deterministic fallback classifier. This is exactly the priority order
// tryDemoAnswer used before routing existed (reorder, then expansion, then
// the KPI regexes, then general_search) -- so every question this platform
// could already answer routes to the same category, and answers stay
// unchanged, whenever the LLM classifier is unavailable.
function classifyWithRules(question: string): QueryClassification {
  const q = question.toLowerCase();
  if (REORDER_RE.test(q)) return { category: "reorder", confidence: 1, method: "fallback-rules" };
  if (EXPANSION_RE.test(q)) return { category: "scenario", confidence: 1, method: "fallback-rules" };
  if (
    CHURN_RE.test(q) ||
    MARGIN_RE.test(q) ||
    SELL_THROUGH_RE.test(q) ||
    GMROI_RE.test(q) ||
    RETURNS_RE.test(q) ||
    REVENUE_DRIVER_RE.test(q) ||
    (INFLUENCER_RE.test(q) && ROI_RE.test(q)) ||
    (MARKET_NOUN_RE.test(q) && PERFORM_RE.test(q))
  ) {
    return { category: "kpi_lookup", confidence: 1, method: "fallback-rules" };
  }
  return { category: "general_search", confidence: 1, method: "fallback-rules" };
}

// ---------------------------------------------------------------------------
// Dispatch: classify, log, then route to the category's handler
// ---------------------------------------------------------------------------

export async function tryDemoAnswer(query: string, filters: AiFilters = NO_FILTERS): Promise<DemoAnswer | null> {
  const classification = await classifyQuery(query);
  // Simple console.log per the platform's existing logging convention (no
  // query_log table/pattern exists yet in BigQuery or Supabase) -- enough to
  // see router performance in the Vercel/dev logs without adding new infra
  // for a demo-mode feature.
  console.log(
    `[ai-demo-mode] classified query: category=${classification.category} confidence=${classification.confidence.toFixed(2)} method=${classification.method} filters=${JSON.stringify(filters)} query="${query}"`
  );

  switch (classification.category) {
    case "reorder":
      return handleReorder(query, classification);
    case "scenario":
      return handleScenario(query, classification);
    case "kpi_lookup":
      return handleKpiLookup(query, classification, filters);
    case "general_search":
    default:
      return handleGeneralSearch(query, classification);
  }
}

async function handleReorder(query: string, c: QueryClassification): Promise<DemoAnswer> {
  const q = query.toLowerCase();
  const category = DEMO_CATEGORIES.find((cat) => q.includes(cat));
  if (category) {
    const { answer, stats } = await answerReorder(category);
    return { answer, stats, matchedPattern: "reorder-eoq", category: c.category, classificationConfidence: c.confidence };
  }
  return {
    answer: `I can run a real EOQ (economic order quantity) model for any of these categories: ${DEMO_CATEGORIES.join(", ")}. Ask e.g. "How much should we reorder for bags?" and I'll size it from real sales and supplier data.`,
    matchedPattern: "reorder-eoq-no-category",
    category: c.category,
    classificationConfidence: c.confidence,
  };
}

async function handleScenario(query: string, c: QueryClassification): Promise<DemoAnswer> {
  const q = query.toLowerCase();
  const country = SIZING_COUNTRIES.find((cty) => q.includes(cty.toLowerCase()));
  if (country) {
    const { answer, stats } = await answerExpansion(country);
    return { answer, stats, matchedPattern: "market-expansion", category: c.category, classificationConfidence: c.confidence };
  }
  return {
    answer: `I can run a real Market Sizing model (TAM/SAM/SOM) for any of these markets: ${SIZING_COUNTRIES.join(", ")}. Ask e.g. "Should we expand to Sweden?" and I'll size the opportunity from real data. (Pricing, budget-shift, and influencer-pause scenarios aren't backed by a real calculator yet -- only market expansion is.)`,
    matchedPattern: "scenario-not-recognized",
    category: c.category,
    classificationConfidence: c.confidence,
  };
}

async function handleKpiLookup(query: string, c: QueryClassification, filters: AiFilters): Promise<DemoAnswer> {
  const q = query.toLowerCase();
  const meta = { category: c.category, classificationConfidence: c.confidence };

  if (CHURN_RE.test(q)) {
    const { answer, stats } = await answerChurn(filters);
    return { answer, stats, matchedPattern: "churn-rate", ...meta };
  }
  if (MARGIN_RE.test(q)) {
    const { answer, stats } = await answerMargin(filters);
    return { answer, stats, matchedPattern: "gross-margin", ...meta };
  }
  if (MARKET_NOUN_RE.test(q) && PERFORM_RE.test(q)) {
    const { answer, stats } = await answerBestMarket(filters);
    return { answer, stats, matchedPattern: "best-market", ...meta };
  }
  if (INFLUENCER_RE.test(q) && ROI_RE.test(q)) {
    const { answer, stats } = await answerTopInfluencer(filters);
    return { answer, stats, matchedPattern: "top-influencer-roi", ...meta };
  }
  if (SELL_THROUGH_RE.test(q)) {
    const { answer, stats } = await answerSellThrough(filters);
    return { answer, stats, matchedPattern: "sell-through", ...meta };
  }
  if (GMROI_RE.test(q)) {
    const { answer, stats } = await answerGmroi(filters);
    return { answer, stats, matchedPattern: "gmroi", ...meta };
  }
  if (RETURNS_RE.test(q)) {
    const { answer, stats } = await answerReturns(filters);
    return { answer, stats, matchedPattern: "returns", ...meta };
  }
  if (REVENUE_DRIVER_RE.test(q)) {
    const { answer, stats } = await answerRevenueDriver(filters);
    return { answer, stats, matchedPattern: "revenue-driver", ...meta };
  }

  // The LLM classifier can land a question here on meaning (e.g. a KPI
  // question phrased in Swedish, or with a synonym) even when none of the
  // regexes above match a specific computation -- classifyWithRules can't
  // produce this case, since it uses this exact same regex set to decide
  // kpi_lookup in the first place. Honest fallback rather than a guess.
  return { answer: demoModeUnavailableMessage(), matchedPattern: "kpi-lookup-unrecognized", ...meta };
}

// Resolves a product_slug filter to its real category (product_lifecycle),
// used by every KPI that's computed per-category (GMROI, sell-through) but
// filterable per-product in Command Center. Returns null if the slug isn't
// real -- callers treat that as "filter doesn't apply," not an error.
async function resolveProductCategory(productSlug: string): Promise<string | null> {
  const [rows] = await bigquery.query({
    query: `SELECT category FROM \`${PROJECT}.product_lifecycle\` WHERE product_slug = @slug LIMIT 1`,
    params: { slug: productSlug },
    types: { slug: "STRING" },
  });
  return rows[0]?.category ?? null;
}

async function handleGeneralSearch(query: string, c: QueryClassification): Promise<DemoAnswer> {
  // No dedicated general-search computation exists yet (that would need its
  // own real engine, out of scope here) -- same honest fallback message
  // every unmatched question got before routing existed.
  return {
    answer: demoModeUnavailableMessage(),
    matchedPattern: "general-search",
    category: c.category,
    classificationConfidence: c.confidence,
  };
}

interface AnswerWithStats {
  answer: string;
  stats: StatItem[];
}

async function answerChurn(filters: AiFilters): Promise<AnswerWithStats> {
  // Product doesn't apply to churn (a customer-level behavior metric, not a
  // product-level one) -- noted honestly rather than silently ignored if set.
  const productNote = filters.product
    ? " (Note: a product filter is active, but churn is a customer-level metric with no product dimension in this dataset — showing all customers instead.)"
    : "";

  if (filters.country) {
    return answerChurnForCountry(filters.country, productNote);
  }

  const m = await getRawPlatformMetrics();
  const churnRatePct = m.retentionRatePct !== null ? 100 - m.retentionRatePct : null;
  if (churnRatePct === null) {
    return { answer: "No real purchasing customers found to compute a churn rate from.", stats: [] };
  }
  const alertLine =
    churnRatePct > CHURN_ALERT_THRESHOLD_PCT
      ? `That's well above the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`
      : `That's within the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`;
  const answer = [
    `Churn rate: ${churnRatePct.toFixed(1)}% — ${m.churnedCount} of ${m.totalCustomersWithPurchases} real customers haven't purchased in 90+ days, relative to the dataset's most recent activity.${productNote}`,
    alertLine,
    `For reference, real published luxury retailers typically target a 25–35% repeat-purchase rate but often measure far lower in practice (as low as 9.9% per industry reporting) — see Benchmark Intelligence for the full citation.`,
    `See the Churn Risk Model in Decision Intelligence for a full customer-level breakdown, or Customer Journey for the underlying segments.`,
  ].join(" ");
  const stats: StatItem[] = [
    { label: "Churn rate", value: `${churnRatePct.toFixed(1)}%` },
    { label: "Churned customers", value: `${m.churnedCount} / ${m.totalCustomersWithPurchases}` },
    { label: "Alert threshold", value: `${CHURN_ALERT_THRESHOLD_PCT}%` },
  ];
  return { answer, stats };
}

// Real country-filtered churn: joins sales_events (per-purchase activity) to
// crm_customers.country (a real column) on the same customer_id convention
// already used platform-wide (e.g. lib/growth-bridge-server.ts). Uses the
// dataset's GLOBAL most-recent purchase date as "now" (not that country's own
// latest purchase) so "90+ days inactive" means the same thing in every
// country -- a country with generally older orders shouldn't look artificially
// low-churn just because its own activity trails off earlier.
async function answerChurnForCountry(country: string, productNote: string): Promise<AnswerWithStats> {
  const [[rows], [globalMaxRows]] = await Promise.all([
    bigquery.query({
      query: `
        SELECT s.user_pseudo_id AS customer_id, DATE(s.event_timestamp) AS purchase_date
        FROM \`${PROJECT}.sales_events\` s
        JOIN \`${PROJECT}.crm_customers\` c ON c.customer_id = s.user_pseudo_id
        WHERE s.event_name = 'purchase' AND s.revenue > 0 AND c.country = @country
      `,
      params: { country },
      types: { country: "STRING" },
    }),
    bigquery.query(`SELECT MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\` WHERE event_name = 'purchase' AND revenue > 0`),
  ]);

  if (!rows.length) {
    return { answer: `No real purchase history found for customers in ${country}.`, stats: [] };
  }

  const globalMaxDate = new Date(globalMaxRows[0]?.max_date?.value ?? globalMaxRows[0]?.max_date);
  const lastPurchaseByCustomer = new Map<string, Date>();
  rows.forEach((r: any) => {
    const d = new Date(typeof r.purchase_date === "string" ? r.purchase_date : r.purchase_date.value);
    const existing = lastPurchaseByCustomer.get(r.customer_id);
    if (!existing || d > existing) lastPurchaseByCustomer.set(r.customer_id, d);
  });
  // Same 90-day-inactivity definition as getRawPlatformMetrics's
  // CHURN_WINDOW_DAYS (that constant lives in lib/benchmarks-server.ts,
  // not duplicated here as a shared import since this file already has its
  // own CHURN_ALERT_THRESHOLD_PCT for a different purpose -- the alert
  // line, not the churn window itself).
  let churnedCount = 0;
  lastPurchaseByCustomer.forEach((lastDate) => {
    const days = (globalMaxDate.getTime() - lastDate.getTime()) / 86400000;
    if (days > 90) churnedCount++;
  });
  const totalCustomers = lastPurchaseByCustomer.size;
  const churnRatePct = (churnedCount / totalCustomers) * 100;

  const answer = [
    `Churn rate for ${country}: ${churnRatePct.toFixed(1)}% — ${churnedCount} of ${totalCustomers} real customers in ${country} haven't purchased in 90+ days, relative to the platform's most recent activity.${productNote}`,
    churnRatePct > CHURN_ALERT_THRESHOLD_PCT
      ? `That's above the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`
      : `That's within the ${CHURN_ALERT_THRESHOLD_PCT}% internal alert threshold used across this platform.`,
    `See the Churn Risk Model in Decision Intelligence for a full customer-level breakdown (not currently filterable by country there).`,
  ].join(" ");
  const stats: StatItem[] = [
    { label: `Churn rate (${country})`, value: `${churnRatePct.toFixed(1)}%` },
    { label: "Churned customers", value: `${churnedCount} / ${totalCustomers}` },
    { label: "Alert threshold", value: `${CHURN_ALERT_THRESHOLD_PCT}%` },
  ];
  return { answer, stats };
}

async function answerMargin(filters: AiFilters): Promise<AnswerWithStats> {
  // Company-wide gross margin comes from finance_channel, which is only
  // broken out by channel and quarter -- no country column, no product/
  // category column, anywhere in that table. There's no real join path to
  // get country-level margin (nothing else in the schema carries COGS by
  // country either), so a country filter genuinely can't be honored here --
  // said plainly rather than silently showing the unfiltered number.
  if (filters.country) {
    const m = await getRawPlatformMetrics();
    const base = m.grossMarginPct !== null ? `${m.grossMarginPct.toFixed(1)}%` : "not computable";
    return {
      answer: `Gross margin isn't tracked by country in this dataset — finance_channel (the real source for this number) only has channel and quarter, no country column, and no other real table carries COGS by country either. Showing the company-wide figure instead: ${base}. See Finance Deep-Dive for the real channel-by-channel breakdown that does exist.`,
      stats: m.grossMarginPct !== null ? [{ label: "Gross margin (company-wide)", value: base }] : [],
    };
  }

  // A product filter DOES have a real path: product_lifecycle has real
  // retail_price/cost_price/category per product, so the product's category
  // gets a real margin % -- a different (and more granular) real number than
  // the finance_channel-based company-wide figure, not a substitute for it.
  if (filters.product) {
    const category = await resolveProductCategory(filters.product);
    if (category) {
      return answerMarginForCategory(category, filters.product);
    }
    // Filter didn't resolve to a real product -- fall through to the
    // unfiltered answer rather than pretending the filter applied.
  }

  const m = await getRawPlatformMetrics();
  if (m.grossMarginPct === null) {
    return { answer: "No real finance data found to compute gross margin from.", stats: [] };
  }
  const vsAvg = m.grossMarginPct < 62 ? "below" : "above";
  const answer = [
    `Gross margin: ${m.grossMarginPct.toFixed(1)}% — (€${Math.round(m.marginRevenue).toLocaleString()} revenue − €${Math.round(m.marginCogs).toLocaleString()} COGS) ÷ revenue, computed across every real channel and quarter in finance_channel.`,
    `That's ${vsAvg} the 62% luxury-apparel industry average (Recurve Capital / company filings) and below the 75% best-in-class figure for top-performing houses in leather goods and accessories — see Benchmark Intelligence for full sourcing.`,
    `See Finance Deep-Dive for the real channel-by-channel margin waterfall behind this number.`,
  ].join(" ");
  const stats: StatItem[] = [
    { label: "Gross margin", value: `${m.grossMarginPct.toFixed(1)}%` },
    { label: "Revenue", value: `€${Math.round(m.marginRevenue).toLocaleString()}` },
    { label: "COGS", value: `€${Math.round(m.marginCogs).toLocaleString()}` },
    { label: "Industry avg.", value: "62%" },
  ];
  return { answer, stats };
}

// Real product-level margin, from product_lifecycle (retail_price,
// cost_price, units_sold_direct) -- a genuinely different, more granular
// real computation than finance_channel's company-wide figure, used only
// when a product filter is active and resolves to a real category.
async function answerMarginForCategory(category: string, productSlug: string): Promise<AnswerWithStats> {
  const [rows] = await bigquery.query({
    query: `
      SELECT SUM(retail_price * units_sold_direct) AS revenue, SUM(cost_price * units_sold_direct) AS cost
      FROM \`${PROJECT}.product_lifecycle\`
      WHERE category = @category
    `,
    params: { category },
    types: { category: "STRING" },
  });
  const revenue = rows[0]?.revenue ?? 0;
  const cost = rows[0]?.cost ?? 0;
  const marginPct = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null;

  const answer = [
    `Company-wide gross margin (finance_channel) isn't broken out by product or category — but "${productSlug}" belongs to the ${category} category, which has its own real margin from product_lifecycle: ${marginPct !== null ? `${marginPct.toFixed(1)}%` : "not computable"} (€${Math.round(revenue).toLocaleString()} retail revenue − €${Math.round(cost).toLocaleString()} cost).`,
    `This is a different (and more granular) real number than the finance_channel-based company-wide figure — not a substitute for it. See GMROI or Pricing Intelligence in Decision Intelligence for the full category breakdown.`,
  ].join(" ");
  const stats: StatItem[] =
    marginPct !== null
      ? [
          { label: `Margin (${category})`, value: `${marginPct.toFixed(1)}%` },
          { label: "Retail revenue", value: `€${Math.round(revenue).toLocaleString()}` },
          { label: "Cost", value: `€${Math.round(cost).toLocaleString()}` },
        ]
      : [];
  return { answer, stats };
}

async function answerBestMarket(filters: AiFilters): Promise<AnswerWithStats> {
  // `country_performance_model` (the view the old free-form Claude prompt
  // also fed on) is a real, pre-existing bug: it collapses every row into a
  // single NULL-country aggregate rather than grouping by country -- not
  // something this feature caused, but not safe to surface literally to a
  // user either. `sales_events.country` is real, populated per-purchase
  // geography, so it's used directly here instead. sales_events also has a
  // real product_slug, so a product filter scopes this to just that
  // product's country breakdown -- a real, different (smaller) real query,
  // not the same number re-labeled.
  const [countries] = await bigquery.query({
    query: `
      SELECT country, COUNT(*) AS events, SUM(revenue) AS total_revenue
      FROM \`${PROJECT}.sales_events\`
      WHERE event_name = 'purchase' AND revenue > 0 AND country IS NOT NULL
      ${filters.product ? "AND product_slug = @product" : ""}
      GROUP BY country
      ORDER BY total_revenue DESC
    `,
    params: filters.product ? { product: filters.product } : {},
    types: filters.product ? { product: "STRING" } : {},
  });
  const productNote = filters.product ? ` (filtered to "${filters.product}")` : "";
  if (!countries.length) {
    return { answer: `No real country-level revenue data found${productNote}.`, stats: [] };
  }
  const [top, second, third] = countries;

  // Country filter: don't just repeat the global top market -- show where
  // the filtered country actually ranks, which is the whole point of asking
  // this question with a filter active.
  if (filters.country) {
    const idx = countries.findIndex((c: any) => c.country === filters.country);
    if (idx === -1) {
      return { answer: `No real revenue found for ${filters.country}${productNote}.`, stats: [] };
    }
    const row = countries[idx];
    const answer = [
      `${filters.country}${productNote} ranks #${idx + 1} of ${countries.length} markets: €${Math.round(row.total_revenue).toLocaleString()} real purchase revenue across ${row.events.toLocaleString()} tracked orders.`,
      idx === 0
        ? `That makes it the best-performing market${productNote}.`
        : `The top market${productNote} is ${top.country} (€${Math.round(top.total_revenue).toLocaleString()}).`,
      `See Store Performance or Wholesale Intelligence for the channel-level breakdown behind these numbers.`,
    ].join(" ");
    const stats: StatItem[] = [
      { label: `${filters.country} rank`, value: `#${idx + 1} of ${countries.length}` },
      { label: "Revenue", value: `€${Math.round(row.total_revenue).toLocaleString()}` },
      { label: "Orders", value: row.events.toLocaleString() },
    ];
    return { answer, stats };
  }

  const lines = [
    `Best-performing market${productNote}: ${top.country} — €${Math.round(top.total_revenue).toLocaleString()} real purchase revenue across ${top.events.toLocaleString()} tracked orders, the highest of the ${countries.length} markets${productNote ? " selling this product" : " Maison Lumière tracks"}.`,
  ];
  if (second) {
    lines.push(
      `Runner-up: ${second.country} (€${Math.round(second.total_revenue).toLocaleString()})${third ? `, then ${third.country} (€${Math.round(third.total_revenue).toLocaleString()})` : ""}.`
    );
  }
  lines.push(`See Store Performance or Wholesale Intelligence for the channel-level breakdown behind these numbers.`);
  const stats: StatItem[] = [
    { label: "Top market", value: top.country },
    { label: "Revenue", value: `€${Math.round(top.total_revenue).toLocaleString()}` },
    { label: "Orders", value: top.events.toLocaleString() },
    { label: "Markets tracked", value: `${countries.length}` },
  ];
  return { answer: lines.join(" "), stats };
}

async function answerTopInfluencer(filters: AiFilters): Promise<AnswerWithStats> {
  // influencer_product_performance has real `country`, `product_slug`,
  // `influencer`, and `post_date` columns (confirmed against the live
  // schema) -- all four filters apply as real WHERE clauses. `quarter`
  // (the "date span" filter) reuses quarterToRange(), the exact same
  // quarter -> real date-range conversion the Filter Palette's own
  // time_period dimension already uses elsewhere, so a quarter filter here
  // means the same real date range it would mean anywhere else in the app.
  const whereClauses: string[] = [];
  // Mixed value types (plain strings for STRING params, BigQueryDate objects
  // for the date range below) -- `any` here, not a shortcut, since the
  // client library's own param value type is a union across these.
  const params: Record<string, any> = {};
  const types: Record<string, string> = {};
  if (filters.country) {
    whereClauses.push("country = @country");
    params.country = filters.country;
    types.country = "STRING";
  }
  if (filters.product) {
    whereClauses.push("product_slug = @product");
    params.product = filters.product;
    types.product = "STRING";
  }
  if (filters.influencer) {
    whereClauses.push("influencer = @influencer");
    params.influencer = filters.influencer;
    types.influencer = "STRING";
  }
  if (filters.quarter) {
    // IMPORTANT: passing a plain date string here with types.x = "DATE"
    // silently returns zero rows (verified directly -- no error, just an
    // empty result) -- confirmed this is a real quirk of this BigQuery
    // client version, not a one-off. bigquery.date(...) is the version that
    // actually works; no `types` entry needed for these two params since
    // the wrapper carries its own type.
    const { start, end } = quarterToRange(filters.quarter);
    whereClauses.push("post_date BETWEEN @dateStart AND @dateEnd");
    params.dateStart = bigquery.date(start);
    params.dateEnd = bigquery.date(end);
  }
  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const filterParts = [filters.influencer, filters.product, filters.country, filters.quarter].filter(Boolean);
  const filterNote = filterParts.length ? ` (filtered to ${filterParts.join(", ")})` : "";

  const [rows] = await bigquery.query({
    query: `
      SELECT influencer, product_slug, platform, total_revenue, gifted_cost, roi_pct, post_date
      FROM \`${PROJECT}.influencer_product_performance\`
      ${where}
      ORDER BY roi_pct DESC
      LIMIT 5
    `,
    params,
    types,
  });
  if (!rows.length) return { answer: `No real campaign performance data found${filterNote}.`, stats: [] };
  const [top, second, third] = rows;

  // A single-influencer (or single-influencer+product) filter narrows this
  // to one specific real campaign, not a top-5 ranking -- phrased as that,
  // not as "highest ROI" when there's nothing left to rank against.
  const isSingleCampaign = !!filters.influencer && (rows.length === 1 || !!filters.product);
  const lines = isSingleCampaign
    ? [
        `${top.influencer}'s "${top.product_slug}" campaign${filterNote}: ${top.roi_pct.toFixed(1)}% ROI, €${Math.round(top.total_revenue).toLocaleString()} revenue from €${Math.round(top.gifted_cost).toLocaleString()} gifted cost, posted ${typeof top.post_date === "string" ? top.post_date : top.post_date?.value}.`,
      ]
    : [`Highest ROI${filterNote}: ${top.influencer} on the "${top.product_slug}" campaign (${top.platform}) — ${top.roi_pct.toFixed(1)}% ROI, €${Math.round(top.total_revenue).toLocaleString()} revenue from €${Math.round(top.gifted_cost).toLocaleString()} gifted cost.`];
  if (!isSingleCampaign && second) {
    lines.push(
      `Next best: ${second.influencer} on ${second.product_slug} (${second.roi_pct.toFixed(1)}%)${third ? `, then ${third.influencer} on ${third.product_slug} (${third.roi_pct.toFixed(1)}%)` : ""}.`
    );
  }
  lines.push(`See Influencer ROI for the full campaign-by-campaign breakdown.`);
  const stats: StatItem[] = [
    { label: isSingleCampaign ? "Campaign ROI" : "Top influencer", value: isSingleCampaign ? `${top.roi_pct.toFixed(1)}%` : top.influencer },
    ...(isSingleCampaign ? [] : [{ label: "ROI", value: `${top.roi_pct.toFixed(1)}%` }]),
    { label: "Revenue", value: `€${Math.round(top.total_revenue).toLocaleString()}` },
    { label: "Gifted cost", value: `€${Math.round(top.gifted_cost).toLocaleString()}` },
  ];
  return { answer: lines.join(" "), stats };
}

async function answerExpansion(country: string): Promise<AnswerWithStats> {
  const result = await computeMarketSizing({
    country,
    category: DEFAULT_SIZING_CATEGORY,
    pricePoint: DEFAULT_SIZING_PRICE_POINT,
  });
  const answer = [
    `Market Sizing for ${country} (using default assumptions — "${DEFAULT_SIZING_CATEGORY}" category at a €${DEFAULT_SIZING_PRICE_POINT.toLocaleString()} price point, since no category or price was specified; adjust these on the Market Sizing calculator in Decision Intelligence for a different scenario):`,
    `TAM ≈ €${result.tam.toLocaleString()}/year · SAM ≈ €${result.sam.toLocaleString()} · SOM ≈ €${result.som.toLocaleString()}.`,
    ...result.methodology,
  ].join("\n\n");
  const stats: StatItem[] = [
    { label: "TAM", value: `€${result.tam.toLocaleString()}` },
    { label: "SAM", value: `€${result.sam.toLocaleString()}` },
    { label: "SOM", value: `€${result.som.toLocaleString()}` },
  ];
  return { answer, stats };
}

async function answerSellThrough(filters: AiFilters): Promise<AnswerWithStats> {
  const s = await getSellThroughSummary();

  // Product filter: sell-through is computed per-category (product_lifecycle
  // has no country column, so that's genuinely the finest real grain
  // available) -- resolve the product to its real category and answer just
  // that row instead of the platform-wide blend.
  if (filters.product) {
    const category = await resolveProductCategory(filters.product);
    if (category) {
      const row = s.byCategory.find((c) => c.category === category);
      if (row) {
        const pct = typeof row.sellThroughPct === "number" ? `${row.sellThroughPct}%` : row.sellThroughPct;
        const answer = [
          `Sell-through for the ${category} category (product "${filters.product}" belongs here — sell-through isn't tracked per individual SKU, only per category): ${pct}, against the ${s.threshold}% flag threshold.`,
          row.belowThreshold ? `This is below the threshold — see the Sell-Through calculator for daysToDeplete velocity.` : `This is above the threshold.`,
          `See the Sell-Through calculator in Decision Intelligence for the full category/season/market breakdown.`,
        ].join(" ");
        const stats: StatItem[] = [
          { label: `Sell-through (${category})`, value: pct },
          { label: "Units sold", value: row.unitsSold.toLocaleString() },
          { label: "Units remaining", value: row.unitsRemaining.toLocaleString() },
        ];
        return { answer, stats };
      }
    }
  }

  // Country filter: product_lifecycle/inventory (the real source for
  // sell-through %) has no country column at all -- there's no real join
  // path to a country-level sell-through rate. sales_events does have a
  // real country breakdown of UNITS SOLD (already computed as s.byMarket),
  // which is an honest partial answer, not a substitute for the % itself.
  const countryNote = filters.country
    ? (() => {
        const market = s.byMarket.find((m) => m.country === filters.country);
        return market
          ? ` (Note: sell-through % isn't tracked by country in this dataset — inventory has no country column. What IS real: ${filters.country} accounts for ${market.unitsSold.toLocaleString()} units sold, ${market.shareOfTotalPct}% of total units across all markets.)`
          : ` (Note: sell-through % isn't tracked by country, and no real sales were found for ${filters.country}.)`;
      })()
    : "";

  const totalSold = s.byCategory.reduce((sum, c) => sum + c.unitsSold, 0);
  const totalAvailable = s.byCategory.reduce((sum, c) => sum + c.totalUnitsAvailable, 0);
  const overallPct = totalAvailable ? Math.round((totalSold / totalAvailable) * 1000) / 10 : null;
  const ranked = [...s.byCategory].sort((a, b) =>
    typeof b.sellThroughPct === "number" && typeof a.sellThroughPct === "number" ? b.sellThroughPct - a.sellThroughPct : 0
  );
  const below = s.byCategory.filter((c) => c.belowThreshold);

  const lines = [
    (overallPct !== null
      ? `Sell-through: ${overallPct}% overall (${totalSold.toLocaleString()} of ${totalAvailable.toLocaleString()} units sold), against the ${s.threshold}% flag threshold used across this platform.`
      : "Not enough real product/inventory data to compute an overall sell-through rate.") + countryNote,
  ];
  const top = ranked[0];
  if (top) {
    lines.push(`Best-selling category: ${top.category} at ${typeof top.sellThroughPct === "number" ? `${top.sellThroughPct}%` : top.sellThroughPct}.`);
  }
  lines.push(
    below.length
      ? `Below the ${s.threshold}% threshold: ${below.map((c) => `${c.category} (${c.sellThroughPct}%)`).join(", ")} — see the Sell-Through calculator for daysToDeplete velocity on each.`
      : `No category is currently flagged below the ${s.threshold}% threshold.`
  );
  lines.push(`See the Sell-Through calculator in Decision Intelligence for the full category/season/market breakdown.`);
  const stats: StatItem[] = [
    { label: "Sell-through", value: overallPct !== null ? `${overallPct}%` : s.insufficientDataLabel },
    ...(top ? [{ label: "Best category", value: `${top.category} (${typeof top.sellThroughPct === "number" ? `${top.sellThroughPct}%` : top.sellThroughPct})` }] : []),
    { label: "Below threshold", value: `${below.length} categor${below.length === 1 ? "y" : "ies"}` },
  ];
  return { answer: lines.join(" "), stats };
}

async function answerGmroi(filters: AiFilters): Promise<AnswerWithStats> {
  const g = await getGmroiSummary();

  // Product filter: GMROI is computed per-category (same product_lifecycle/
  // inventory source as sell-through, same no-country-column limitation) --
  // resolve to the real category and answer just that row.
  if (filters.product) {
    const category = await resolveProductCategory(filters.product);
    if (category) {
      const row = g.categories.find((c) => c.category === category);
      if (row) {
        const gmroiStr = typeof row.gmroi === "number" ? `${row.gmroi.toFixed(2)}x` : row.gmroi;
        const answer = [
          `GMROI for the ${category} category (product "${filters.product}" belongs here — GMROI isn't tracked per individual SKU, only per category): ${gmroiStr} — benchmarks: ${g.strongBenchmark}x+ is strong, below ${g.attentionThreshold}x needs attention. Status: ${row.status}.`,
          `See the GMROI calculator in Decision Intelligence for the full category breakdown.`,
        ].join(" ");
        const stats: StatItem[] = [
          { label: `GMROI (${category})`, value: gmroiStr },
          { label: "Gross margin", value: `€${row.grossMargin.toLocaleString()}` },
          { label: "Inventory value", value: `€${row.inventoryValue.toLocaleString()}` },
        ];
        return { answer, stats };
      }
    }
  }

  // Country filter: no real join path exists (same limitation as
  // sell-through) -- said plainly, unfiltered figure shown instead.
  const countryNote = filters.country
    ? ` (Note: GMROI isn't tracked by country in this dataset — product_lifecycle and inventory have no country column. Showing the company-wide figure instead.)`
    : "";

  const lines = [
    (typeof g.overallGmroi === "number"
      ? `GMROI (gross margin return on inventory investment): ${g.overallGmroi.toFixed(2)}x overall — benchmarks: ${g.strongBenchmark}x+ is strong, below ${g.attentionThreshold}x needs attention.`
      : "Not enough real cost/inventory data to compute an overall GMROI.") + countryNote,
  ];
  const strong = g.categories.filter((c) => c.status === "strong");
  const attention = g.categories.filter((c) => c.status === "attention");
  if (strong.length) {
    lines.push(`Strongest: ${strong.map((c) => `${c.category} (${typeof c.gmroi === "number" ? c.gmroi.toFixed(2) : c.gmroi}x)`).join(", ")}.`);
  }
  if (attention.length) {
    lines.push(`Needs attention: ${attention.map((c) => `${c.category} (${typeof c.gmroi === "number" ? c.gmroi.toFixed(2) : c.gmroi}x)`).join(", ")}.`);
  }
  lines.push(`See the GMROI calculator in Decision Intelligence for the full category breakdown.`);
  const stats: StatItem[] = [
    { label: "Overall GMROI", value: typeof g.overallGmroi === "number" ? `${g.overallGmroi.toFixed(2)}x` : g.overallGmroi },
    { label: "Strong categories", value: `${strong.length}` },
    { label: "Needs attention", value: `${attention.length}` },
  ];
  return { answer: lines.join(" "), stats };
}

async function answerReturns(filters: AiFilters): Promise<AnswerWithStats> {
  // returns has a real product_slug column, so a product filter is an exact,
  // real WHERE clause -- no category resolution needed, this is finer than
  // GMROI/sell-through's category grain. returns has no country column and
  // no order_id join path to any table that has one (checked directly:
  // shopify_orders/shopify_live_orders carry no country either), so a
  // country filter genuinely can't be honored -- said plainly.
  const countryNote = filters.country
    ? ` (Note: returns aren't tracked by country in this dataset — the returns table has no country column, and its order_id doesn't join to any table that has one. Showing all countries instead.)`
    : "";

  if (filters.product) {
    const [rows] = await bigquery.query({
      query: `SELECT order_id, reason, refund_amount, influencer_campaign FROM \`${PROJECT}.returns\` WHERE product_slug = @product`,
      params: { product: filters.product },
      types: { product: "STRING" },
    });
    if (!rows.length) {
      return { answer: `No real returns found for "${filters.product}".${countryNote}`, stats: [] };
    }
    const totalReturns = rows.length;
    const totalRefunded = rows.reduce((s: number, r: any) => s + (r.refund_amount || 0), 0);
    const linked = rows.filter((r: any) => r.influencer_campaign).length;
    const reasonCounts: Record<string, number> = {};
    rows.forEach((r: any) => {
      if (r.reason) reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    });
    const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
    const lines = [
      `Returns for "${filters.product}": ${totalReturns.toLocaleString()} real returns totaling €${Math.round(totalRefunded).toLocaleString()} refunded (avg €${Math.round(totalRefunded / totalReturns).toLocaleString()} per return).${countryNote}`,
      `${linked.toLocaleString()} of those (${((linked / totalReturns) * 100).toFixed(1)}%) are linked to an influencer campaign.`,
    ];
    if (topReasonEntry) lines.push(`Most common return reason: "${topReasonEntry[0]}" (${topReasonEntry[1].toLocaleString()} returns).`);
    lines.push(`See Returns for the full order-by-order breakdown.`);
    const stats: StatItem[] = [
      { label: "Total returns", value: totalReturns.toLocaleString() },
      { label: "Total refunded", value: `€${Math.round(totalRefunded).toLocaleString()}` },
      { label: "Linked to campaign", value: `${((linked / totalReturns) * 100).toFixed(1)}%` },
      ...(topReasonEntry ? [{ label: "Top reason", value: topReasonEntry[0] }] : []),
    ];
    return { answer: lines.join(" "), stats };
  }

  const r = await getReturnsSummary();
  if (!r.totalReturns) return { answer: `No real return records found.${countryNote}`, stats: [] };
  const lines = [
    `Returns: ${r.totalReturns.toLocaleString()} real returns totaling €${Math.round(r.totalRefunded).toLocaleString()} refunded (avg €${Math.round(r.avgRefund).toLocaleString()} per return).${countryNote}`,
    `${r.linkedToCampaign.toLocaleString()} of those (${r.linkedPct.toFixed(1)}%) are linked to an influencer campaign.`,
  ];
  if (r.topReason) {
    lines.push(`Most common return reason: "${r.topReason.reason}" (${r.topReason.count.toLocaleString()} returns).`);
  }
  lines.push(`See Returns for the full order-by-order breakdown.`);
  const stats: StatItem[] = [
    { label: "Total returns", value: r.totalReturns.toLocaleString() },
    { label: "Total refunded", value: `€${Math.round(r.totalRefunded).toLocaleString()}` },
    { label: "Linked to campaign", value: `${r.linkedPct.toFixed(1)}%` },
    ...(r.topReason ? [{ label: "Top reason", value: r.topReason.reason }] : []),
  ];
  return { answer: lines.join(" "), stats };
}

async function answerReorder(category: string): Promise<AnswerWithStats> {
  const e = await getEoqSummary(category);
  if ("error" in e) {
    return { answer: e.error, stats: [] };
  }
  const lines = [
    `EOQ for ${category}: order ${e.eoq.toLocaleString()} units at a time, ${e.ordersPerYear.toFixed(1)} times/year (every ${e.reorderIntervalDays} days) — based on ${e.annualDemandUnits.toLocaleString()} real annualized units of demand.`,
    e.reorderPoint !== null && e.supplier
      ? `Reorder point: ${e.reorderPoint.toLocaleString()} units on hand, sized to ${e.supplier.name}'s real ${e.supplier.leadTimeDays}-day lead time and ${e.supplier.onTimeDeliveryRate}% on-time delivery rate.`
      : `No supplier is tracked for "${category}" yet, so only the order-quantity math is available — see Supplier Intelligence.`,
    `Estimated annual savings vs. a monthly reorder cadence: €${e.annualSavings.toLocaleString()}.`,
    `See the EOQ calculator in Decision Intelligence for the full methodology and to try other categories.`,
  ];
  const stats: StatItem[] = [
    { label: "Order quantity", value: `${e.eoq.toLocaleString()} units` },
    { label: "Reorder every", value: `${e.reorderIntervalDays} days` },
    ...(e.reorderPoint !== null ? [{ label: "Reorder point", value: `${e.reorderPoint.toLocaleString()} units` }] : []),
    { label: "Est. annual savings", value: `€${e.annualSavings.toLocaleString()}` },
  ];
  return { answer: lines.join(" "), stats };
}

async function answerRevenueDriver(filters: AiFilters): Promise<AnswerWithStats> {
  // sales_events has a real per-event country column -- a country filter
  // scopes the entire cohort bridge to that country's own customers/
  // purchases, a genuinely different (smaller) real computation, not the
  // platform-wide bridge re-labeled. No real product dimension for this
  // pattern: the bridge is a customer-cohort analysis (each customer's
  // total spend across ALL their purchases), which doesn't have a natural
  // single-product scope without restructuring the unit of analysis itself.
  const productNote = filters.product
    ? " (Note: a product filter is active, but the revenue bridge is a customer-cohort analysis across all of a customer's purchases, with no single-product scope — showing all products instead.)"
    : "";

  const g = filters.country ? await getGrowthBridgeSummaryForCountry(filters.country) : await getGrowthBridgeSummary();
  if (!g) {
    return { answer: `No real purchase history found for customers in ${filters.country}.`, stats: [] };
  }
  const direction = g.totalGrowth >= 0 ? "grew" : "dropped";
  const scopeLabel = filters.country ? ` in ${filters.country}` : "";

  // Rank the four named drivers by absolute size to name the biggest one --
  // same numbers the Growth Bridge waterfall shows, just picking out the
  // largest bar instead of listing all four with equal weight.
  const drivers = [
    { label: "Expansion (existing customers buying more)", value: g.expansion },
    { label: "New Business", value: g.newBusiness },
    { label: "Churn Impact", value: g.churnImpact },
    { label: "Price Effect", value: g.priceEffect },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const topDriver = drivers[0];

  const lines = [
    `Revenue${scopeLabel} ${direction} €${Math.abs(g.totalGrowth).toLocaleString()} (€${g.priorPeriodRevenue.toLocaleString()} → €${g.currentPeriodRevenue.toLocaleString()}) between the earlier and later half of this dataset's real purchase history — no real multi-year history exists yet, so this compares the two equal-count cohorts of real purchases rather than a literal calendar period like "June."${productNote}`,
    `Biggest driver: ${topDriver.label} at €${topDriver.value.toLocaleString()}.`,
    `Full breakdown — Expansion: €${g.expansion.toLocaleString()} · New Business: €${g.newBusiness.toLocaleString()} (${g.newCustomerCount} new customers) · Churn Impact: €${g.churnImpact.toLocaleString()} (${g.churnedCustomerCount} customers lost) · Price Effect: €${g.priceEffect.toLocaleString()}.`,
    `See Growth Bridge in Decision Intelligence for the full waterfall (not currently filterable by country there), or Revenue Growth Decomposition for a price/volume/mix cut of the same change.`,
  ];
  const stats: StatItem[] = [
    { label: `Revenue change${scopeLabel}`, value: `${g.totalGrowth >= 0 ? "+" : "−"}€${Math.abs(g.totalGrowth).toLocaleString()}` },
    { label: "Biggest driver", value: topDriver.label.split(" (")[0] },
    { label: "New customers", value: `${g.newCustomerCount}` },
    { label: "Churned customers", value: `${g.churnedCustomerCount}` },
  ];
  return { answer: lines.join(" "), stats };
}

// Real country-scoped revenue bridge -- exact same cohort-split methodology
// as getGrowthBridgeSummary() (lib/growth-bridge-server.ts), just with a
// real `WHERE country = @country` added to the source query. Kept here
// rather than added as an optional param on the shared lib function so the
// real, unfiltered Growth Bridge page's query is never at risk of being
// touched by this filtering logic.
async function getGrowthBridgeSummaryForCountry(country: string) {
  const [rows] = await bigquery.query({
    query: `
      SELECT s.user_pseudo_id AS customer_id, s.revenue,
        NTILE(2) OVER (ORDER BY s.event_timestamp) AS half
      FROM \`${PROJECT}.sales_events\` s
      WHERE s.event_name = 'purchase' AND s.revenue > 0 AND s.country = @country
    `,
    params: { country },
    types: { country: "STRING" },
  });
  if (!rows.length) return null;

  type Cust = { orders1: number; revenue1: number; orders2: number; revenue2: number };
  const byCustomer = new Map<string, Cust>();
  rows.forEach((r: any) => {
    const c = byCustomer.get(r.customer_id) ?? { orders1: 0, revenue1: 0, orders2: 0, revenue2: 0 };
    if (r.half === 1) {
      c.orders1 += 1;
      c.revenue1 += r.revenue;
    } else {
      c.orders2 += 1;
      c.revenue2 += r.revenue;
    }
    byCustomer.set(r.customer_id, c);
  });

  let priorPeriodRevenue = 0;
  let currentPeriodRevenue = 0;
  let newBusiness = 0;
  let churnImpact = 0;
  let expansion = 0;
  let priceEffect = 0;
  let newCustomerCount = 0;
  let churnedCustomerCount = 0;

  byCustomer.forEach((c) => {
    priorPeriodRevenue += c.revenue1;
    currentPeriodRevenue += c.revenue2;
    if (c.orders1 === 0 && c.orders2 > 0) {
      newBusiness += c.revenue2;
      newCustomerCount++;
    } else if (c.orders1 > 0 && c.orders2 === 0) {
      churnImpact -= c.revenue1;
      churnedCustomerCount++;
    } else if (c.orders1 > 0 && c.orders2 > 0) {
      const avgPrice1 = c.revenue1 / c.orders1;
      const avgPrice2 = c.revenue2 / c.orders2;
      expansion += (c.orders2 - c.orders1) * avgPrice1;
      priceEffect += (avgPrice2 - avgPrice1) * c.orders2;
    }
  });

  return {
    priorPeriodRevenue: Math.round(priorPeriodRevenue),
    currentPeriodRevenue: Math.round(currentPeriodRevenue),
    totalGrowth: Math.round(currentPeriodRevenue - priorPeriodRevenue),
    expansion: Math.round(expansion),
    newBusiness: Math.round(newBusiness),
    churnImpact: Math.round(churnImpact),
    priceEffect: Math.round(priceEffect),
    newCustomerCount,
    churnedCustomerCount,
  };
}
