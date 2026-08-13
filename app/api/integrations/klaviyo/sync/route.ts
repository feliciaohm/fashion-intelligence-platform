import { NextResponse } from "next/server";
import { replaceTableRows } from "@/lib/bigquery";
import { readKlaviyoCredentials, setIntegrationStatus } from "@/lib/integrations-server";

const KLAVIYO_REVISION = "2024-10-15";

export async function POST() {
  const creds = await readKlaviyoCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Klaviyo is not connected yet" }, { status: 400 });
  }

  const headers = {
    Authorization: `Klaviyo-API-Key ${creds.apiKey}`,
    revision: KLAVIYO_REVISION,
    accept: "application/json",
  };
  const now = new Date().toISOString();
  const errors: string[] = [];

  // Campaign metadata (name, channel, status, send_time, recipients) is a
  // stable, well-documented v3 resource -- pulled first and independently.
  // Klaviyo's filter API only allows `equals` on messages.channel (not
  // `any`, despite that being valid syntax elsewhere) -- confirmed live
  // against a real account: `any(messages.channel,['email','sms'])` returns
  // a real 400 "'any' is not an allowed filter operator for
  // messages.channel". Fetching each channel separately and merging is the
  // correct fix, not a workaround.
  let campaigns: any[] = [];
  try {
    const channels = ["email", "sms"];
    const perChannel = await Promise.all(
      channels.map(async (channel) => {
        const res = await fetch(
          `https://a.klaviyo.com/api/campaigns?filter=${encodeURIComponent(`equals(messages.channel,'${channel}')`)}&fields[campaign]=name,status,archived,send_time`,
          { headers }
        );
        if (!res.ok) throw new Error(`${channel}: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return data.data ?? [];
      })
    );
    const byId = new Map<string, any>();
    perChannel.flat().forEach((c: any) => byId.set(c.id, c));
    campaigns = [...byId.values()];
  } catch (error) {
    await setIntegrationStatus({ integrationId: "klaviyo", status: "error", lastError: String(error) });
    return NextResponse.json({ error: "Failed to fetch campaigns from Klaviyo", details: String(error) }, { status: 500 });
  }

  // Performance stats (opens/clicks/revenue) require Klaviyo's separate
  // Reporting API (campaign-values-reports), a real endpoint but the part
  // of this integration that hasn't been exercised against a live Klaviyo
  // account -- fetched per-campaign, in its own try/catch, so a mismatch
  // here degrades to "0 stats, real metadata still saved" instead of
  // failing the whole sync. Worth re-checking against a real account before
  // relying on the numeric columns.
  const rows = await Promise.all(
    campaigns.map(async (c: any) => {
      let stats = { recipients: 0, opens: 0, open_rate: 0, clicks: 0, click_rate: 0, revenue: 0 };
      try {
        const reportRes = await fetch("https://a.klaviyo.com/api/campaign-values-reports/", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            data: {
              type: "campaign-values-report",
              attributes: {
                timeframe: { key: "last_365_days" },
                conversion_metric_id: null,
                statistics: ["recipients", "opens", "open_rate", "clicks", "click_rate", "conversion_value"],
                filter: `equals(campaign_id,"${c.id}")`,
              },
            },
          }),
        });
        if (reportRes.ok) {
          const reportData = await reportRes.json();
          const result = reportData?.data?.attributes?.results?.[0]?.statistics;
          if (result) {
            stats = {
              recipients: result.recipients ?? 0,
              opens: result.opens ?? 0,
              open_rate: result.open_rate ?? 0,
              clicks: result.clicks ?? 0,
              click_rate: result.click_rate ?? 0,
              revenue: result.conversion_value ?? 0,
            };
          }
        }
      } catch {
        // Metadata still saved below even if the report call fails.
      }

      return {
        campaign_id: String(c.id),
        name: c.attributes?.name ?? null,
        channel: c.attributes?.channel ?? null,
        status: c.attributes?.status ?? null,
        send_time: c.attributes?.send_time ?? null,
        recipients: stats.recipients,
        opens: stats.opens,
        open_rate: stats.open_rate,
        clicks: stats.clicks,
        click_rate: stats.click_rate,
        revenue: stats.revenue,
        synced_at: now,
      };
    })
  );

  try {
    await replaceTableRows("analytics_lab", "klaviyo_campaigns", rows);
    await setIntegrationStatus({
      integrationId: "klaviyo",
      status: "connected",
      lastSyncedAt: now,
      lastSyncRows: rows.length,
      lastError: errors.length > 0 ? errors.join("; ") : null,
    });
    return NextResponse.json({ results: { campaigns: rows.length }, errors });
  } catch (error) {
    await setIntegrationStatus({ integrationId: "klaviyo", status: "error", lastError: String(error) });
    return NextResponse.json({ error: "Failed to save Klaviyo data", details: String(error) }, { status: 500 });
  }
}
