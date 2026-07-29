// Restored 2026-07-24: this file was deleted in Pass 16 as apparently-dead
// code (a grep of app/ and components/ found no importers), but lib/masterViews.ts
// -- used by the legacy /master demo page -- imports it too and that directory
// wasn't checked. Real bug: always grep the whole repo (including lib/), not
// just app/components, before deleting a file believed to be unused.
// Kept minimal/empty since /master is explicitly a mock-data-only demo page
// (see its own on-page caption) -- an empty journey list just means every
// campaign's attributed_revenue/avg_customer_ltv on that page reads 0,
// which is honest given no real mock journey data exists to restore.
export interface MockCustomerJourneyRow {
  customer_id: string;
  product_slug: string;
  touchpoint: string;
}

export const mockCustomerJourney: MockCustomerJourneyRow[] = [];
