// Next.js 16 renamed Middleware to Proxy (same mechanism, new file name and
// export) -- see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
// This is the single gate every request passes through:
//   1. Refresh the Supabase session cookie.
//   2. Block anything but /login and /auth/callback until signed in --
//      "every user must log in before seeing any data."
//   3. If the account has a verified TOTP factor but the current session is
//      only aal1 (password/OAuth alone), force a stop at /login/verify
//      before letting the session through anywhere else. Without this step,
//      enrolling in 2FA would be purely decorative -- a stolen password
//      alone would still produce a fully valid session.
//   4. If the profile has no role set yet, force a stop at /onboarding --
//      first login only, once. Role is a personalization preference, not an
//      access boundary, so /api/* is exempt (data access never depends on
//      it); only page navigation is gated.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// Real webhook receivers can't carry a browser session cookie (Google Apps
// Script, Stripe, GitHub, etc. all call in "cold") -- exempted from the
// session gate here, but NOT from auth entirely: each one verifies its own
// shared-secret token itself (see app/api/gifting/webhook/route.ts), the
// same pattern real webhook providers use instead of a login session.
const WEBHOOK_PATHS = ["/api/gifting/webhook"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (WEBHOOK_PATHS.includes(path)) {
    return response;
  }

  if (!user) {
    if (isPublicPath) return response;
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in with at least a primary factor -- check if a second factor is
  // still required before this session counts as fully authenticated.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsSecondFactor = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  if (needsSecondFactor) {
    if (path.startsWith("/login/verify")) return response;
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Second factor required" }, { status: 401 });
    }
    const verifyUrl = new URL("/login/verify", request.url);
    verifyUrl.searchParams.set("next", path === "/login" ? "/" : path);
    return NextResponse.redirect(verifyUrl);
  }

  // Fully authenticated -- /login/verify (the 2FA step) has nothing left to
  // do, so redirect away from it. /login itself is deliberately NOT
  // redirected away anymore: it's the public marketing/overview page now,
  // not just a sign-in form, and a signed-in visitor (including Felicia
  // checking her own site) should still be able to see it instead of being
  // silently bounced back into the app.
  if (path.startsWith("/login/verify")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!path.startsWith("/api/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const hasRole = !!profile?.role;

    if (!hasRole && path !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    if (hasRole && path === "/onboarding") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
