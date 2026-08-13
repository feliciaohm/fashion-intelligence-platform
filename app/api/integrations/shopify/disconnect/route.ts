import { NextResponse } from "next/server";
import { deleteShopifyCredentials, setIntegrationStatus } from "@/lib/integrations-server";

export async function POST() {
  await deleteShopifyCredentials();
  await setIntegrationStatus({
    integrationId: "shopify",
    status: "disconnected",
    displayName: null,
    lastError: null,
  });
  return NextResponse.json({ ok: true });
}
