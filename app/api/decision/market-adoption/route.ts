import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const LUXURY_PENETRATION_RATE = 0.015;
const YEARS = 5;

// Same external reference population data as the Market Sizing calculator --
// kept in sync deliberately so the two tools agree on market size.
const POPULATION: Record<string, number> = {
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

function bassCumulativeFraction(p: number, q: number, t: number): number {
  const e = Math.exp(-(p + q) * t);
  return (1 - e) / (1 + (q / p) * e);
}

function projectYears(p: number, q: number, m: number, avgPrice: number) {
  let prevF = 0;
  return Array.from({ length: YEARS }, (_, i) => {
    const year = i + 1;
    const f = bassCumulativeFraction(p, q, year);
    const newAdoptersFraction = f - prevF;
    const newAdopters = Math.round(m * newAdoptersFraction);
    const cumulativeAdopters = Math.round(m * f);
    prevF = f;
    return { year, cumulativeAdopters, newAdopters, revenue: Math.round(newAdopters * avgPrice) };
  });
}

export async function POST(req: Request) {
  const { country, p, q, avgPrice } = await req.json();

  if (!country || p === undefined || q === undefined || !avgPrice) {
    return NextResponse.json({ error: "country, p, q, and avgPrice are required" }, { status: 400 });
  }
  const population = POPULATION[country];
  if (!population) {
    return NextResponse.json({ error: `No reference population figure for "${country}"` }, { status: 400 });
  }
  if (p <= 0 || q <= 0) {
    return NextResponse.json({ error: "p and q must both be positive" }, { status: 400 });
  }

  try {
    const m = Math.round(population * LUXURY_PENETRATION_RATE);

    const base = projectYears(p, q, m, avgPrice);
    const conservative = projectYears(p, q * 0.7, m, avgPrice);
    const optimistic = projectYears(p, q * 1.3, m, avgPrice);

    const inflectionYear = Math.log(q / p) / (p + q);

    const methodology = [
      `Market size (M = ${m.toLocaleString()} potential adopters) uses the same method as the Market Sizing (TAM/SAM/SOM) calculator: ${country}'s population (~${population.toLocaleString()}, an approximate external reference figure) × a ${(LUXURY_PENETRATION_RATE * 100).toFixed(1)}% luxury-goods-buyer penetration assumption.`,
      `The Bass diffusion model splits adoption into innovation (p, people who adopt independently — set to ${p}) and imitation (q, people who adopt because others already have — set to ${q}). Both are industry-benchmark values for luxury goods, not fit to Maison Lumière's own data — this dataset doesn't have the multi-year market-entry history a real Bass-model fit would need.`,
      `Cumulative adoption fraction F(t) = (1 − e^(−(p+q)t)) ÷ (1 + (q/p)e^(−(p+q)t)), the standard closed-form Bass solution. New adopters each year = M × the change in F(t) from the prior year. Revenue approximates each new adopter's first-year spend at your input price (€${avgPrice.toLocaleString()}) — repeat purchases beyond year 1 aren't modeled here (see the CLV Analyzer for repeat-purchase value).`,
      `Adoption inflects (grows fastest) at t* = ln(q/p) ÷ (p+q) = year ${inflectionYear.toFixed(1)} — this is the standard Bass-model answer to "when does this market take off." It is not the same as "when does it become profitable," which depends on your cost structure — pair this with the NPV/Payback calculator or your own entry-cost estimate to answer that.`,
      `Conservative and optimistic scenarios vary q by ∓30% (word-of-mouth propagation is the most uncertain input in practice) while holding p and market size fixed.`,
    ];

    return NextResponse.json({
      inputs: { country, p, q, avgPrice },
      marketSize: m,
      inflectionYear: Math.round(inflectionYear * 10) / 10,
      scenarios: { conservative, base, optimistic },
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
