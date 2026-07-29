import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Documented planning assumptions (not fitted from data -- the platform has
// no real headcount, fit-out cost, or multi-year store data to fit these
// from). Each is named explicitly in the methodology response so a user
// never mistakes an assumption for a measured fact.
const ASSUMED_MONTHLY_COST_PER_STAFF = 3000; // EUR, fully loaded, per retail staff member
const ASSUMED_FITOUT_MULTIPLE_OF_RENT = 8; // typical luxury retail fit-out + opening cost, in months of rent
const ASSUMED_CANNIBALIZATION_RATE = 0.15; // share of existing local ecommerce revenue a new store typically absorbs in Year 1
const YEAR_RAMP = { year1: 0.75, year2: 1.0, year3: 1.08 }; // new-store ramp curve

export async function POST(req: Request) {
  const { city, rent, staffCount, customerProfile } = await req.json();

  if (!city || !rent || !staffCount) {
    return NextResponse.json({ error: "city, rent, and staffCount are required" }, { status: 400 });
  }

  try {
    const [storeRows] = await bigquery.query(
      `SELECT * FROM \`${PROJECT}.store_performance\` ORDER BY store_id, period`
    );
    const [ltvRows] = await bigquery.query(
      `SELECT segment, AVG(lifetime_value) AS avg_ltv, COUNT(*) AS n FROM \`${PROJECT}.crm_customers\` GROUP BY segment`
    );
    const [ecomRows] = await bigquery.query(
      `SELECT geo_city, SUM(revenue) AS revenue
       FROM \`${PROJECT}.sales_events\`
       WHERE event_name = 'purchase' AND revenue > 0
       GROUP BY geo_city`
    );

    // -- Comparable-store ratios (real data) --
    const totalRevenue = storeRows.reduce((s: number, r: any) => s + r.revenue, 0);
    const totalRent = storeRows.reduce((s: number, r: any) => s + r.rent, 0);
    const totalStaffCost = storeRows.reduce((s: number, r: any) => s + r.staff_cost, 0);
    const revenuePerRentEuro = totalRevenue / totalRent;
    const revenuePerStaffEuro = totalRevenue / totalStaffCost;

    const estimatedStaffCost = staffCount * ASSUMED_MONTHLY_COST_PER_STAFF;
    const rentBasedEstimate = rent * revenuePerRentEuro;
    const staffBasedEstimate = estimatedStaffCost * revenuePerStaffEuro;
    let baseMonthlyRevenue = (rentBasedEstimate + staffBasedEstimate) / 2;

    // -- Customer-profile adjustment (real ratio, only applied if selected) --
    const ltvBySegment: Record<string, number> = {};
    ltvRows.forEach((r: any) => (ltvBySegment[r.segment] = r.avg_ltv));
    const overallAvgLtv =
      ltvRows.reduce((s: number, r: any) => s + r.avg_ltv * r.n, 0) /
      ltvRows.reduce((s: number, r: any) => s + r.n, 0);

    let profileMultiplier = 1;
    let profileNote = "Broad customer profile — no adjustment applied.";
    if (customerProfile === "vip" && ltvBySegment.VIP) {
      profileMultiplier = ltvBySegment.VIP / overallAvgLtv;
      profileNote = `VIP-focused profile — revenue scaled by ${profileMultiplier.toFixed(2)}x, the real ratio of VIP-segment average lifetime value (€${Math.round(ltvBySegment.VIP).toLocaleString()}) to the overall average (€${Math.round(overallAvgLtv).toLocaleString()}) across all ${ltvRows.reduce((s: number, r: any) => s + r.n, 0)} customers.`;
    } else if (customerProfile === "new_to_brand" && ltvBySegment.new) {
      profileMultiplier = ltvBySegment.new / overallAvgLtv;
      profileNote = `New-to-brand profile — revenue scaled by ${profileMultiplier.toFixed(2)}x, the real ratio of new-customer average lifetime value to the overall average.`;
    }
    baseMonthlyRevenue *= profileMultiplier;

    const year1Revenue = Math.round(baseMonthlyRevenue * 12 * YEAR_RAMP.year1);
    const year2Revenue = Math.round(baseMonthlyRevenue * 12 * YEAR_RAMP.year2);
    const year3Revenue = Math.round(baseMonthlyRevenue * 12 * YEAR_RAMP.year3);

    // -- Break-even --
    const year1MonthlyRevenue = (baseMonthlyRevenue * YEAR_RAMP.year1);
    const monthlyContribution = year1MonthlyRevenue - estimatedStaffCost - rent;
    const fitOutCost = rent * ASSUMED_FITOUT_MULTIPLE_OF_RENT;
    const breakEvenMonths = monthlyContribution > 0 ? Math.ceil(fitOutCost / monthlyContribution) : null;

    // -- Profitability odds (real base rate) --
    const profitableMonths = storeRows.filter((r: any) => r.revenue - r.staff_cost - r.rent > 0).length;
    const profitabilityPct = Math.round((profitableMonths / storeRows.length) * 100);

    // -- Cannibalization risk (real if the city has online sales history) --
    const cityEcom = ecomRows.find((r: any) => r.geo_city?.toLowerCase() === String(city).toLowerCase());
    const cannibalization = cityEcom
      ? {
          available: true,
          existingAnnualEcommerceRevenue: cityEcom.revenue,
          estimatedAnnualImpact: Math.round(cityEcom.revenue * ASSUMED_CANNIBALIZATION_RATE),
        }
      : { available: false, reason: `No recorded online purchases from "${city}" in the platform's event data — cannibalization can't be estimated from real data for this market.` };

    const comparableStoreCount = new Set(storeRows.map((r: any) => r.store_id)).size;
    const methodology = [
      `Revenue projection is based on Maison Lumière's ${comparableStoreCount} existing stores: across all of them, every €1 of rent has historically produced €${revenuePerRentEuro.toFixed(2)} of revenue, and every €1 of staff cost has produced €${revenuePerStaffEuro.toFixed(2)} of revenue. Those two real ratios are applied to your rent and staff inputs and averaged.`,
      `Staff cost is estimated from headcount using an assumed €${ASSUMED_MONTHLY_COST_PER_STAFF.toLocaleString()}/month fully-loaded cost per staff member — a planning assumption, not a figure this dataset tracks directly.`,
      profileNote,
      `Year 1–3 apply a standard new-store ramp curve (${Math.round(YEAR_RAMP.year1 * 100)}% / ${Math.round(YEAR_RAMP.year2 * 100)}% / ${Math.round(YEAR_RAMP.year3 * 100)}% of steady-state monthly revenue) — an industry planning heuristic, since the platform has no real multi-year store data to fit a ramp curve from.`,
      `Break-even assumes a one-time fit-out and opening cost of ${ASSUMED_FITOUT_MULTIPLE_OF_RENT}× monthly rent (a common luxury-retail rule of thumb) divided by projected monthly contribution (revenue minus staff cost minus rent) during the Year 1 ramp.`,
      `Profitability odds (${profitabilityPct}%) is the real share of store-months across all existing stores that had positive contribution margin — a historical base rate, not a formal statistical forecast.`,
      cannibalization.available
        ? `Cannibalization is estimated at ${Math.round(ASSUMED_CANNIBALIZATION_RATE * 100)}% of ${city}'s real existing e-commerce revenue (€${cannibalization.existingAnnualEcommerceRevenue.toLocaleString()}/year) shifting to the new store — a commonly cited industry range for retail-launches-near-existing-online-demand, applied to real local revenue.`
        : cannibalization.reason,
    ];

    return NextResponse.json({
      inputs: { city, rent, staffCount, customerProfile },
      comparableStoreCount,
      revenuePerRentEuro: Math.round(revenuePerRentEuro * 100) / 100,
      revenuePerStaffEuro: Math.round(revenuePerStaffEuro * 100) / 100,
      projectedYear1Revenue: year1Revenue,
      projectedYear2Revenue: year2Revenue,
      projectedYear3Revenue: year3Revenue,
      breakEvenMonths,
      profitabilityOdds: { pct: profitabilityPct, sampleSize: storeRows.length },
      cannibalization,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
