// Client-safe: just the example question strings, split out of
// lib/ai-demo-mode.ts (which imports @/lib/bigquery and other server-only
// modules) so Command Center -- a client component -- can render them as
// clickable chips without pulling server-only code into the browser bundle.
// lib/ai-demo-mode.ts re-exports this constant, so there's still exactly
// one source of truth for the question list.
//
// Deliberately NOT included: "Should we expand to Sweden?" (and any
// similarly-phrased "should we..." strategic yes/no question). The
// underlying scenario/market-sizing pattern still works if someone types a
// question like that themselves -- EXPANSION_RE and answerExpansion() are
// unchanged -- but it's not promoted here, because the question's phrasing
// promises a strategic recommendation the computation doesn't actually
// give: it's a generic TAM/SAM/SOM sizing using DEFAULT assumptions
// (category "bags", €2,500 price point) unrelated to whatever the asker
// actually has in mind, not a real "should we" judgment. Suggesting it as a
// one-click example overstated what it delivers.
export const DEMO_EXAMPLE_QUESTIONS = [
  "Which influencer gave the highest ROI?",
  "What is our gross margin?",
  "Which market performs best?",
  "What is our churn rate?",
  "What is our sell-through rate?",
  "What is our GMROI?",
  "How many returns do we have?",
  "How much should we reorder for bags?",
  "Why did revenue change?",
];
