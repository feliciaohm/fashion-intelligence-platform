import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Completes both OAuth (Google) and email-confirmation-link handshakes:
// Supabase redirects here with a `code` param, which is exchanged for a
// session cookie server-side, then the user is sent on to wherever they
// originally tried to go (?next=, defaulting to the role picker at "/").
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
