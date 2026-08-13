// Shared real computation for the `returns` table, matching the exact stats
// app/returns/page.tsx already computes client-side (totalRefunded,
// linkedToCampaign, avgRefund, linkedPct) so lib/ai-demo-mode.ts never shows
// a different number than the real Returns page. /api/returns itself stays
// a thin pass-through (the page needs the raw rows to render its table), so
// this summary is computed here rather than extracted from that route.
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export interface ReturnsSummary {
  totalReturns: number;
  totalRefunded: number;
  avgRefund: number;
  linkedToCampaign: number;
  linkedPct: number;
  topReason: { reason: string; count: number } | null;
}

export async function getReturnsSummary(): Promise<ReturnsSummary> {
  const [rows] = await bigquery.query(`
    SELECT order_id, product_slug, reason, return_date, refund_amount, influencer_campaign
    FROM \`${PROJECT}.returns\`
  `);

  const totalReturns = rows.length;
  const totalRefunded = rows.reduce((s: number, r: any) => s + (r.refund_amount || 0), 0);
  const linkedToCampaign = rows.filter((r: any) => r.influencer_campaign).length;
  const avgRefund = totalReturns ? totalRefunded / totalReturns : 0;
  const linkedPct = totalReturns ? (linkedToCampaign / totalReturns) * 100 : 0;

  const reasonCounts: Record<string, number> = {};
  rows.forEach((r: any) => {
    if (!r.reason) return;
    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  });
  const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  const topReason = topReasonEntry ? { reason: topReasonEntry[0], count: topReasonEntry[1] } : null;

  return { totalReturns, totalRefunded, avgRefund, linkedToCampaign, linkedPct, topReason };
}
