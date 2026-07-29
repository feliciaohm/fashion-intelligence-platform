-- Integrations layer (2026-07-21, Pass 16 -- Phase 1 real connectors)
-- Unlike every other table in this dataset, these are NOT synthetic --
-- they're empty schemas populated by real application usage (a brand
-- connecting their real Shopify store, or uploading a real Excel file).
-- Kept entirely separate from the existing demo dataset (sales_events,
-- product_data, etc.) so connecting a real integration never overwrites or
-- collides with the portfolio demo data those pages already depend on.

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.integrations` (
  integration_id STRING,   -- 'shopify' | 'ga4' | 'excel' | 'google_sheets'
  status STRING,            -- 'connected' | 'disconnected' | 'error'
  display_name STRING,      -- e.g. shop domain, sheet name -- non-secret, safe to show in UI
  connected_at TIMESTAMP,
  last_synced_at TIMESTAMP,
  last_sync_rows INT64,
  last_error STRING
);

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_live_orders` (
  order_id STRING,
  order_number STRING,
  created_at TIMESTAMP,
  financial_status STRING,
  total_price FLOAT64,
  currency STRING,
  customer_email STRING,
  line_items_count INT64,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_live_products` (
  product_id STRING,
  title STRING,
  product_type STRING,
  vendor STRING,
  created_at TIMESTAMP,
  variants_count INT64,
  price FLOAT64,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_live_customers` (
  customer_id STRING,
  email STRING,
  first_name STRING,
  last_name STRING,
  orders_count INT64,
  total_spent FLOAT64,
  created_at TIMESTAMP,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_live_inventory` (
  inventory_item_id STRING,
  sku STRING,
  available INT64,
  location_id STRING,
  synced_at TIMESTAMP
);

-- Generic row storage for Excel uploads -- deliberately schema-less beyond
-- (sheet, row, json) since a finance team's P&L layout varies brand to
-- brand; forcing a fixed column schema here would break on the first real
-- file that doesn't match it.
CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.excel_pnl_imports` (
  import_id STRING,
  filename STRING,
  uploaded_at TIMESTAMP,
  sheet_name STRING,
  row_index INT64,
  row_json STRING
);
