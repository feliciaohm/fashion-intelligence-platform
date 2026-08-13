import { NextResponse } from "next/server";
import { deleteKlaviyoCredentials, setIntegrationStatus } from "@/lib/integrations-server";

export async function POST() {
  deleteKlaviyoCredentials();
  await setIntegrationStatus({ integrationId: "klaviyo", status: "disconnected", lastError: null });
  return NextResponse.json({ ok: true });
}
