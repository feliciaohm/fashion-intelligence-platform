// Server-only: the real Market Sizing (TAM/SAM/SOM) computation, extracted
// from /api/decision/market-sizing so both the calculator route and the AI
// Search demo-mode engine (lib/ai-demo-mode.ts) call the exact same logic
// instead of drifting into two slightly different answers to "how big is
// this market."
import { bigquery } from "@/lib/bigquery";
import { MarketSizingInput } from "@/lib/decision";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// External reference data -- NOT from BigQuery, not computed from Maison
// Lumière's own data. Approximate population figures (rounded, general
// public statistics circa 2023-2024). Cited explicitly in methodology so
// this is never mistaken for a live or brand-specific number.
export const POPULATION: Record<string, number> = {
  Australia: 26_000_000,
  China: 1_410_000_000,
  Denmark: 5_900_000,
  Finland: 5_600_000,
  France: 68_000_000,
  Germany: 84_000_000,
  Italy: 59_000_000,
  Japan: 124_000_000,
  Netherlands: 17_900_000,
  Norway: 5_500_000,
  Singapore: 5_900_000,
  "South Korea": 51_700_000,
  Sweden: 10_500_000,
  UK: 67_700_000,
  US: 335_000_000,
};

export const SIZING_COUNTRIES = Object.keys(POPULATION);

// Documented industry rule-of-thumb: share of a country's population that
// realistically represents accessible-to-aspirational luxury-goods buyers.
// Not derived from Maison Lumière's own data -- there's no real basis in
// this dataset to fit a per-country rate from.
const LUXURY_PENETRATION_RATE = 0.015;
// Simplifying assumption: one purchase per addressable buyer per year at
// the given price point, to convert a buyer count into a euro TAM.
const ASSUMED_PURCHASES_PER_BUYER_PER_YEAR = 1;

export interface MarketSizingResult {
  inputs: MarketSizingInput;
  population: number;
  addressableBuyers: number;
  demographicMatchRate: number;
  marketShareTrajectory: number;
  tam: number;
  sam: number;
  som: number;
  thisCountryCustomers: number;
  totalCustomers: number;
  totalCompanyRevenue: number;
  methodology: string[];
}

export async function computeMarketSizing({ country, category, pricePoint }: MarketSizingInput): Promise<MarketSizingResult> {
  const population = POPULATION[country];
  if (!population) {
    throw new Error(`No reference population figure for "${country}"`);
  }

  const [countryCounts] = await bigquery.query(
    `SELECT country, COUNT(*) AS n FROM \`${PROJECT}.crm_customers\` GROUP BY country`
  );
  const [ltvRows] = await bigquery.query(
    `SELECT segment, COUNT(*) AS n FROM \`${PROJECT}.crm_customers\` GROUP BY segment`
  );
  const [revenueRows] = await bigquery.query(
    `SELECT SUM(revenue_actual) AS total FROM \`${PROJECT}.finance_channel_monthly\``
  );
  const totalCompanyRevenue = revenueRows[0]?.total ?? 0;

  const totalCustomers = countryCounts.reduce((s: number, r: any) => s + r.n, 0);
  const thisCountryCustomers = countryCounts.find((r: any) => r.country === country)?.n ?? 0;
  const repeatOrVipCount = ltvRows
    .filter((r: any) => r.segment === "VIP" || r.segment === "returning")
    .reduce((s: number, r: any) => s + r.n, 0);
  const demographicMatchRate = totalCustomers > 0 ? repeatOrVipCount / totalCustomers : 0;

  const nonZeroShares = countryCounts.filter((r: any) => r.n > 0).map((r: any) => r.n / totalCustomers);
  const floorShare = nonZeroShares.length > 0 ? Math.min(...nonZeroShares) : 0;
  const thisCountryShare = totalCustomers > 0 ? thisCountryCustomers / totalCustomers : 0;
  const marketShareTrajectory = thisCountryShare > 0 ? thisCountryShare : floorShare;

  const addressableBuyers = Math.round(population * LUXURY_PENETRATION_RATE);
  const tam = Math.round(addressableBuyers * pricePoint * ASSUMED_PURCHASES_PER_BUYER_PER_YEAR);
  const sam = Math.round(tam * demographicMatchRate);
  const som = Math.round(sam * marketShareTrajectory);

  const methodology = [
    `TAM: ${country}'s population (~${population.toLocaleString()}, an approximate external reference figure, not from BigQuery or Maison Lumière's own data) × a ${(LUXURY_PENETRATION_RATE * 100).toFixed(1)}% luxury-goods-buyer penetration rate (an industry rule-of-thumb assumption, not measured) = ~${addressableBuyers.toLocaleString()} addressable buyers. At €${pricePoint.toLocaleString()} per purchase, assuming ${ASSUMED_PURCHASES_PER_BUYER_PER_YEAR} purchase/buyer/year, TAM ≈ €${tam.toLocaleString()}/year. This is the same for any product category at this price point — the model has no real per-category population data to differentiate further, which is a real limitation worth being explicit about.`,
    `SAM: TAM narrowed by ${(demographicMatchRate * 100).toFixed(1)}%, the real share of Maison Lumière's own ${totalCustomers} tracked customers who are VIP or returning (repeat luxury buyers) — used as a proxy for "the share of any addressable market that plausibly matches our real customer profile."`,
    thisCountryCustomers > 0
      ? `SOM: SAM narrowed by ${(marketShareTrajectory * 100).toFixed(2)}%, ${country}'s real current share of the brand's ${totalCustomers} tracked customers (${thisCountryCustomers} of them) — the brand's own real current market-share trajectory in this country.`
      : `SOM: ${country} has 0 real tracked customers today, so its own trajectory can't be measured directly. SOM instead uses ${(marketShareTrajectory * 100).toFixed(2)}%, the smallest real non-zero share held in any market the brand is already in — a conservative floor for a market with no current footprint, not a projection specific to ${country}.`,
    `Interpretation: SOM (€${som.toLocaleString()}) is this model's estimate of realistically obtainable annual revenue in ${country} given Maison Lumière's current customer profile and trajectory. For scale, that's ${(som / totalCompanyRevenue).toFixed(1)}× the brand's real current total revenue across every market (€${totalCompanyRevenue.toLocaleString()}) — a reminder that this is a directional ceiling from a simplified model built on a thin real customer base, not a precise forecast. Use it to compare opportunity size across candidate markets, not as a number to budget against directly.`,
  ];

  return {
    inputs: { country, category, pricePoint },
    population,
    addressableBuyers,
    demographicMatchRate: Math.round(demographicMatchRate * 1000) / 10,
    marketShareTrajectory: Math.round(marketShareTrajectory * 10000) / 100,
    tam,
    sam,
    som,
    thisCountryCustomers,
    totalCustomers,
    totalCompanyRevenue,
    methodology,
  };
}
