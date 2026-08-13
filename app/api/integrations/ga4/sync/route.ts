import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";
import { bigquery } from "@/lib/bigquery";
import { readGa4Credentials, setIntegrationStatus } from "@/lib/integrations-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

async function refreshTable(table: string, rows: Record<string, unknown>[]) {
  await bigquery.query(`DELETE FROM \`${PROJECT}.${table}\` WHERE TRUE`);
  if (rows.length > 0) {
    await bigquery.dataset("analytics_lab").table(table).insert(rows);
  }
}

function ga4DateToIso(ga4Date: string): string {
  // GA4 returns dates as "YYYYMMDD" with no separators.
  return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
}

export async function POST() {
  const creds = readGa4Credentials();
  if (!creds) {
    return NextResponse.json({ error: "GA4 is not connected yet" }, { status: 400 });
  }

  try {
    const key = creds.serviceAccountPrivateKey.replace(/\\n/g, "\n");
    const client = new JWT({
      email: creds.serviceAccountEmail,
      key,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const tokenResponse = await client.authorize();
    const accessToken = tokenResponse.access_token;
    if (!accessToken) throw new Error("Google did not return an access token for this service account");

    // Real GA4 Data API runReport -- date + source/medium is the standard
    // "where sessions came from" breakdown, last 90 days.
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${creds.propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }, { name: "totalRevenue" }],
        limit: 10000,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 returned ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const now = new Date().toISOString();
    const rows = (data.rows ?? []).map((r: any) => ({
      session_date: ga4DateToIso(r.dimensionValues[0].value),
      session_source: r.dimensionValues[1].value,
      session_medium: r.dimensionValues[2].value,
      sessions: Number(r.metricValues[0].value ?? 0),
      active_users: Number(r.metricValues[1].value ?? 0),
      conversions: Number(r.metricValues[2].value ?? 0),
      total_revenue: Number(r.metricValues[3].value ?? 0),
      synced_at: now,
    }));

    await refreshTable("ga4_sessions", rows);
    await setIntegrationStatus({
      integrationId: "ga4",
      status: "connected",
      lastSyncedAt: now,
      lastSyncRows: rows.length,
      lastError: null,
    });

    return NextResponse.json({ results: { sessions: rows.length }, errors: [] });
  } catch (error) {
    await setIntegrationStatus({ integrationId: "ga4", status: "error", lastError: String(error) });
    return NextResponse.json({ error: "Failed to sync GA4 data", details: String(error) }, { status: 500 });
  }
}
