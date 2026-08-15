"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

// Small line icons for the capability cards -- hand-drawn to match the
// minimal, single-color icon-badge style from the design reference,
// consistent with the rest of the codebase's inline-SVG icons (no icon
// library dependency).
function IconSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function RouteIcon() {
  return (
    <IconSvg>
      <circle cx="4.5" cy="15.5" r="2" />
      <circle cx="15.5" cy="4.5" r="2" />
      <path d="M6.2 14.3C9.5 13 8.7 6.8 13.8 5.7" strokeDasharray="1.5 2.6" />
    </IconSvg>
  );
}

function GiftIcon() {
  return (
    <IconSvg>
      <rect x="3" y="8.5" width="14" height="8.5" rx="1.2" />
      <path d="M3 8.5h14M10 8.5v8.5" />
      <path d="M10 8.5c0-2.2-1.7-4-3.4-4C5.1 4.5 5.1 6.5 6.6 7.4c1 .6 2.2.9 3.4 1.1zM10 8.5c0-2.2 1.7-4 3.4-4 1.5 0 1.5 2-.1 2.9-1 .6-2.2.9-3.3 1.1z" />
    </IconSvg>
  );
}

function SparkleIcon() {
  return (
    <IconSvg>
      <path d="M10 3l1.3 4.4L16 8.7l-4.7 1.3L10 15l-1.3-4.7L4 8.7l4.7-1.3L10 3z" />
      <path d="M16 3v3M14.5 4.5h3" />
    </IconSvg>
  );
}

function LinkIcon() {
  return (
    <IconSvg>
      <path d="M7.3 12.7l5.4-5.4" />
      <path d="M6 13.9a3 3 0 010-4.2l1.7-1.7a3 3 0 014.2 0" />
      <path d="M14 6.1a3 3 0 010 4.2l-1.7 1.7a3 3 0 01-4.2 0" />
    </IconSvg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // This page is public (proxy.ts no longer redirects signed-in visitors
  // away from it -- it's the marketing/overview page now, not just a
  // sign-in form), so a signed-in visitor can land here too. Showing them
  // a Google/email sign-in form would be confusing; show who they're
  // signed in as instead, with a way back into the app.
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserEmail(data.user?.email ?? null));
  }, []);

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      setLoading(false);
    }
  }

  return (
    <div className="marketing-page">
      <nav className="marketing-nav">
        <div className="login-mark" style={{ marginBottom: 0 }}>
          <div className="login-mark-glyph" />
          <span className="login-mark-text">Fashion Intelligence Platform</span>
        </div>
        <div className="marketing-nav-links">
          <a href="#capabilities">Capabilities</a>
          <a href="#signin">Log in</a>
          <a
            className="marketing-cta"
            href="mailto:feliciaohm@gmail.com?subject=Fashion%20Intelligence%20Platform%20%E2%80%94%20Walkthrough%20request"
          >
            Request a walkthrough
          </a>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-hero-eyebrow">Fashion Intelligence Platform</div>
        <div className="marketing-hero-line">Brand intelligence</div>
        <div className="marketing-hero-line marketing-hero-line--strong">done with real data.</div>
        <p className="marketing-hero-sub">
          Finance, product, and influencer intelligence for luxury brands — gifting ROI,
          visitor attribution, and dashboards built in seconds, all from data you already have.
        </p>
        <a
          className="marketing-cta"
          href="mailto:feliciaohm@gmail.com?subject=Fashion%20Intelligence%20Platform%20%E2%80%94%20Walkthrough%20request"
        >
          Request a walkthrough
        </a>
      </section>

      <div className="marketing-preview-band">
        <div className="marketing-preview-window">
          <div className="marketing-preview-titlebar">
            <span className="marketing-preview-dot" />
            <span className="marketing-preview-dot" />
            <span className="marketing-preview-dot" />
            <span className="marketing-preview-label">Executive Summary — real BigQuery data</span>
          </div>
          <div className="marketing-preview-body">
            <div className="marketing-preview-card">
              <div className="marketing-preview-card-label">Revenue This Month</div>
              <div className="marketing-preview-card-value">€612,400</div>
            </div>
            <div className="marketing-preview-stack">
              <div className="marketing-preview-card">
                <div className="marketing-preview-card-label">Churn Rate</div>
                <div className="marketing-preview-card-value">24.6%</div>
              </div>
              <div className="marketing-preview-card">
                <div className="marketing-preview-card-label">Sell-Through Gap</div>
                <div className="marketing-preview-card-value">6.3%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="marketing-section-header">
        <span className="marketing-eyebrow-pill">Capabilities</span>
        <h2 className="marketing-section-title">Intelligence, not more dashboards to babysit</h2>
        <p className="marketing-section-sub">
          Four real capabilities, built from the data you already have — nothing here is a mockup.
        </p>
      </div>

      <section id="capabilities" className="marketing-capabilities">
        <div className="marketing-capability-card">
          <div className="marketing-capability-icon">
            <RouteIcon />
          </div>
          <div className="marketing-capability-title">Visitor Journey</div>
          <div className="marketing-capability-desc">
            See exactly which influencer post, gift, or campaign drove a real site visit —
            timing-based attribution, not guesswork.
          </div>
        </div>
        <div className="marketing-capability-card">
          <div className="marketing-capability-icon">
            <GiftIcon />
          </div>
          <div className="marketing-capability-title">Gifting ROI</div>
          <div className="marketing-capability-desc">
            Cross-match your gifting log against posting activity and see real revenue and
            ROI per influencer, updated live from Google Sheets.
          </div>
        </div>
        <div className="marketing-capability-card marketing-capability-card--highlight">
          <div className="marketing-capability-icon">
            <SparkleIcon />
          </div>
          <div className="marketing-capability-title">AI-Generated Dashboards</div>
          <div className="marketing-capability-desc">
            Describe the dashboard you want in plain language and get one built in seconds —
            every number still real, never fabricated.
          </div>
        </div>
        <div className="marketing-capability-card">
          <div className="marketing-capability-icon">
            <LinkIcon />
          </div>
          <div className="marketing-capability-title">Real Integrations</div>
          <div className="marketing-capability-desc">
            Connects to Shopify, Klaviyo, GA4, and Google Sheets — one platform instead of
            five disconnected tools.
          </div>
        </div>
      </section>

      <div className="marketing-narrative-band">
        <p className="marketing-narrative">
          Most brand analytics tools are built for paid-media budgets and ad platforms. Brands that grow through{" "}
          <strong>gifting, influencer relationships, and word of mouth</strong>{" "}
          don&apos;t get the same visibility — there&apos;s no dashboard that connects a gifted product to the
          visitor it actually brought in. This platform was built to close that specific gap.
        </p>
      </div>

      <div className="marketing-section-header">
        <span className="marketing-eyebrow-pill">How it works</span>
        <h2 className="marketing-section-title">From raw data to a real answer, in three steps</h2>
      </div>

      <section className="marketing-steps">
        <div className="marketing-step">
          <div className="marketing-step-number">1</div>
          <div className="marketing-capability-title">Connect your real data</div>
          <div className="marketing-capability-desc">
            Shopify, Klaviyo, GA4, and your gifting/posting logs in Google Sheets — no manual spreadsheet work,
            no re-entering numbers by hand.
          </div>
        </div>
        <div className="marketing-step">
          <div className="marketing-step-number">2</div>
          <div className="marketing-capability-title">Ask, in plain language</div>
          <div className="marketing-capability-desc">
            &quot;Which influencer gave the highest ROI?&quot; The Command Center answers from your real BigQuery
            data — if it can&apos;t answer honestly, it says so instead of guessing.
          </div>
        </div>
        <div className="marketing-step">
          <div className="marketing-step-number">3</div>
          <div className="marketing-capability-title">Save it, share it, act on it</div>
          <div className="marketing-capability-desc">
            Turn any real answer into a saved, named dashboard in one click — ready to open in a meeting or drop
            straight into a deck.
          </div>
        </div>
      </section>

      <p className="marketing-trust">Real BigQuery data. No fabricated numbers, ever.</p>

      <section id="signin" className="marketing-signin">
        <div className="marketing-signin-eyebrow">Already have access?</div>

      {currentUserEmail ? (
        <div className="login-card">
          <h1 className="login-title">You&apos;re signed in</h1>
          <p className="login-subtitle">Signed in as {currentUserEmail}.</p>
          <Link href="/" className="btn" style={{ width: "100%", textAlign: "center", display: "block" }}>
            Go to Dashboard →
          </Link>
        </div>
      ) : (
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">
          Finance, product, and influencer intelligence for a luxury fashion brand.
        </p>

        <button type="button" className="login-google-btn" onClick={signInWithGoogle}>
          <span className="login-google-icon">
            <GoogleIcon />
          </span>
          Continue with Google
        </button>

        {error && !showEmailForm && <p className="login-error" style={{ marginTop: 14, textAlign: "center" }}>{error}</p>}

        {!showEmailForm ? (
          <button
            type="button"
            className="login-email-toggle"
            onClick={() => setShowEmailForm(true)}
          >
            Continue with email
          </button>
        ) : (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>

            <form onSubmit={handleEmailSubmit} className="login-form">
              <div>
                <label className="login-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="login-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="login-error">{error}</p>}
              {message && <p className="login-message">{message}</p>}

              <button type="submit" className="btn" disabled={loading} style={{ width: "100%" }}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              type="button"
              className="login-mode-toggle"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>

            <button
              type="button"
              className="login-back-toggle"
              onClick={() => {
                setShowEmailForm(false);
                setError(null);
                setMessage(null);
              }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
      )}
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
