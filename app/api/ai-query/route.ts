import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { bigquery } from "@/lib/bigquery";
import { tryDemoAnswer, demoModeUnavailableMessage, type AiFilters } from "@/lib/ai-demo-mode";
import { isGeminiConfigured, answerWithGemini } from "@/lib/gemini-server";

export async function POST(req: Request) {
  const { query, filters: rawFilters } = await req.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // Command Center's active Filter Palette selections, narrowed to the
  // dimensions AI answers can honestly act on (see AiFilters in
  // lib/ai-demo-mode.ts for exactly why only these four, and why not e.g.
  // "store" or a separate "campaign" -- there's no such column).
  const filters: AiFilters = {
    country: typeof rawFilters?.country === "string" ? rawFilters.country : undefined,
    product: typeof rawFilters?.product === "string" ? rawFilters.product : undefined,
    influencer: typeof rawFilters?.influencer === "string" ? rawFilters.influencer : undefined,
    quarter: typeof rawFilters?.quarter === "string" ? rawFilters.quarter : undefined,
  };
  const activeFilterParts = [
    filters.country && `country = ${filters.country}`,
    filters.product && `product = ${filters.product}`,
    filters.influencer && `influencer = ${filters.influencer}`,
    filters.quarter && `quarter = ${filters.quarter}`,
  ].filter(Boolean);
  const filterInstruction = activeFilterParts.length
    ? `[Active filter: ${activeFilterParts.join(", ")}. Answer scoped to this filter using only the real data below that matches it. If the specific metric asked about has no way to be broken down by this filter in the data provided, say so plainly instead of guessing or ignoring the filter silently.]\n\n`
    : "";

  // Three tiers, tried in order, each falling through to the next on any
  // failure -- never a dead end.
  //   1. Real Claude (ANTHROPIC_API_KEY) -- the paid, real-client tier.
  //   2. Real Gemini via Google AI Studio (GEMINI_API_KEY) -- genuinely
  //      free, see lib/gemini-server.ts for the terms this relies on. Uses
  //      the exact same grounding data as tier 1 (buildGroundingContext,
  //      below) so swapping providers never changes what the model can see.
  //   3. The free rule-based demo-mode engine (lib/ai-demo-mode.ts) --
  //      always available, no key required, and the only tier with actual
  //      per-metric filter logic (real joins/WHERE clauses) rather than
  //      relying on the model to self-scope from an instruction.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const answer = await answerWithClaude(filterInstruction + query);
      return NextResponse.json({ ...answer, demoMode: false, provider: "claude" });
    } catch (error) {
      console.error("AI QUERY ERROR (Claude, falling back):", error);
    }
  }

  if (isGeminiConfigured()) {
    try {
      const { context, rowsUsed } = await buildGroundingContext();
      const answer = await answerWithGemini(filterInstruction + query, context);
      return NextResponse.json({ answer, rowsUsed, demoMode: false, provider: "gemini" });
    } catch (error) {
      console.error("AI QUERY ERROR (Gemini, falling back to demo mode):", error);
    }
  }

  try {
    const demo = await tryDemoAnswer(query, filters);
    return NextResponse.json({
      answer: demo?.answer ?? demoModeUnavailableMessage(),
      demoMode: true,
      provider: "demo-mode",
      matchedPattern: demo?.matchedPattern ?? "none",
      stats: demo?.stats ?? [],
      category: demo?.category ?? null,
      classificationConfidence: demo?.classificationConfidence ?? null,
    });
  } catch (error) {
    console.error("DEMO MODE ERROR:", error);
    return NextResponse.json({ error: "Query failed", details: String(error) }, { status: 500 });
  }
}

// Real BigQuery data both answerWithClaude and answerWithGemini ground their
// answer in -- pulled out so the two providers can never see different data,
// only a different model behind the same context. This is also what a real
// client's data would flow through unchanged: swap in their tables, both
// providers keep working from this same function.
async function buildGroundingContext(): Promise<{ context: string; rowsUsed: number }> {
  const campaignsQuery = `
    SELECT influencer, product_slug, platform, content_type, country, post_date,
      gifted_cost, purchases, total_revenue, roi_pct
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance\`
    ORDER BY roi_pct DESC
  `;
  const productsQuery = `
    SELECT product_slug, product_name, category, collection, price,
      retail_revenue, ecommerce_revenue, influencer_revenue, influencer_roi
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.product_full_stack\`
  `;
  // country_performance_model is a broken view (collapses every country into
  // a single NULL-country aggregate row -- see DATA_AUDIT.md and
  // lib/ai-demo-mode.ts, which already routes around it the same way).
  // sales_events.country is real and populated, grouped here directly.
  const countriesQuery = `
    SELECT country, COUNT(*) AS events, SUM(revenue) AS total_revenue
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events\`
    WHERE event_name = 'purchase' AND revenue > 0 AND country IS NOT NULL
    GROUP BY country
    ORDER BY total_revenue DESC
  `;

  const [[campaigns], [products], [countries]] = await Promise.all([
    bigquery.query(campaignsQuery),
    bigquery.query(productsQuery),
    bigquery.query(countriesQuery),
  ]);

  const context = `INFLUENCER CAMPAIGNS (influencer_product_performance, ${campaigns.length} rows):
${JSON.stringify(campaigns)}

PRODUCTS (product_full_stack, ${products.length} rows):
${JSON.stringify(products)}

COUNTRY PERFORMANCE (real purchases grouped by country, sales_events, ${countries.length} rows):
${JSON.stringify(countries)}`;

  return { context, rowsUsed: campaigns.length + products.length + countries.length };
}

async function answerWithClaude(query: string): Promise<{ answer: string; rowsUsed: number }> {
  const { context, rowsUsed } = await buildGroundingContext();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    system: `You are the analytics assistant for a fashion brand's Fashion Intelligence Platform.
Answer the user's question using ONLY the BigQuery data provided below — never invent numbers.
Be concise and structured: lead with the direct answer, cite the specific figures that support it,
and format money as $X and ROI as X%. If the data provided cannot answer the question, say so plainly
instead of guessing.

${context}`,
    messages: [{ role: "user", content: query }],
  });

  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as any).text)
    .join("\n");

  return { answer, rowsUsed };
}
