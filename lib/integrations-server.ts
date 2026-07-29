import fs from "fs";
import path from "path";
import { bigquery } from "@/lib/bigquery";
import { IntegrationId, IntegrationStatus } from "@/lib/integrations";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Credentials never touch BigQuery (query results are visible to anyone who
// can run a query) and never touch the client bundle. They live in a local,
// gitignored file only the server process reads -- same pattern as key.json.
const CREDENTIALS_DIR = path.join(process.cwd(), ".credentials");

interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
}

function credentialsPath(name: string) {
  return path.join(CREDENTIALS_DIR, `${name}.json`);
}

export function readShopifyCredentials(): ShopifyCredentials | null {
  try {
    const raw = fs.readFileSync(credentialsPath("shopify"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeShopifyCredentials(creds: ShopifyCredentials) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  fs.writeFileSync(credentialsPath("shopify"), JSON.stringify(creds), { mode: 0o600 });
}

export function deleteShopifyCredentials() {
  try {
    fs.unlinkSync(credentialsPath("shopify"));
  } catch {
    // already gone
  }
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
