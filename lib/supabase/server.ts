// Server-only Supabase client -- for Server Components, Server Actions, and
// Route Handlers. Reads/writes the session cookie via next/headers, per the
// @supabase/ssr Next.js App Router pattern. Still uses only the public
// URL/anon key: Row Level Security (not a service-role key) is what scopes
// each request to the signed-in user.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component render (no response to attach
          // Set-Cookie headers to) will throw -- safe to ignore there,
          // since proxy.ts refreshes the session on every request anyway.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // no-op: called from a Server Component, not a Server Action / Route Handler
          }
        },
      },
    }
  );
}
