import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

interface MonthRevenue {
  month: string;
  revenue: number;
}

function monthMidpointDate(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15));
}

function windowMidpoint(window: MonthRevenue[]): Date {
  const avgMs = window.reduce((s, w) => s + monthMidpointDate(w.month).getTime(), 0) / window.length;
  return new Date(avgMs);
}

function computeSeries(months: MonthRevenue[]) {
  const n = months.length;
  const windowSize = Math.min(3, n);
  const earlyWindow = months.slice(0, windowSize);
  const lateWindow = months.slice(n - windowSize);

  const avgEarly = earlyWindow.reduce((s, w) => s + w.revenue, 0) / earlyWindow.length;
  const avgLate = lateWindow.reduce((s, w) => s + w.revenue, 0) / lateWindow.length;

  const earlyMid = windowMidpoint(earlyWindow);
  const lateMid = windowMidpoint(lateWindow);
  const years = Math.max((lateMid.getTime() - earlyMid.getTime()) / (365.25 * 86400000), 0.01);

  const smoothedCagrPct = avgEarly > 0 ? (Math.pow(avgLate / avgEarly, 1 / years) - 1) * 100 : null;

  // Literal single-endpoint version of the exact user-given formula, for transparency --
  // shown alongside the smoothed figure since a single start/end month on a business this
  // seasonal (see the real Sept-Nov wholesale ramp / real ecommerce data gap below) can be
  // extreme and misleading as a standalone headline number.
  const rawStart = months[0];
  const rawEnd = months[n - 1];
  const rawYears = Math.max((monthMidpointDate(rawEnd.month).getTime() - monthMidpointDate(rawStart.month).getTime()) / (365.25 * 86400000), 0.01);
  const rawCagrPct = rawStart.revenue > 0 ? (Math.pow(rawEnd.revenue / rawStart.revenue, 1 / rawYears) - 1) * 100 : null;

  function doublingInfo(cagrPct: number | null) {
    if (cagrPct === null || cagrPct <= 0) return { ruleOf72Years: null, exactDoublingYears: null, requiredCagrToHalvePct: null };
    const ruleOf72Years = Math.round((72 / cagrPct) * 10) / 10;
    const exactDoublingYears = Math.round((Math.log(2) / Math.log(1 + cagrPct / 100)) * 10) / 10;
    const requiredCagrToHalvePct = exactDoublingYears > 0 ? Math.round((Math.pow(2, 2 / exactDoublingYears) - 1) * 1000) / 10 : null;
    return { ruleOf72Years, exactDoublingYears, requiredCagrToHalvePct };
  }

  return {
    monthsWithData: n,
    earlyWindowMonths: earlyWindow.map((w) => w.month),
    lateWindowMonths: lateWindow.map((w) => w.month),
    avgEarly: Math.round(avgEarly),
    avgLate: Math.round(avgLate),
    years: Math.round(years * 100) / 100,
    smoothedCagrPct: smoothedCagrPct !== null ? Math.round(smoothedCagrPct * 10) / 10 : null,
    ...doublingInfo(smoothedCagrPct),
    rawStart: { month: rawStart.month, revenue: rawStart.revenue },
    rawEnd: { month: rawEnd.month, revenue: rawEnd.revenue },
    rawYears: Math.round(rawYears * 100) / 100,
    rawCagrPct: rawCagrPct !== null ? Math.round(rawCagrPct * 10) / 10 : null,
  };
}

export async function GET() {
  try {
    const [rows] = await bigquery.query(
      `SELECT month, channel, revenue_actual FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY month, channel`
    );

    const channels = Array.from(new Set(rows.map((r: any) => r.channel))) as string[];
    const byChannel: Record<string, MonthRevenue[]> = {};
    channels.forEach((c) => {
      byChannel[c] = rows.filter((r: any) => r.channel === c).map((r: any) => ({ month: r.month, revenue: r.revenue_actual }));
    });

    const overallByMonth = new Map<string, number>();
    rows.forEach((r: any) => overallByMonth.set(r.month, (overallByMonth.get(r.month) ?? 0) + r.revenue_actual));
    const overall: MonthRevenue[] = Array.from(overallByMonth.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([month, revenue]) => ({ month, revenue }));

    const missingMonths: Record<string, string[]> = {};
    const allMonths = Array.from(new Set(rows.map((r: any) => r.month))).sort() as string[];
    channels.forEach((c) => {
      const present = new Set(byChannel[c].map((m) => m.month));
      missingMonths[c] = allMonths.filter((m) => !present.has(m));
    });

    const series: Record<string, ReturnType<typeof computeSeries>> = { overall: computeSeries(overall) };
    channels.forEach((c) => {
      series[c] = computeSeries(byChannel[c]);
    });

    const methodology = [
      `CAGR = (End Value ÷ Start Value)^(1 ÷ Years) − 1, applied to real monthly revenue from finance_channel_monthly (Feb–Nov 2026, ${allMonths.length} real months).`,
      `Headline "smoothed" figure averages the first and last (up to) 3 real months with data per channel, rather than a single start/end month — a single-month comparison on a business this seasonal (the real wholesale launch ramp in Sept–Nov, and a real ecommerce reporting gap in Jul–Sep) produces extreme, misleading annualized numbers. The literal single-endpoint version of the exact formula is also shown below each channel for full transparency.`,
      `Years is the real time distance between the midpoint of the early window and the midpoint of the late window (not a full calendar year — the real dataset only spans ~10 months, so this is an annualized rate, not a multi-year track record).`,
      `Rule of 72 doubling time = 72 ÷ CAGR%. Exact doubling time = ln(2) ÷ ln(1 + CAGR). Required growth rate to halve the doubling time solves the same formula for the rate that doubles revenue in half as many years.`,
      Object.entries(missingMonths).some(([, m]) => m.length > 0)
        ? `Real data gaps: ${Object.entries(missingMonths).filter(([, m]) => m.length > 0).map(([c, m]) => `${c} has no real revenue reported for ${m.join(", ")}`).join("; ")}.`
        : `No real data gaps across the 3 channels.`,
    ];

    return NextResponse.json({ series, methodology });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
