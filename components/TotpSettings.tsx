"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
} | null;

export default function TotpSettings() {
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshFactors() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const verified = data.totp.find((f) => f.status === "verified");
    setVerifiedFactorId(verified?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refreshFactors();
  }, []);

  async function startEnrollment() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (challengeError) {
      setBusy(false);
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setEnroll(null);
    setCode("");
    refreshFactors();
  }

  async function cancelEnrollment() {
    if (!enroll) return;
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode("");
    setError(null);
  }

  async function disable2fa() {
    if (!verifiedFactorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setVerifiedFactorId(null);
  }

  if (loading) {
    return <p className="text-muted">Loading security settings…</p>;
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Two-factor authentication (TOTP)</div>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Require a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.) at sign-in, in
            addition to your password.
          </p>
        </div>
        <span
          className="badge"
          style={{
            borderColor: verifiedFactorId ? "var(--status-good)" : undefined,
            color: verifiedFactorId ? "var(--status-good)" : undefined,
          }}
        >
          {verifiedFactorId ? "enabled" : "disabled"}
        </span>
      </div>

      {error && <p style={{ color: "var(--status-critical)", fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {verifiedFactorId && !enroll && (
        <button type="button" className="btn-ghost" onClick={disable2fa} disabled={busy}>
          {busy ? "Disabling…" : "Disable 2FA"}
        </button>
      )}

      {!verifiedFactorId && !enroll && (
        <button type="button" className="btn" onClick={startEnrollment} disabled={busy}>
          {busy ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {enroll && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
          <div>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns a data: URI SVG, not a static asset */}
            <img
              src={enroll.qrCode}
              alt="TOTP enrollment QR code"
              width={180}
              height={180}
              style={{ border: "1px solid var(--color-border)", padding: 12, background: "#fff" }}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
              Can't scan it? Enter this key manually:{" "}
              <span style={{ fontFamily: "var(--font-mono), monospace" }}>{enroll.secret}</span>
            </p>
          </div>

          <form onSubmit={verifyEnrollment} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                style={{ width: 140, letterSpacing: "0.1em" }}
              />
            </div>
            <button type="submit" className="btn" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & enable"}
            </button>
            <button type="button" className="btn-ghost" onClick={cancelEnrollment} disabled={busy}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
