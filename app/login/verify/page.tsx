"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Reached from proxy.ts when a user has a verified TOTP factor but their
// current session is only aal1 (password/OAuth alone) -- this is the actual
// second-factor challenge that makes 2FA real rather than decorative. Only
// after this succeeds does proxy.ts let the session through to any page.
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      setFactorId(verified?.id ?? null);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setVerifying(false);
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-eyebrow">Fashion Intelligence Platform</div>
        <h1 className="login-title">Verify it's you</h1>
        <p className="login-subtitle">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>

        {loading && <p className="text-muted">Loading…</p>}

        {!loading && !factorId && (
          <p className="login-error">Couldn't find an active 2FA factor for this account. Try signing in again.</p>
        )}

        {!loading && factorId && (
          <form onSubmit={handleSubmit} className="login-form">
            <div>
              <label className="login-label" htmlFor="code">6-digit code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                style={{ letterSpacing: "0.2em", textAlign: "center", fontSize: 18 }}
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn" disabled={verifying || code.length !== 6} style={{ width: "100%" }}>
              {verifying ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function VerifyTwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
