import { bigquery } from "@/lib/bigquery";
import { IntegrationId, IntegrationStatus } from "@/lib/integrations";
import { getConfig, setConfig, deleteConfig } from "@/lib/config-store";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Credentials never touch BigQuery (query results are visible to anyone who
// can run a query) and never touch the client bundle. They used to live in
// a local, gitignored file (same pattern as key.json), but that breaks on
// Vercel -- the deployed function's filesystem is read-only outside /tmp,
// confirmed directly by a real ENOENT trying to write there in production.
// Now backed by lib/config-store.ts (Supabase, service-role only).

interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
}

interface KlaviyoCredentials {
  apiKey: string;
}

// Real GA4 Data API access needs OAuth OR a service account granted Viewer
// on the specific GA4 property -- the service account route is what's built
// here, since it needs no OAuth consent screen (no Google app-verification
// process to go through) and mirrors the same "paste a credential" pattern
// as Shopify's Admin API token. The service account itself still has to be
// created in Google Cloud Console (same place the BigQuery service account
// already lives) and added as a Viewer on the real GA4 property being
// connected -- that step can't be done from here, same as Shopify's custom
// app has to be created in the store's own admin first.
interface Ga4Credentials {
  propertyId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

export async function readShopifyCredentials(): Promise<ShopifyCredentials | null> {
  return getConfig<ShopifyCredentials>("shopify_credentials");
}

export async function writeShopifyCredentials(creds: ShopifyCredentials) {
  await setConfig("shopify_credentials", creds);
}

export async function deleteShopifyCredentials() {
  await deleteConfig("shopify_credentials");
}

export async function readKlaviyoCredentials(): Promise<KlaviyoCredentials | null> {
  return getConfig<KlaviyoCredentials>("klaviyo_credentials");
}

export async function writeKlaviyoCredentials(creds: KlaviyoCredentials) {
  await setConfig("klaviyo_credentials", creds);
}

export async function deleteKlaviyoCredentials() {
  await deleteConfig("klaviyo_credentials");
}

export async function readGa4Credentials(): Promise<Ga4Credentials | null> {
  return getConfig<Ga4Credentials>("ga4_credentials");
}

export async function writeGa4Credentials(creds: Ga4Credentials) {
  await setConfig("ga4_credentials", creds);
}

export async function deleteGa4Credentials() {
  await deleteConfig("ga4_credentials");
}

// BigQuery has no simple single-row upsert -- delete-then-insert is fine here
// since this table is only ever one row per integration_id, written from a
// single server process (no concurrent-write race to worry about).
export async function setIntegrationStatus(row: {
  integrationId: IntegrationId;
  status: "connected" | "disconnected" | "error";
  displayName?: string | null;
  connectedAt?: string | null;
  lastSyncedAt?: string | null;
  lastSyncRows?: number | null;
  lastError?: string | null;
}) {
  const existing = await getIntegrationStatus(row.integrationId);
  const connectedAtIso = row.connectedAt ?? existing?.connectedAt ?? null;
  const lastSyncedAtIso = row.lastSyncedAt ?? existing?.lastSyncedAt ?? null;

  await bigquery.query({
    query: `DELETE FROM \`${PROJECT}.integrations\` WHERE integration_id = @id`,
    params: { id: row.integrationId },
    types: { id: "STRING" },
  });

  await bigquery.query({
    query: `
      INSERT INTO \`${PROJECT}.integrations\`
        (integration_id, status, display_name, connected_at, last_synced_at, last_sync_rows, last_error)
      VALUES (@id, @status, @displayName, @connectedAt, @lastSyncedAt, @lastSyncRows, @lastError)
    `,
    params: {
      id: row.integrationId,
      status: row.status,
      displayName: row.displayName ?? existing?.displayName ?? null,
      // BigQuery TIMESTAMP params must be wrapped with bigquery.timestamp() --
      // a raw ISO string with types:{p:"TIMESTAMP"} is accepted silently but
      // inserts NULL (confirmed live, same failure mode as the Pass 15 DATE
      // param bug). Don't regress this.
      connectedAt: connectedAtIso ? bigquery.timestamp(connectedAtIso) : null,
      lastSyncedAt: lastSyncedAtIso ? bigquery.timestamp(lastSyncedAtIso) : null,
      lastSyncRows: row.lastSyncRows ?? existing?.lastSyncRows ?? null,
      lastError: row.lastError !== undefined ? row.lastError : existing?.lastError ?? null,
    },
    types: {
      id: "STRING",
      status: "STRING",
      displayName: "STRING",
      connectedAt: "TIMESTAMP",
      lastSyncedAt: "TIMESTAMP",
      lastSyncRows: "INT64",
      lastError: "STRING",
    },
  });
}

export async function getIntegrationStatus(integrationId: IntegrationId): Promise<IntegrationStatus | null> {
  const [rows] = await bigquery.query({
    query: `SELECT * FROM \`${PROJECT}.integrations\` WHERE integration_id = @id LIMIT 1`,
    params: { id: integrationId },
    types: { id: "STRING" },
  });
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    integrationId: r.integration_id,
    status: r.status,
    displayName: r.display_name,
    connectedAt: r.connected_at?.value ?? null,
    lastSyncedAt: r.last_synced_at?.value ?? null,
    lastSyncRows: r.last_sync_rows,
    lastError: r.last_error,
  };
}

export async function getAllIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const [rows] = await bigquery.query(`SELECT * FROM \`${PROJECT}.integrations\``);
  return rows.map((r: any) => ({
    integrationId: r.integration_id,
    status: r.status,
    displayName: r.display_name,
    connectedAt: r.connected_at?.value ?? null,
    lastSyncedAt: r.last_synced_at?.value ?? null,
    lastSyncRows: r.last_sync_rows,
    lastError: r.last_error,
  }));
}
