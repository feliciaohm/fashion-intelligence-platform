"use client";

import { useEffect, useState } from "react";
import ExcelUploadZone from "@/components/ExcelUploadZone";
import GoogleSheetsImportZone from "@/components/GoogleSheetsImportZone";
import RelatedPages from "@/components/RelatedPages";
import TotpSettings from "@/components/TotpSettings";
import RoleSettings from "@/components/RoleSettings";
import { INTEGRATION_META, INTEGRATION_ORDER, IntegrationStatus } from "@/lib/integrations";
import { KpiStrip, DocInsightBox, DocFooterNote, formatTimestamp, type KpiItem } from "@/components/DocLayout";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: IntegrationStatus["status"] }) {
  const color =
    status === "connected" ? "var(--status-good)" : status === "error" ? "var(--status-critical)" : "var(--color-ink-muted)";
  return (
    <span className="badge" style={{ borderColor: color, color }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ShopifyCard({ status, onChange }: { status: IntegrationStatus; onChange: () => void }) {
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/integrations/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain, accessToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setAccessToken("");
      onChange();
    } catch (err) {
      setFormError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/shopify/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      const parts = Object.entries(json.results as Record<string, number>).map(
        ([k, v]) => `${v} ${k}`
      );
      setSyncResult(`Synced: ${parts.join(", ")}${json.errors.length ? ` — ${json.errors.length} issue(s)` : ""}`);
      onChange();
    } catch (err) {
      setSyncResult(`Sync failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await fetch("/api/integrations/shopify/disconnect", { method: "POST" });
    setSyncResult(null);
    onChange();
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{INTEGRATION_META.shopify.name}</div>
          <p className="text-muted" style={{ marginTop: 4 }}>{INTEGRATION_META.shopify.description}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {status.status === "connected" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Store</span>
            <span>{status.displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Connected</span>
            <span>{formatDate(status.connectedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last synced</span>
            <span>{formatDate(status.lastSyncedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Rows on last sync</span>
            <span>{status.lastSyncRows ?? "—"}</span>
          </div>
          {status.lastError && (
            <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{status.lastError}</p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <button type="button" className="btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {syncResult && <p className="text-muted" style={{ marginTop: 6 }}>{syncResult}</p>}
        </div>
      ) : (
        <form onSubmit={connect} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Shop domain
            </label>
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Admin API access token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="shpat_..."
              required
              style={{ width: "100%" }}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              From your store admin: Settings → Apps and sales channels → Develop apps → create a
              custom app → Admin API access token. Stored locally on the server only, never in BigQuery.
            </p>
          </div>
          {formError && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{formError}</p>}
          <button type="submit" className="btn" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Connecting…" : "Connect"}
          </button>
        </form>
      )}
    </div>
  );
}

function ExcelCard({ status, onChange }: { status: IntegrationStatus; onChange: () => void }) {
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{INTEGRATION_META.excel.name}</div>
          <p className="text-muted" style={{ marginTop: 4 }}>{INTEGRATION_META.excel.description}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {status.status === "connected" && (
        <div style={{ fontSize: 13, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last file</span>
            <span>{status.displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last imported</span>
            <span>{formatDate(status.lastSyncedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Rows</span>
            <span>{status.lastSyncRows ?? "—"}</span>
          </div>
        </div>
      )}

      <ExcelUploadZone onImported={onChange} />
    </div>
  );
}

function KlaviyoCard({ status, onChange }: { status: IntegrationStatus; onChange: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/integrations/klaviyo/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setApiKey("");
      onChange();
    } catch (err) {
      setFormError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/klaviyo/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setSyncResult(`Synced: ${json.results.campaigns} campaigns${json.errors?.length ? ` — ${json.errors.length} issue(s)` : ""}`);
      onChange();
    } catch (err) {
      setSyncResult(`Sync failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await fetch("/api/integrations/klaviyo/disconnect", { method: "POST" });
    setSyncResult(null);
    onChange();
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{INTEGRATION_META.klaviyo.name}</div>
          <p className="text-muted" style={{ marginTop: 4 }}>{INTEGRATION_META.klaviyo.description}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {status.status === "connected" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Account</span>
            <span>{status.displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last synced</span>
            <span>{formatDate(status.lastSyncedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Campaigns on last sync</span>
            <span>{status.lastSyncRows ?? "—"}</span>
          </div>
          {status.lastError && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{status.lastError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <button type="button" className="btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {syncResult && <p className="text-muted" style={{ marginTop: 6 }}>{syncResult}</p>}
        </div>
      ) : (
        <form onSubmit={connect} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Private API key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pk_..."
              required
              style={{ width: "100%" }}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Klaviyo account → Settings → API Keys → Create Private API Key. Stored locally on the server only,
              never in BigQuery.
            </p>
          </div>
          {formError && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{formError}</p>}
          <button type="submit" className="btn" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Connecting…" : "Connect"}
          </button>
        </form>
      )}
    </div>
  );
}

function Ga4Card({ status, onChange }: { status: IntegrationStatus; onChange: () => void }) {
  const [propertyId, setPropertyId] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [serviceAccountPrivateKey, setServiceAccountPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/integrations/ga4/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, serviceAccountEmail, serviceAccountPrivateKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setServiceAccountPrivateKey("");
      onChange();
    } catch (err) {
      setFormError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/ga4/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error);
      setSyncResult(`Synced: ${json.results.sessions} session rows (90 days)`);
      onChange();
    } catch (err) {
      setSyncResult(`Sync failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await fetch("/api/integrations/ga4/disconnect", { method: "POST" });
    setSyncResult(null);
    onChange();
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{INTEGRATION_META.ga4.name}</div>
          <p className="text-muted" style={{ marginTop: 4 }}>{INTEGRATION_META.ga4.description}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {status.status === "connected" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Property</span>
            <span>{status.displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last synced</span>
            <span>{formatDate(status.lastSyncedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Rows on last sync</span>
            <span>{status.lastSyncRows ?? "—"}</span>
          </div>
          {status.lastError && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{status.lastError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <button type="button" className="btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {syncResult && <p className="text-muted" style={{ marginTop: 6 }}>{syncResult}</p>}
        </div>
      ) : (
        <form onSubmit={connect} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              GA4 Property ID
            </label>
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="123456789"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Service account email
            </label>
            <input
              type="text"
              value={serviceAccountEmail}
              onChange={(e) => setServiceAccountEmail(e.target.value)}
              placeholder="name@project.iam.gserviceaccount.com"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Service account private key
            </label>
            <textarea
              value={serviceAccountPrivateKey}
              onChange={(e) => setServiceAccountPrivateKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              required
              rows={4}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }}
            />
            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Google Cloud Console → IAM & Admin → Service Accounts → create one, enable the Google Analytics
              Data API, then add that service account&apos;s email as a Viewer under this GA4 property&apos;s
              Admin → Property Access Management. No OAuth consent screen needed. Stored locally on the server
              only, never in BigQuery.
            </p>
          </div>
          {formError && <p style={{ color: "var(--status-critical)", fontSize: 12 }}>{formError}</p>}
          <button type="submit" className="btn" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Connecting…" : "Connect"}
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleSheetsCard({ status, onChange }: { status: IntegrationStatus; onChange: () => void }) {
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{INTEGRATION_META.google_sheets.name}</div>
          <p className="text-muted" style={{ marginTop: 4 }}>{INTEGRATION_META.google_sheets.description}</p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {status.status === "connected" && (
        <div style={{ fontSize: 13, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last sheet</span>
            <span>{status.displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Last imported</span>
            <span>{formatDate(status.lastSyncedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted">Rows</span>
            <span>{status.lastSyncRows ?? "—"}</span>
          </div>
        </div>
      )}

      <GoogleSheetsImportZone onImported={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[] | null>(null);

  function refresh() {
    fetch("/api/integrations/status")
      .then((res) => res.json())
      .then(setStatuses);
  }

  useEffect(refresh, []);

  const byId = Object.fromEntries((statuses ?? []).map((s) => [s.integrationId, s]));

  const connected = (statuses ?? []).filter((s) => s.status === "connected");
  const totalRowsSynced = connected.reduce((sum, s) => sum + (s.lastSyncRows || 0), 0);
  const lastSync = connected
    .map((s) => s.lastSyncedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()[0];

  const kpis: KpiItem[] = statuses
    ? [
        {
          label: "Integrations Connected",
          value: `${connected.length} / ${INTEGRATION_ORDER.length}`,
          delta: connected.length > 0 ? connected.map((s) => INTEGRATION_META[s.integrationId as keyof typeof INTEGRATION_META]?.name ?? s.integrationId).join(", ") : "none yet",
          direction: connected.length > 0 ? "good" : "neutral",
        },
        {
          label: "Rows Synced",
          value: totalRowsSynced.toLocaleString(),
          delta: "across all connected sources",
          direction: "neutral",
        },
        {
          label: "Last Sync",
          value: lastSync ? formatTimestamp(new Date(lastSync)) : "n/a",
          delta: lastSync ? "most recent connected source" : "no sync yet",
          direction: "neutral",
        },
      ]
    : [];

  const headline = connected.length > 0
    ? `${connected.length} of ${INTEGRATION_ORDER.length} integrations connected — ${totalRowsSynced.toLocaleString()} rows synced from real sources.`
    : "No integrations connected yet — connect Shopify or upload an Excel file below to pull in real data.";
  const insightBoxText = connected.length > 0
    ? `${INTEGRATION_META[connected[0].integrationId as keyof typeof INTEGRATION_META]?.name ?? connected[0].integrationId} last synced ${connected[0].lastSyncedAt ? formatTimestamp(new Date(connected[0].lastSyncedAt)) : "recently"} — ${connected[0].lastSyncRows ?? 0} rows.`
    : headline;

  return (
    <div>
      <div className="page-eyebrow">Platform · Settings</div>
      <h1 className="page-title">Settings</h1>
      <p className="doc-insight-line">{headline}</p>
      <hr className="doc-header-rule" />

      {kpis.length === 3 && <KpiStrip items={kpis} />}

      <div className="section">
        <h2 className="section-title">Role</h2>
        <p className="section-subtitle">Which modules open first on your home page.</p>
        <RoleSettings />
      </div>

      {!statuses ? (
        <p className="text-muted section">Loading integration status…</p>
      ) : (
        <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {INTEGRATION_ORDER.map((id) => {
            const status = byId[id] ?? {
              integrationId: id,
              status: "disconnected" as const,
              displayName: null,
              connectedAt: null,
              lastSyncedAt: null,
              lastSyncRows: null,
              lastError: null,
            };
            if (id === "shopify") return <ShopifyCard key={id} status={status} onChange={refresh} />;
            if (id === "excel") return <ExcelCard key={id} status={status} onChange={refresh} />;
            if (id === "klaviyo") return <KlaviyoCard key={id} status={status} onChange={refresh} />;
            if (id === "ga4") return <Ga4Card key={id} status={status} onChange={refresh} />;
            return <GoogleSheetsCard key={id} status={status} onChange={refresh} />;
          })}
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Security</h2>
        <p className="section-subtitle">Your account's sign-in security.</p>
        <TotpSettings />
      </div>

      {statuses && (
        <>
          <DocInsightBox>{insightBoxText}</DocInsightBox>
          <DocFooterNote timestamp={formatTimestamp(new Date())} />
        </>
      )}

      <RelatedPages hrefs={["/intelligence", "/executive", "/dashboard"]} />
    </div>
  );
}
