import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const ALLOWED_WINDOWS = [14, 30, 60];
const MIN_RELIABLE_SAMPLE = 50;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const { treatmentCountry, controlCountry, campaignStartDate, windowDays } = await req.json();

  if (!treatmentCountry || !controlCountry || !campaignStartDate || !windowDays) {
    return NextResponse.json(
      { error: "treatmentCountry, controlCountry, campaignStartDate, and windowDays are required" },
      { status: 400 }
    );
  }
  if (treatmentCountry === controlCountry) {
    return NextResponse.json({ error: "Control market must be different from the treatment market" }, { status: 400 });
  }
  if (!ALLOWED_WINDOWS.includes(windowDays)) {
    return NextResponse.json({ error: `windowDays must be one of ${ALLOWED_WINDOWS.join(", ")}` }, { status: 400 });
  }

  try {
    // windowDays is validated against a fixed whitelist above, so it's safe
    // to interpolate directly -- BigQuery INTERVAL literals can't take a
    // query parameter, and this avoids the risk of an untested parameterized
    // INTERVAL syntax for something this simple.
    const [rows] = await bigquery.query({
      query: `
        SELECT
          CASE WHEN country = @treatmentCountry THEN 'treatment' ELSE 'control' END AS role,
          CASE WHEN event_timestamp < TIMESTAMP(@startDate) THEN 'before' ELSE 'after' END AS period,
          SUM(revenue) AS revenue,
          COUNT(*) AS n
        FROM \`${PROJECT}.sales_events\`
        WHERE country IN (@treatmentCountry, @controlCountry)
          AND event_name = 'purchase' AND revenue > 0
          AND event_timestamp >= TIMESTAMP_SUB(TIMESTAMP(@startDate), INTERVAL ${windowDays} DAY)
          AND event_timestamp < TIMESTAMP_ADD(TIMESTAMP(@startDate), INTERVAL ${windowDays} DAY)
        GROUP BY role, period`,
      params: { treatmentCountry, controlCountry, startDate: bigquery.date(campaignStartDate) },
      types: { treatmentCountry: "STRING", controlCountry: "STRING", startDate: "DATE" },
    });

    const find = (role: string, period: string) => {
      const r = rows.find((x: any) => x.role === role && x.period === period);
      return { revenue: r?.revenue ?? 0, n: r?.n ?? 0 };
    };
    const tBefore = find("treatment", "before");
    const tAfter = find("treatment", "after");
    const cBefore = find("control", "before");
    const cAfter = find("control", "after");

    const startDate = new Date(campaignStartDate + "T00:00:00Z");
    const beforeStart = fmtDate(new Date(startDate.getTime() - windowDays * 86400000));
    const afterEnd = fmtDate(new Date(startDate.getTime() + windowDays * 86400000));

    const canComputePct = tBefore.revenue > 0 && cBefore.revenue > 0;
    const pctChangeTreatment = canComputePct ? ((tAfter.revenue - tBefore.revenue) / tBefore.revenue) * 100 : null;
    const pctChangeControl = canComputePct ? ((cAfter.revenue - cBefore.revenue) / cBefore.revenue) * 100 : null;
    const diDLiftPct = canComputePct ? pctChangeTreatment! - pctChangeControl! : null;
    const incrementalRevenueEuro = canComputePct ? Math.round((tBefore.revenue * diDLiftPct!) / 100) : null;
    const absoluteDiD = (tAfter.revenue - tBefore.revenue) - (cAfter.revenue - cBefore.revenue);

    const sampleSizes = { treatmentBefore: tBefore.n, treatmentAfter: tAfter.n, controlBefore: cBefore.n, controlAfter: cAfter.n };
    const smallestSample = Math.min(...Object.values(sampleSizes));
    const lowConfidence = smallestSample < MIN_RELIABLE_SAMPLE;

    const methodology = [
      `Before period: ${beforeStart} to ${campaignStartDate} (${windowDays} days). After period: ${campaignStartDate} to ${afterEnd} (${windowDays} days). Both drawn from real sales_events purchase records (event_name = 'purchase', revenue > 0).`,
      `${treatmentCountry} (treatment): €${tBefore.revenue.toLocaleString()} before (${tBefore.n} orders) → €${tAfter.revenue.toLocaleString()} after (${tAfter.n} orders).`,
      `${controlCountry} (control): €${cBefore.revenue.toLocaleString()} before (${cBefore.n} orders) → €${cAfter.revenue.toLocaleString()} after (${cAfter.n} orders).`,
      canComputePct
        ? `Difference-in-differences: ${treatmentCountry} changed ${pctChangeTreatment!.toFixed(1)}%, ${controlCountry} changed ${pctChangeControl!.toFixed(1)}% in the same window. The gap (${diDLiftPct!.toFixed(1)} percentage points) is attributed to the campaign, on the assumption that ${controlCountry} shows what ${treatmentCountry} would have done anyway without it (the "parallel trends" assumption this method depends on — it can't be verified from a single pre-period, only judged as more or less plausible based on how similar the two markets are).`
        : `Difference-in-differences percentage effect could not be computed because one of the pre-campaign baselines had €0 in recorded revenue.`,
      canComputePct
        ? `Estimated incremental revenue (€${incrementalRevenueEuro!.toLocaleString()}) = ${treatmentCountry}'s pre-campaign baseline revenue (€${tBefore.revenue.toLocaleString()}) × the ${diDLiftPct!.toFixed(1)} percentage-point lift. Shown separately, the raw additive difference-in-differences on absolute euros is €${absoluteDiD.toLocaleString()} — the two can diverge when treatment and control markets are very different sizes, which is why the percentage-based estimate is used as the headline number.`
        : `Raw additive difference-in-differences (treatment change minus control change, in euros): €${absoluteDiD.toLocaleString()}.`,
      lowConfidence
        ? `Confidence warning: the smallest of the four groups has only ${smallestSample} order(s). Maison Lumière's per-market order volume is low in this dataset, so short before/after windows very often fall under a statistically reliable sample size — treat this result as directional, not a precise estimate.`
        : `All four groups (treatment/control × before/after) have at least ${MIN_RELIABLE_SAMPLE} orders, the minimum this tool treats as a reasonably reliable sample.`,
    ];

    return NextResponse.json({
      inputs: { treatmentCountry, controlCountry, campaignStartDate, windowDays },
      window: { beforeStart, campaignStartDate, afterEnd },
      treatment: { before: tBefore, after: tAfter },
      control: { before: cBefore, after: cAfter },
      pctChangeTreatment: pctChangeTreatment !== null ? Math.round(pctChangeTreatment * 10) / 10 : null,
      pctChangeControl: pctChangeControl !== null ? Math.round(pctChangeControl * 10) / 10 : null,
      diDLiftPct: diDLiftPct !== null ? Math.round(diDLiftPct * 10) / 10 : null,
      incrementalRevenueEuro,
      absoluteDiD,
      sampleSizes,
      lowConfidence,
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
