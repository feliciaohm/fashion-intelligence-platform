// Client-safe: types and static metadata only. No fs/bigquery imports here --
// see Pass 15's lib/intelligence.ts split for why that matters (a shared lib
// imported by both a "use client" page and API routes must never pull in
// Node-only deps, or the client bundle breaks).

export type IntegrationId = "shopify" | "ga4" | "excel" | "google_sheets";

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
  ga4: {
    name: "Google Analytics 4",
    description: "Pull real sessions, events, and conversions automatically.",
    available: false,
  },
  google_sheets: {
    name: "Google Sheets",
    description: "Connect a sheet and the platform reads it as a live data source.",
    available: false,
  },
};

export const INTEGRATION_ORDER: IntegrationId[] = ["shopify", "excel", "ga4", "google_sheets"];
