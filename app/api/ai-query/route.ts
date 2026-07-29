import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { bigquery } from "@/lib/bigquery";
import { tryDemoAnswer, demoModeUnavailableMessage } from "@/lib/ai-demo-mode";

export async function POST(req: Request) {
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // Try the real Claude API first whenever a key is configured -- if it's
  // set and has credits, this is the only path that ever runs, and demo
  // mode never activates. If the call fails for any reason (no credits, key
  // revoked, network issue), fall through to demo mode below instead of
  // surfacing a dead-end error.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const answer = await answerWithClaude(query);
      return NextResponse.json({ ...answer, demoMode: false });
    } catch (error) {
      console.error("AI QUERY ERROR (falling back to demo mode):", error);
    }
  }

  try {
    const demo = await tryDemoAnswer(query);
    return NextResponse.json({
      answer: demo?.answer ?? demoModeUnavailableMessage(),
      demoMode: true,
      matchedPattern: demo?.matchedPattern ?? "none",
    });
  } catch (error) {
    console.error("DEMO MODE ERROR:", error);
    return NextResponse.json({ error: "Query failed", details: String(error) }, { status: 500 });
  }
}

async function answerWithClaude(query: string): Promise<{ answer: string; rowsUsed: number }> {
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    system: `You are the analytics assistant for a fashion brand's Fashion Intelligence Platform.
Answer the user's question using ONLY the BigQuery data provided below — never invent numbers.
Be concise and structured: lead with the direct answer, cite the specific figures that support it,
and format money as $X and ROI as X%. If the data provided cannot answer the question, say so plainly
instead of guessing.

INFLUENCER CAMPAIGNS (influencer_product_performance, ${campaigns.length} rows):
${JSON.stringify(campaigns)}

PRODUCTS (product_full_stack, ${products.length} rows):
${JSON.stringify(products)}

COUNTRY PERFORMANCE (real purchases grouped by country, sales_events, ${countries.length} rows):
${JSON.stringify(countries)}`,
    messages: [{ role: "user", content: query }],
  });

  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as any).text)
    .join("\n");

  return { answer, rowsUsed: campaigns.length + products.length + countries.length };
}
