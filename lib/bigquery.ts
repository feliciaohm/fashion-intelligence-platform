import { BigQuery } from "@google-cloud/bigquery";

// Local dev reads the service-account key from a file on disk
// (GCP_KEYFILE_PATH). Vercel (and any other serverless host) has no
// persistent filesystem to point that path at, so in production the same
// key's JSON contents are supplied directly via GCP_SERVICE_ACCOUNT_KEY and
// parsed here instead -- same credentials, two delivery mechanisms.
const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
  : undefined;

export const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  ...(serviceAccountKey
    ? { credentials: serviceAccountKey }
    : { keyFilename: process.env.GCP_KEYFILE_PATH }),
});

export async function runQuery(query: string) {
  const [rows] = await bigquery.query(query);
  return rows;
}

// "Full replace" for a table (import routes that re-sync a whole Google
// Sheet each time) -- WRITE_TRUNCATE load job, not DELETE-then-.insert().
// Rows from a streaming .insert() sit in BigQuery's streaming buffer for up
// to ~90 minutes, during which ANY DML (including an unrelated DELETE) on
// that table is rejected outright -- confirmed live: a real
// "would affect rows in the streaming buffer" error re-importing a sheet
// that had been imported minutes earlier. A load job has no streaming
// buffer, so this sidesteps the problem instead of racing it.
export async function replaceTableRows(dataset: string, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");
  const { Readable } = await import("stream");

  await new Promise<void>((resolve, reject) => {
    const writeStream = bigquery
      .dataset(dataset)
      .table(table)
      .createWriteStream({
        sourceFormat: "NEWLINE_DELIMITED_JSON",
        writeDisposition: "WRITE_TRUNCATE",
      })
      .on("complete", () => resolve())
      .on("error", (err) => reject(err));
    Readable.from([ndjson]).pipe(writeStream);
  });
}
