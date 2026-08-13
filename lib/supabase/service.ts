// Service-role Supabase client -- server-only, bypasses Row Level Security
// entirely. Used ONLY for lib/config-store.ts's app_config table (API
// credentials, sheet URLs), never for anything a normal user request should
// touch -- regular reads/writes still go through lib/supabase/server.ts's
// session-scoped client so RLS keeps doing its job everywhere else.
//
// Deliberately not cookie-aware and not tied to a request's session: some
// callers (the gifting webhook route) have no logged-in user at all --
// they're authenticated by their own token instead, not a Supabase session
// -- so this client can't rely on RLS-via-session the way server.ts does.
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set -- get it from the Supabase dashboard: Settings -> API -> service_role key, and add it as an env var (never NEXT_PUBLIC_-prefixed)."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
