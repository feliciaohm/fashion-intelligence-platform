import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";
import { writeGa4Credentials, setIntegrationStatus } from "@/lib/integrations-server";
import { normalizeGa4PrivateKey } from "@/lib/ga4-key";

async function getAccessToken(serviceAccountEmail: string, serviceAccountPrivateKey: string): Promise<string> {
  // Service-account JWT auth -- no OAuth consent screen needed, the same
  // reason this route exists instead of a full OAuth flow.
  const key = normalizeGa4PrivateKey(serviceAccountPrivateKey);
  const client = new JWT({
    email: serviceAccountEmail,
    key,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const tokenResponse = await client.authorize();
  if (!tokenResponse.access_token) throw new Error("Google did not return an access token for this service account");
  return tokenResponse.access_token;
}

export async function POST(req: Request) {
  const { propertyId, serviceAccountEmail, serviceAccountPrivateKey } = await req.json();

  if (!propertyId || !serviceAccountEmail || !serviceAccountPrivateKey) {
    return NextResponse.json(
      { error: "Property ID, service account email, and private key are all required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey);

    // Real GA4 Data API call -- the actual connection test. A 1-day, 1-row
    // report is enough to confirm both that the service account can
    // authenticate AND that it's actually been granted Viewer access on
    // this specific property (a real, separate failure mode from just
    // having valid credentials -- GA4 requires the service account's email
    // to be added under Admin → Property Access Management first).
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "yesterday", endDate: "today" }],
        metrics: [{ name: "sessions" }],
        limit: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 returned ${res.status}: ${text.slice(0, 300)}`);
    }

    // Store the normalized key, not the raw pasted text -- so the sync
    // route reads back something already clean instead of needing to
    // re-normalize (and potentially drift from this route's logic) later.
    await writeGa4Credentials({
      propertyId,
      serviceAccountEmail,
      serviceAccountPrivateKey: normalizeGa4PrivateKey(serviceAccountPrivateKey),
    });
    await setIntegrationStatus({
      integrationId: "ga4",
      status: "connected",
      displayName: `GA4 property ${propertyId}`,
      connectedAt: new Date().toISOString(),
      lastError: null,
    });

    return NextResponse.json({ ok: true, propertyId });
  } catch (error) {
    await setIntegrationStatus({ integrationId: "ga4", status: "error", lastError: String(error) });
    return NextResponse.json({ error: "Could not connect to GA4", details: String(error) }, { status: 400 });
  }
}
