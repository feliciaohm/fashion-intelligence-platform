import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { safeDivide, type SafeDivideResult } from "@/lib/data-quality";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const CHECKPOINTS = [30, 60, 90, 180];

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export async function GET() {
  try {
    const [[todayRow], rows] = await Promise.all([
      bigquery.query(`SELECT MAX(event_timestamp) AS latest FROM \`${PROJECT}.sales_events\``).then((r) => r as any),
      bigquery.query(`
        SELECT c.customer_id, c.first_purchase_date, j.last_activity_date, j.first_touch_source
        FROM \`${PROJECT}.crm_customers\` c
        JOIN \`${PROJECT}.customer_journey\` j ON j.customer_id = c.customer_id
        WHERE c.first_purchase_date IS NOT NULL AND j.last_activity_date IS NOT NULL
      `),
    ]);

    const today = (todayRow[0]?.latest?.value ?? todayRow[0]?.latest ?? new Date().toISOString()).toString();

    // Every real customer's first_touch_source in this dataset starts with
    // "influencer_" (verified directly -- there is no organic-acquired
    // customer at all yet, the same fact behind Consulting Case Finding 1).
    // The channel split is built for real, not hidden -- it just has one
    // real side and one empty side today.
    const withChannel = rows.map((r: any) => ({
      ...r,
      channel: String(r.first_touch_source ?? "").startsWith("influencer") ? "influencer" : "organic",
    }));

    const cohortMap: Record<string, { channel: string; customers: any[] }> = {};
    withChannel.forEach((r: any) => {
      const firstPurchase = r.first_purchase_date?.value ?? r.first_purchase_date;
      const month = String(firstPurchase).slice(0, 7);
      const key = `${month}|${r.channel}`;
      if (!cohortMap[key]) cohortMap[key] = { channel: r.channel, customers: [] };
      cohortMap[key].customers.push({ ...r, first_purchase_date: firstPurchase });
    });

    const cohorts = Object.entries(cohortMap)
      .map(([key, group]) => {
        const [month] = key.split("|");
        const retention: Record<number, SafeDivideResult> = {};
        CHECKPOINTS.forEach((checkpoint) => {
          let observable = 0;
          let retained = 0;
          group.customers.forEach((c: any) => {
            const lastActivity = c.last_activity_date?.value ?? c.last_activity_date;
            const ageOfCohort = daysBetween(c.first_purchase_date, today);
            if (ageOfCohort < checkpoint) return; // not old enough to observe this checkpoint yet
            observable += 1;
            if (daysBetween(c.first_purchase_date, lastActivity) >= checkpoint) retained += 1;
          });
          const pct = safeDivide(retained, observable);
          retention[checkpoint] = typeof pct === "number" ? Math.round(pct * 1000) / 10 : pct;
        });
        return {
          cohortMonth: month,
          channel: group.channel,
          customerCount: group.customers.length,
          retention,
        };
      })
      .sort((a, b) => (a.cohortMonth < b.cohortMonth ? -1 : 1));

    const channelCounts = { influencer: 0, organic: 0 };
    withChannel.forEach((r: any) => {
      channelCounts[r.channel as "influencer" | "organic"] += 1;
    });

    return NextResponse.json({
      today,
      cohorts,
      checkpoints: CHECKPOINTS,
      channelCounts,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
