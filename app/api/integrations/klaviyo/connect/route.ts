import { NextResponse } from "next/server";
import { writeKlaviyoCredentials, setIntegrationStatus } from "@/lib/integrations-server";

const KLAVIYO_REVISION = "2024-10-15";

export async function POST(req: Request) {
  const { apiKey: rawApiKey } = await req.json();

  if (!rawApiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  // Trim -- confirmed a real pasted key can carry a trailing space (browser
  // paste behavior), which Klaviyo's API tolerates but is worth stripping
  // before storing rather than relying on that leniency.
  const apiKey = String(rawApiKey).trim();

  try {
    // Real Klaviyo API call -- the actual connection test, not a simulation.
    // /api/accounts is the standard "is this key valid" check Klaviyo's own
    // docs recommend, and it returns the real account name to display.
    const res = await fetch("https://a.klaviyo.com/api/accounts/", {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Klaviyo returned ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const accountName: string | undefined = data.data?.[0]?.attributes?.contact_information?.organization_name;

    await writeKlaviyoCredentials({ apiKey });
    await setIntegrationStatus({
      integrationId: "klaviyo",
      status: "connected",
      displayName: accountName ?? "Klaviyo account",
      connectedAt: new Date().toISOString(),
      lastError: null,
    });

    return NextResponse.json({ ok: true, accountName: accountName ?? null });
  } catch (error) {
    await setIntegrationStatus({
      integrationId: "klaviyo",
      status: "error",
      lastError: String(error),
    });
    return NextResponse.json({ error: "Could not connect to Klaviyo", details: String(error) }, { status: 400 });
  }
}
