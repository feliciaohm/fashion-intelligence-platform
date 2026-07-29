import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

function pct(part: number, total: number): number {
  return total ? (part / total) * 100 : 0;
}

export async function GET() {
  try {
    const [
      [channelRows],
      [costCenterRows],
      [overheadRows],
      [storeTxRows],
      [ecommerceTxRows],
      [wholesaleTxRows],
    ] = await Promise.all([
      bigquery.query(`SELECT * FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month`),
      bigquery.query(`SELECT * FROM \`${PROJECT}.cost_centers\` WHERE name IN ('marketing', 'logistics') ORDER BY period`),
      bigquery.query(`SELECT * FROM \`${PROJECT}.overhead_departments\` ORDER BY period`),
      bigquery.query(`SELECT period, SUM(transactions) AS tx FROM \`${PROJECT}.store_performance\` GROUP BY period`),
      bigquery.query(
        `SELECT FORMAT_TIMESTAMP('%Y-%m', event_timestamp) AS period, COUNT(*) AS tx
         FROM \`${PROJECT}.sales_events\` WHERE event_name = 'purchase' AND revenue > 0 GROUP BY period`
      ),
      bigquery.query(
        `SELECT FORMAT_DATE('%Y-%m', order_date) AS period, COUNT(*) AS tx
         FROM \`${PROJECT}.wholesale_orders\` GROUP BY period`
      ),
    ]);

    const months = Array.from(new Set(channelRows.map((r: any) => r.month))).sort() as string[];
    const latestPeriod = months[months.length - 1];

    const latestChannels = channelRows.filter((r: any) => r.month === latestPeriod);
    const byChannel: Record<string, { revenue: number; cogs: number }> = {};
    latestChannels.forEach((r: any) => {
      byChannel[r.channel] = { revenue: r.revenue_actual, cogs: r.cogs };
    });
    const CHANNELS = ["retail", "ecommerce", "wholesale"] as const;
    const totalRevenue = CHANNELS.reduce((s, c) => s + (byChannel[c]?.revenue || 0), 0);

    const retailTx = storeTxRows.find((r: any) => r.period === latestPeriod)?.tx || 0;
    const ecommerceTx = ecommerceTxRows.find((r: any) => r.period === latestPeriod)?.tx || 0;
    const wholesaleTx = wholesaleTxRows.find((r: any) => r.period === latestPeriod)?.tx || 0;
    const totalTx = retailTx + ecommerceTx + wholesaleTx;
    const txByChannel: Record<string, number> = { retail: retailTx, ecommerce: ecommerceTx, wholesale: wholesaleTx };

    const marketingActual = costCenterRows.find((r: any) => r.name === "marketing" && r.period === latestPeriod)?.actual || 0;
    const logisticsActual = costCenterRows.find((r: any) => r.name === "logistics" && r.period === latestPeriod)?.actual || 0;
    const itActual = overheadRows.find((r: any) => r.name === "it" && r.period === latestPeriod)?.actual || 0;
    const hrActual = overheadRows.find((r: any) => r.name === "hr" && r.period === latestPeriod)?.actual || 0;

    // Default allocation % per department, driven by the real activity
    // basis a given cost pool actually scales with -- not a single blanket
    // "split by revenue" rule, which is the naive allocation this page
    // exists to improve on. Marketing and IT are revenue-driven (systems/
    // campaign spend scales with sales volume in €); Logistics is driven by
    // real transaction/order counts (it scales with units moved, not their
    // value); HR has no headcount table in this dataset, so it defaults to
    // an even split, named as an assumption -- every default is a starting
    // point the user can override with the sliders below.
    const departments = [
      {
        id: "marketing",
        label: "Marketing",
        actual: marketingActual,
        type: "REAL",
        driver: "revenue share",
        defaultPct: {
          retail: Math.round(pct(byChannel.retail?.revenue || 0, totalRevenue) * 10) / 10,
          ecommerce: Math.round(pct(byChannel.ecommerce?.revenue || 0, totalRevenue) * 10) / 10,
          wholesale: Math.round(pct(byChannel.wholesale?.revenue || 0, totalRevenue) * 10) / 10,
        },
      },
      {
        id: "it",
        label: "IT",
        actual: itActual,
        type: "ILLUSTRATIVE",
        driver: "revenue share",
        defaultPct: {
          retail: Math.round(pct(byChannel.retail?.revenue || 0, totalRevenue) * 10) / 10,
          ecommerce: Math.round(pct(byChannel.ecommerce?.revenue || 0, totalRevenue) * 10) / 10,
          wholesale: Math.round(pct(byChannel.wholesale?.revenue || 0, totalRevenue) * 10) / 10,
        },
      },
      {
        id: "logistics",
        label: "Logistics",
        actual: logisticsActual,
        type: "REAL",
        driver: "transaction/order count share",
        defaultPct: {
          retail: Math.round(pct(txByChannel.retail, totalTx) * 10) / 10,
          ecommerce: Math.round(pct(txByChannel.ecommerce, totalTx) * 10) / 10,
          wholesale: Math.round(pct(txByChannel.wholesale, totalTx) * 10) / 10,
        },
      },
      {
        id: "hr",
        label: "HR",
        actual: hrActual,
        type: "ILLUSTRATIVE",
        driver: "even split (no headcount-by-channel data exists)",
        defaultPct: { retail: 33.3, ecommerce: 33.3, wholesale: 33.4 },
      },
    ];

    // Normalize each department's defaults to sum exactly 100 (rounding can
    // leave e.g. 99.9 or 100.1).
    departments.forEach((d) => {
      const sum = d.defaultPct.retail + d.defaultPct.ecommerce + d.defaultPct.wholesale;
      if (sum > 0 && Math.abs(sum - 100) > 0.01) {
        d.defaultPct.wholesale = Math.round((100 - d.defaultPct.retail - d.defaultPct.ecommerce) * 10) / 10;
      }
    });

    const channels = CHANNELS.map((c) => ({
      channel: c,
      revenue: byChannel[c]?.revenue || 0,
      cogs: byChannel[c]?.cogs || 0,
      grossProfit: (byChannel[c]?.revenue || 0) - (byChannel[c]?.cogs || 0),
      transactions: txByChannel[c],
    }));

    return NextResponse.json({
      latestPeriod,
      channels,
      departments,
      totalOverhead: marketingActual + logisticsActual + itActual + hrActual,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
