// Server-only: the free real-AI middle tier, sitting between the paid
// Anthropic path and the free rule-based fallback (lib/ai-demo-mode.ts).
// Uses Google's Gemini API via AI Studio (aistudio.google.com) -- genuinely
// free, no credit card required for a key, no expiration, as confirmed
// directly (2026-08-08) against Google's current published free-tier terms.
// Only stays free as long as GEMINI_API_KEY comes from an AI Studio key with
// no Google Cloud billing account attached to that project -- that's a
// setting on Google's dashboard, not something this code can enforce, so it
// has to be a human decision made once when the key is created.
//
// Deliberately mirrors the exact shape of the Anthropic calls in
// app/api/ai-query/route.ts and lib/ai-demo-mode.ts's classifyQuery(): same
// function signatures, same grounding-context input, same
// "throw/return-null on any failure, let the caller fall through" contract.
// That's not an accident -- it's so the three-tier chain (Anthropic ->
// Gemini -> rule-based) is a real production shape: the day a paying client
// connects real data and ANTHROPIC_API_KEY gets real credits, the exact same
// code activates the paid tier automatically. This file doesn't get
// replaced, it just stops being reached first.
import { GoogleGenAI } from "@google/genai";

// Kept as an independent literal union (not imported from ai-demo-mode.ts)
// to avoid a runtime circular import between the two files -- must be kept
// in sync with QueryCategory in lib/ai-demo-mode.ts by hand.
export type GeminiQueryCategory = "kpi_lookup" | "reorder" | "scenario" | "general_search";

// Same cheap/high-quota model as CLASSIFY_MODEL -- this is the same shape
// of task (pick from a small fixed set), not a grounded answer.
const SELECT_MODEL = "gemini-flash-lite-latest";

// Google deprecated gemini-2.5-flash-lite and gemini-2.5-flash for new API
// keys sometime after 2026-08-08 -- confirmed live against a brand-new key
// created tonight: both returned a real 404 "no longer available to new
// users". Re-tested every current model name directly against this real
// key before picking a replacement; gemini-2.0-flash and gemini-3-pro-
// preview are also dead (404), gemini-flash-latest and gemini-pro-latest
// are real but currently overloaded/quota-limited on the free tier. These
// two actually returned a real response just now:
const CLASSIFY_MODEL = "gemini-flash-lite-latest";
// A step up for the fuller grounded answer -- Google's newer flagship-ish
// flash model, still free tier.
const ANSWER_MODEL = "gemini-3-flash-preview";

const VALID_CATEGORIES: GeminiQueryCategory[] = ["kpi_lookup", "reorder", "scenario", "general_search"];

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function client(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const CLASSIFY_SYSTEM_PROMPT = `You are a query router for a fashion-brand analytics platform. Classify the user's question into exactly one category:
- kpi_lookup: asks for a specific named metric (GMROI, sell-through, CLV, ROAS, gross margin, churn rate, ROI, revenue by market, etc.)
- reorder: asks about order quantity, reorder point, or EOQ for a product category
- scenario: a hypothetical "what if" question (market expansion/entry, a pricing change, a budget shift, pausing an influencer)
- general_search: anything else -- product, influencer, or customer lookups that are not a single named KPI

Respond with ONLY a JSON object and nothing else: {"category": "kpi_lookup" | "reorder" | "scenario" | "general_search", "confidence": <number between 0 and 1>}`;

// Returns null on ANY failure (bad key, rate limit, malformed response) --
// never throws. Callers (classifyQuery in ai-demo-mode.ts) treat null as
// "try the next tier down," exactly like the Anthropic classify call does.
export async function classifyWithGemini(question: string): Promise<{ category: GeminiQueryCategory; confidence: number } | null> {
  try {
    const ai = client();
    const response = await ai.models.generateContent({
      model: CLASSIFY_MODEL,
      contents: question,
      config: { systemInstruction: CLASSIFY_SYSTEM_PROMPT, maxOutputTokens: 60 },
    });
    const raw = (response.text ?? "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]);
    if (!VALID_CATEGORIES.includes(obj.category) || typeof obj.confidence !== "number") return null;
    return { category: obj.category, confidence: Math.max(0, Math.min(1, obj.confidence)) };
  } catch (error) {
    console.error("GEMINI CLASSIFY ERROR (falling back to rule-based classification):", error);
    return null;
  }
}

// Throws on failure (same contract as answerWithClaude in
// app/api/ai-query/route.ts) -- the route's try/catch is what falls
// through to demo mode, so this function stays a thin, honest wrapper.
export async function answerWithGemini(query: string, groundingContext: string): Promise<string> {
  const ai = client();
  const response = await ai.models.generateContent({
    model: ANSWER_MODEL,
    contents: query,
    config: {
      systemInstruction: `You are the analytics assistant for a fashion brand's Fashion Intelligence Platform.
Answer the user's question using ONLY the data provided below — never invent numbers.
Be concise and structured: lead with the direct answer, cite the specific figures that support it,
and format money as €X and ROI as X%. If the data provided cannot answer the question, say so plainly
instead of guessing.

${groundingContext}`,
      maxOutputTokens: 700,
    },
  });
  const text = (response.text ?? "").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// Free middle tier for the dashboard generator's question-selection step
// (lib/dashboard-generator.ts), sitting between Claude and the keyword
// fallback -- same "returns null on any failure, let the caller fall
// through" contract as classifyWithGemini above. Only ever picks from the
// exact list handed in; anything else is discarded by the caller, same
// discipline as the Claude version of this same step.
export async function selectQuestionsWithGemini(prompt: string, options: string[]): Promise<string[] | null> {
  try {
    const ai = client();
    const response = await ai.models.generateContent({
      model: SELECT_MODEL,
      contents: `A user wants a dashboard described as: "${prompt}"\n\nFrom this exact list of real, computable questions, pick the ones relevant to their request (at least 1, at most 6):\n${options.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nReply with ONLY a JSON array of the exact question strings from the list, nothing else.`,
      config: { maxOutputTokens: 300 },
    });
    const raw = (response.text ?? "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const valid = Array.isArray(parsed) ? parsed.filter((q: unknown) => typeof q === "string" && options.includes(q)) : [];
    return valid.length > 0 ? valid : null;
  } catch (error) {
    console.error("GEMINI DASHBOARD-SELECT ERROR (falling back):", error);
    return null;
  }
}
