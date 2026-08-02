import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
const DEFAULT_LAMBDA = 0.1;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lambda = typeof body.lambda === "number" && body.lambda > 0 ? body.lambda : DEFAULT_LAMBDA;

  try {
    const [purchaserRows] = await bigquery.query(`
      SELECT DISTINCT user_pseudo_id
      FROM \`${PROJECT}.sales_events\`
      WHERE event_name = 'purchase' AND revenue > 0
    `);
    const purchaserIds: string[] = purchaserRows.map((r: any) => r.user_pseudo_id);

    const [eventRows] = await bigquery.query({
      query: `
        SELECT user_pseudo_id, event_timestamp, traffic_source, event_name, revenue
        FROM \`${PROJECT}.sales_events\`
        WHERE user_pseudo_id IN UNNEST(@ids)
        ORDER BY user_pseudo_id, event_timestamp
      `,
      params: { ids: purchaserIds },
    });

    const byUser: Record<string, any[]> = {};
    eventRows.forEach((r: any) => {
      if (!byUser[r.user_pseudo_id]) byUser[r.user_pseudo_id] = [];
      byUser[r.user_pseudo_id].push(r);
    });

    const timeDecayBySource: Record<string, number> = {};
    const lastTouchBySource: Record<string, number> = {};
    let totalRevenue = 0;
    let customersWithMultiTouch = 0;
    let totalTouchpoints = 0;

    Object.values(byUser).forEach((events) => {
      // order_count is 1 for every real customer in this dataset (verified),
      // so the first real purchase row chronologically is the conversion --
      // everything at or before it in this user's own event history is a
      // real touchpoint on the path to it.
      const purchaseEvent = events.find((e) => e.event_name === "purchase" && e.revenue > 0);
      if (!purchaseEvent) return;
      const purchaseTime = new Date(purchaseEvent.event_timestamp.value ?? purchaseEvent.event_timestamp).getTime();
      const touchpoints = events.filter(
        (e) => new Date(e.event_timestamp.value ?? e.event_timestamp).getTime() <= purchaseTime
      );
      if (touchpoints.length === 0) return;

      totalRevenue += purchaseEvent.revenue;
      totalTouchpoints += touchpoints.length;
      if (touchpoints.length > 1) customersWithMultiTouch += 1;

      const weights = touchpoints.map((tp) => {
        const t = tp === touchpoints[touchpoints.length - 1]
          ? 0
          : (purchaseTime - new Date(tp.event_timestamp.value ?? tp.event_timestamp).getTime()) / 86400000;
        return Math.exp(-lambda * t);
      });
      const weightSum = weights.reduce((s, w) => s + w, 0);

      touchpoints.forEach((tp, i) => {
        const source = tp.traffic_source || "unknown";
        const normalizedWeight = weights[i] / weightSum;
        timeDecayBySource[source] = (timeDecayBySource[source] || 0) + normalizedWeight * purchaseEvent.revenue;
      });

      // Last-touch: 100% of credit to whichever real touchpoint is closest
      // in time to the purchase (often the purchase event's own source when
      // there's no earlier touchpoint at all).
      const lastTouch = touchpoints[touchpoints.length - 1];
      const lastSource = lastTouch.traffic_source || "unknown";
      lastTouchBySource[lastSource] = (lastTouchBySource[lastSource] || 0) + purchaseEvent.revenue;
    });

    const sources = Array.from(new Set([...Object.keys(timeDecayBySource), ...Object.keys(lastTouchBySource)]));
    const comparison = sources
      .map((source) => ({
        source,
        lastTouchRevenue: Math.round(lastTouchBySource[source] || 0),
        timeDecayRevenue: Math.round(timeDecayBySource[source] || 0),
      }))
      .sort((a, b) => b.timeDecayRevenue - a.timeDecayRevenue);

    return NextResponse.json({
      lambda,
      totalRevenue: Math.round(totalRevenue),
      customersAnalyzed: Object.keys(byUser).length,
      customersWithMultiTouch,
      avgTouchpointsPerCustomer: Math.round((totalTouchpoints / Object.keys(byUser).length) * 100) / 100,
      comparison,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
