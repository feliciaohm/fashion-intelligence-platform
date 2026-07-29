import { NextResponse } from "next/server";
import { writeShopifyCredentials, setIntegrationStatus } from "@/lib/integrations-server";

export async function POST(req: Request) {
  const { shopDomain, accessToken } = await req.json();

  if (!shopDomain || !accessToken) {
    return NextResponse.json({ error: "Shop domain and access token are both required" }, { status: 400 });
  }

  const domain = String(shopDomain).trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain.endsWith(".myshopify.com")) {
    return NextResponse.json(
      { error: "Shop domain must be in the form your-store.myshopify.com" },
      { status: 400 }
    );
  }

  try {
    // Real Shopify Admin API call -- this is the actual connection test, not
    // a simulation. A live store + a real Admin API access token (from a
    // custom app in that store's admin) will succeed here; anything else
    // fails with the real error Shopify returns.
    const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify returned ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const shopName: string | undefined = data.shop?.name;

    writeShopifyCredentials({ shopDomain: domain, accessToken });
    await setIntegrationStatus({
      integrationId: "shopify",
      status: "connected",
      displayName: shopName ? `${shopName} (${domain})` : domain,
      connectedAt: new Date().toISOString(),
      lastError: null,
    });

    return NextResponse.json({ ok: true, shopName: shopName ?? domain });
  } catch (error) {
    await setIntegrationStatus({
      integrationId: "shopify",
      status: "error",
      lastError: String(error),
    });
    return NextResponse.json(
      { error: "Could not connect to Shopify", details: String(error) },
      { status: 400 }
    );
  }
}
