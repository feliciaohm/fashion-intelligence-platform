// Client-safe: types and static metadata only. No fs/bigquery imports here --
// see Pass 15's lib/intelligence.ts split for why that matters (a shared lib
// imported by both a "use client" page and API routes must never pull in
// Node-only deps, or the client bundle breaks).

export type IntegrationId = "shopify" | "ga4" | "excel" | "google_sheets" | "klaviyo";

export interface IntegrationStatus {
  integrationId: IntegrationId;
  status: "connected" | "disconnected" | "error";
  displayName: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncRows: number | null;
  lastError: string | null;
}

export const INTEGRATION_META: Record<
  IntegrationId,
  { name: string; description: string; available: boolean }
> = {
  shopify: {
    name: "Shopify",
    description: "Pull real orders, products, customers, and inventory automatically — no manual entry.",
    available: true,
  },
  excel: {
    name: "Excel Import",
    description: "Drag and drop a P&L or any spreadsheet — read and displayed instantly.",
    available: true,
  },
  klaviyo: {
    name: "Klaviyo",
    description: "Pull real email/SMS campaign performance — opens, clicks, revenue — automatically.",
    available: true,
  },
  ga4: {
    name: "Google Analytics 4",
    description: "Pull real sessions, traffic sources, and conversions via a service account — no OAuth consent screen required.",
    available: true,
  },
  google_sheets: {
    name: "Google Sheets",
    description: "Paste a shared sheet's link and import it instantly — works exactly like Excel import, just from a URL instead of a file.",
    available: true,
  },
};

export const INTEGRATION_ORDER: IntegrationId[] = ["shopify", "excel", "klaviyo", "ga4", "google_sheets"];
