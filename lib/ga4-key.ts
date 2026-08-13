// Normalizes a pasted GA4 service-account private key. Real, distinct
// failure modes confirmed live from actual pasted keys, all from the same
// root cause -- copying the raw JSON text of the downloaded key file
// (e.g. the whole `"private_key": "...",` field) instead of just the
// value:
//   1. Literal two-character "\n" sequences instead of real newlines
//      (JSON encodes newlines this way inside a string).
//   2. A literal leading/trailing '"' character -- the JSON string's own
//      quote delimiters, copied along with the value.
//   3. A trailing ',' -- the comma separating this field from the next
//      one in the JSON object, copied along with it.
// (1)+(2) alone produced a real "error:1E08010C:DECODER routines::unsupported";
// (3) would silently leave a stray comma inside the PEM footer.
export function normalizeGa4PrivateKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/,\s*$/, ""); // trailing comma from a copied JSON field
  key = key.replace(/^"/, "").replace(/"$/, ""); // surrounding JSON string quotes
  key = key.replace(/\\n/g, "\n"); // literal "\n" -> real newline
  return key.trim();
}
