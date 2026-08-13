import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { readShopifyCredentials, setIntegrationStatus } from "@/lib/integrations-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

async function refreshTable(table: string, rows: Record<string, unknown>[]) {
  await bigquery.query(`DELETE FROM \`${PROJECT}.${table}\` WHERE TRUE`);
  if (rows.length > 0) {
    await bigquery.dataset("analytics_lab").table(table).insert(rows);
  }
}

export async function POST() {
  const creds = await readShopifyCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Shopify is not connected yet" }, { status: 400 });
  }

  const base = `https://${creds.shopDomain}/admin/api/2024-01`;
  const headers = { "X-Shopify-Access-Token": creds.accessToken };
  const now = new Date().toISOString();

  const results: Record<string, number> = {};
  const errors: string[] = [];

  // Each resource is pulled and written independently so a failure on one
  // (e.g. an app scope that wasn't granted) doesn't block the others --
  // real Shopify custom apps often have partial scopes.
  try {
    const res = await fetch(`${base}/orders.json?status=any&limit=250`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const data = await res.json();
    const rows = (data.orders ?? []).map((o: any) => ({
      order_id: String(o.id),
      order_number: String(o.order_number ?? o.name ?? ""),
      created_at: o.created_at,
      financial_status: o.financial_status ?? null,
      total_price: o.total_price ? Number(o.total_price) : null,
      currency: o.currency ?? null,
      customer_email: o.email ?? null,
      line_items_count: Array.isArray(o.line_items) ? o.line_items.length : 0,
      synced_at: now,
    }));
    await refreshTable("shopify_live_orders", rows);
    results.orders = rows.length;
  } catch (error) {
    errors.push(`orders: ${String(error)}`);
  }

  try {
    const res = await fetch(`${base}/products.json?limit=250`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const data = await res.json();
    const rows = (data.products ?? []).map((p: any) => ({
      product_id: String(p.id),
      title: p.title ?? null,
      product_type: p.product_type ?? null,
      vendor: p.vendor ?? null,
      created_at: p.created_at,
      variants_count: Array.isArray(p.variants) ? p.variants.length : 0,
      price: p.variants?.[0]?.price ? Number(p.variants[0].price) : null,
      synced_at: now,
    }));
    await refreshTable("shopify_live_products", rows);
    results.products = rows.length;
  } catch (error) {
    errors.push(`products: ${String(error)}`);
  }

  try {
    const res = await fetch(`${base}/customers.json?limit=250`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const data = await res.json();
    const rows = (data.customers ?? []).map((c: any) => ({
      customer_id: String(c.id),
      email: c.email ?? null,
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      orders_count: c.orders_count ?? 0,
      total_spent: c.total_spent ? Number(c.total_spent) : 0,
      created_at: c.created_at,
      synced_at: now,
    }));
    await refreshTable("shopify_live_customers", rows);
    results.customers = rows.length;
  } catch (error) {
    errors.push(`customers: ${String(error)}`);
  }

  try {
    // inventory_levels.json requires at least one location_id -- fetch
    // locations first, then inventory for all of them.
    const locRes = await fetch(`${base}/locations.json`, { headers });
    if (!locRes.ok) throw new Error(`${locRes.status} ${await locRes.text()}`);
    const locData = await locRes.json();
    const locationIds = (locData.locations ?? []).map((l: any) => l.id).join(",");

    if (locationIds) {
      const invRes = await fetch(`${base}/inventory_levels.json?location_ids=${locationIds}&limit=250`, {
        headers,
      });
      if (!invRes.ok) throw new Error(`${invRes.status} ${await invRes.text()}`);
      const invData = await invRes.json();
      const rows = (invData.inventory_levels ?? []).map((i: any) => ({
        inventory_item_id: String(i.inventory_item_id),
        sku: null,
        available: i.available ?? null,
        location_id: String(i.location_id),
        synced_at: now,
      }));
      await refreshTable("shopify_live_inventory", rows);
      results.inventory = rows.length;
    } else {
      results.inventory = 0;
    }
  } catch (error) {
    errors.push(`inventory: ${String(error)}`);
  }

  const totalRows = Object.values(results).reduce((a, b) => a + b, 0);
  const allFailed = errors.length > 0 && totalRows === 0;

  await setIntegrationStatus({
    integrationId: "shopify",
    status: allFailed ? "error" : "connected",
    lastSyncedAt: now,
    lastSyncRows: totalRows,
    lastError: errors.length > 0 ? errors.join("; ") : null,
  });

  return NextResponse.json({ results, errors, totalRows });
}
