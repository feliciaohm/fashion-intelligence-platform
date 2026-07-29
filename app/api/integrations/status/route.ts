import { NextResponse } from "next/server";
import { getAllIntegrationStatuses } from "@/lib/integrations-server";
import { INTEGRATION_ORDER } from "@/lib/integrations";

export async function GET() {
  try {
    const all = await getAllIntegrationStatuses();
    const byId = Object.fromEntries(all.map((s) => [s.integrationId, s]));
    const result = INTEGRATION_ORDER.map(
      (id) =>
        byId[id] ?? {
          integrationId: id,
          status: "disconnected",
          displayName: null,
          connectedAt: null,
          lastSyncedAt: null,
          lastSyncRows: null,
          lastError: null,
        }
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
