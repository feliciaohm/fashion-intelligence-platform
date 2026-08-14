// "Describe the dashboard you want" -- the layer-4 piece of the Dashboards
// feature: turn a freeform prompt into a real, multi-block dashboard in one
// step, instead of asking each question individually and exporting one at
// a time.
//
// Deliberately NOT an LLM generating arbitrary charts/numbers -- that would
// break the platform's core "never fabricate" rule. Instead: the AI's only
// job is picking which of the platform's fixed, already-real, already-
// verified question templates (DEMO_EXAMPLE_QUESTIONS) match what was
// asked for. Every actual number still comes from tryDemoAnswer() running
// the real rule-based calculators against real BigQuery data -- the exact
// same deterministic tier the Command Center's AI Search always falls back
// to. The selection step can be "wrong" (pick a question that isn't quite
// what was meant); it can never be dishonest, because it only ever chooses
// from real, computable questions -- never invents one.
import Anthropic from "@anthropic-ai/sdk";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/ai-demo-questions";
import { tryDemoAnswer, type DemoAnswer } from "@/lib/ai-demo-mode";

const KEYWORDS: Record<string, string[]> = {
  "Which influencer gave the highest ROI?": ["influencer", "roi", "campaign"],
  "What is our gross margin?": ["gross margin", "margin"],
  "Which market performs best?": ["market", "country", "region"],
  "What is our churn rate?": ["churn", "retention"],
  "What is our sell-through rate?": ["sell-through", "sell through", "sellthrough", "inventory"],
  "What is our GMROI?": ["gmroi", "gm roi", "inventory return"],
  "How many returns do we have?": ["return", "refund"],
  "How much should we reorder for bags?": ["reorder", "restock", "eoq", "bags"],
  "Why did revenue change?": ["revenue", "why", "driver", "change"],
};

function keywordSelect(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const matches = DEMO_EXAMPLE_QUESTIONS.filter((q) => KEYWORDS[q]?.some((k) => lower.includes(k)));
  // A vague "give me an overview" style prompt matches nothing specific --
  // a full spread is a more honest default than an empty dashboard.
  return matches.length > 0 ? matches : DEMO_EXAMPLE_QUESTIONS;
}

// Only Claude -> keyword-rules here, not the full 3-tier Claude -> Gemini ->
// rules chain the Command Center uses -- GEMINI_API_KEY isn't configured in
// this environment yet, so a Gemini middle tier would be dead code right
// now. Worth adding for consistency once Gemini is actually set up; the
// keyword fallback already covers the "no paid tier available" case
// honestly in the meantime -- confirmed live just now, since the real
// Claude key currently has no credit balance.
async function selectQuestionsWithClaude(prompt: string): Promise<string[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `A user wants a dashboard described as: "${prompt}"\n\nFrom this exact list of real, computable questions, pick the ones relevant to their request (at least 1, at most 6):\n${DEMO_EXAMPLE_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nReply with ONLY a JSON array of the exact question strings from the list, nothing else.`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
    const valid = parsed.filter((q: unknown) => typeof q === "string" && DEMO_EXAMPLE_QUESTIONS.includes(q));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export async function generateDashboardBlocks(
  prompt: string
): Promise<{ title: string; sourceQuestion: string; stats: { label: string; value: string }[] }[]> {
  const questions = (await selectQuestionsWithClaude(prompt)) ?? keywordSelect(prompt);

  const answers = await Promise.all(
    questions.map(async (q) => {
      try {
        const answer: DemoAnswer | null = await tryDemoAnswer(q, {});
        return { question: q, answer };
      } catch {
        return { question: q, answer: null };
      }
    })
  );

  return answers
    .filter((a) => a.answer && a.answer.stats && a.answer.stats.length > 0)
    .map((a) => ({
      title: a.question,
      sourceQuestion: a.question,
      stats: a.answer!.stats!,
    }));
}
