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
