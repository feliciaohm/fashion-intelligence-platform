import { NextResponse } from "next/server";
import { deleteGa4Credentials, setIntegrationStatus } from "@/lib/integrations-server";

export async function POST() {
  deleteGa4Credentials();
  await setIntegrationStatus({ integrationId: "ga4", status: "disconnected", lastError: null });
  return NextResponse.json({ ok: true });
}
