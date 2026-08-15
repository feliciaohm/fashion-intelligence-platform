import { headers } from "next/headers";

// Server Components across this app fetch their own /api/* routes to reuse
// the same BigQuery query logic the route already has -- but a hardcoded
// "http://localhost:3000" base URL only resolves in local dev; in any real
// deployment (Vercel preview or production) nothing listens there, so the
// fetch fails outright and the whole page throws. Every /api/* route also
// requires a logged-in session (see proxy.ts), and a server-to-server fetch
// does NOT automatically carry the browser's session cookie -- so even with
// a correct URL, the self-fetch would come back 401.
//
// This fixes both in one place: build the real request origin from the
// incoming request's own headers (works in dev, preview, and prod without
// any hardcoded URL or env var), and forward the session cookie along.
export async function selfFetch(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const cookie = h.get("cookie") ?? "";
  return fetch(`${proto}://${host}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), cookie },
  });
}
