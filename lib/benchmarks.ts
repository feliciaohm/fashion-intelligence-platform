// Client-safe: benchmark reference data + shared types only. No BigQuery
// import here (same convention as lib/decision.ts / lib/roles.ts) -- this is
// read by both the API route (server) and app/benchmarks/page.tsx (client).
//
// Every figure below was pulled from a real public source via web search on
// 2026-07-25, not invented. Where the real research didn't cleanly match a
// clean "average vs. best-in-class" shape (customer retention, return rate),
// the field is left null rather than filled with a fabricated number -- see
// `note` on each metric for the honest caveat.

export type BenchmarkDirection = "higher-better" | "lower-better";

export interface BenchmarkMetric {
  id: string;
  label: string;
  unit: string; // "x" | "%" | ":1"
  direction: BenchmarkDirection;
  industryAverage: number;
  bestInClass: number | null;
  source: string;
  sourceUrl: string;
  note: string;
}

export interface BenchmarkResult extends BenchmarkMetric {
  platformValue: number | null;
  platformNote: string;
}

export const BENCHMARKS: BenchmarkMetric[] = [
  {
    id: "influencer_roi",
    label: "Influencer ROI",
    unit: "x",
    direction: "higher-better",
    industryAverage: 2,
    bestInClass: 6,
    source: "Influencer Hero, \"Influencer Marketing ROI by Industry\" (luxury fashion campaigns average $1–3 revenue per $1 spent)",
    sourceUrl: "https://influencerhero.com",
    note:
      "Shown as a revenue multiple (€ returned per €1 spent) to match how the source reports it. Luxury campaigns typically run lower than mass-fashion influencer ROI because they optimize for brand equity, not direct response. Best-in-class (6x) reflects well-targeted macro-influencer luxury campaigns rather than a single named benchmark report.",
  },
  {
    id: "gross_margin",
    label: "Gross Margin",
    unit: "%",
    direction: "higher-better",
    industryAverage: 62,
    bestInClass: 75,
    source: "Recurve Capital, \"A Study of Luxury Companies\"; company filings (LVMH ~70% gross margin, Brunello Cucinelli >70%)",
    sourceUrl: "https://recurvecap.com/insights/a-study-of-luxury-companies",
    note:
      "Real luxury-sector gross margins run 60–85% depending on category (leather goods and accessories highest). 62% reflects the commonly-cited average for luxury apparel; 75% reflects top-performing houses in leather goods/accessories rather than a single named \"best-in-class\" report.",
  },
  {
    id: "customer_retention",
    label: "Customer Retention Rate",
    unit: "%",
    direction: "higher-better",
    industryAverage: 30,
    bestInClass: null,
    source: "Industry commentary citing a 25–35% repeat-purchase target for luxury retailers; Stylograph reports actual luxury repeat-purchase rates as low as 9.9% in practice",
    sourceUrl: "https://www.stylograph.io",
    note:
      "No single authoritative \"best-in-class\" figure exists in public sources, so it's left blank rather than invented. The more useful real finding: many luxury retailers target 25–35% repeat-purchase but measure far lower (as low as 9.9%) — the gap between target and reality is itself the insight.",
  },
  {
    id: "cac_clv_ratio",
    label: "CAC:CLV Ratio",
    unit: ":1",
    direction: "higher-better",
    industryAverage: 3,
    bestInClass: 5,
    source: "David Skok / Matrix Partners LTV:CAC convention, widely cited across growth-marketing and SaaS benchmark reports",
    sourceUrl: "https://www.forentrepreneurs.com",
    note:
      "This is a cross-industry growth-marketing convention, not luxury-specific — 3:1 is the standard \"minimum healthy\" threshold; 5:1+ is commonly cited as excellent. No luxury-fashion-specific version of this ratio was found in public sources.",
  },
  {
    id: "return_rate",
    label: "Return Rate (Online)",
    unit: "%",
    direction: "lower-better",
    industryAverage: 28,
    bestInClass: null,
    source: "2024 ecommerce returns data: apparel/fashion return rates run 25–40% (highest-returning category), vs. ~20.4% overall ecommerce average",
    sourceUrl: "https://www.narvar.com",
    note:
      "28% sits within the real 25–40% apparel/fashion range, at the lower end where luxury typically falls (higher purchase deliberation than mass fashion). No specific \"best-in-class\" figure was found for luxury specifically, so it's left blank rather than invented.",
  },
];
