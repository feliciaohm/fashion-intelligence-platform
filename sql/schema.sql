-- Fashion Intelligence Platform — BigQuery schema
-- Dataset: project-cb954e13-3b16-432f-aa7.analytics_lab
--
-- This file has two parts:
--   1. EXISTING TABLES/VIEWS — already live in BigQuery, listed here for reference only.
--      Do not re-run these CREATE statements; they document current production schema.
--   2. NEW TABLES — correspond 1:1 to the mock.ts files under app/api/*/mock.ts
--      (Steps 3-4 of the roadmap). Not yet deployed to BigQuery — these tables only
--      exist as mock data in the Next.js app today. Run this section when you're
--      ready to load real data behind them.
--
-- The 4 master views at the bottom (Step 6) depend on the NEW TABLES existing with
-- real data — they will fail if run against an empty/mock-only dataset. They're
-- included here as the target design; the app currently serves the same shape of
-- data via a mock-data aggregation layer (see lib/masterViews.ts) so the platform
-- is demoable today without live BigQuery data behind every table.

-- =========================================================================
-- 1. EXISTING TABLES / VIEWS (reference only — already in BigQuery)
-- =========================================================================

-- TABLE events (user_pseudo_id STRING, event_timestamp TIMESTAMP, event_name STRING,
--   page STRING, revenue FLOAT64, product_slug STRING, country STRING)
-- TABLE finance_pnl (product_id STRING, period STRING, revenue FLOAT64, cogs FLOAT64,
--   gross_margin FLOAT64, opex FLOAT64, staff_cost FLOAT64, marketing_spend FLOAT64,
--   net_margin FLOAT64, budget_revenue FLOAT64, budget_margin FLOAT64, variance FLOAT64)
-- TABLE influencer_costs (influencer_name STRING, product_slug STRING, post_date DATE,
--   gifted_cost INT64, shipping_cost INT64)
-- TABLE influencer_posts (raw, unheaded columns — string_field_0 etc. Avoid querying directly.)
-- TABLE influencer_product_performance (influencer STRING, product_slug STRING,
--   gifted_cost INT64, platform STRING, content_type STRING, country STRING,
--   post_date DATE, purchases INT64, total_revenue INT64, roi_pct FLOAT64, product_id STRING)
-- TABLE inventory
-- TABLE product_data
-- TABLE retail_sales (product_id STRING, store_id STRING, date DATE, units_sold INT64,
--   revenue FLOAT64, discount FLOAT64, country STRING, market_region STRING, currency STRING)
--   -- country/market_region/currency added 2026-07-19 (Step 3)
-- TABLE sales_events (user_pseudo_id STRING, session_id STRING, session_number INT64,
--   event_name STRING, event_timestamp TIMESTAMP, product_slug STRING, revenue INT64,
--   value_per_event INT64, traffic_source STRING, country STRING, geo_city STRING,
--   event_params STRING)
-- VIEW country_performance_model (country STRING, events INT64, total_revenue FLOAT64)
-- VIEW influencer_product_date_master
-- VIEW product_full_stack (product_id, product_slug, product_name, category, color,
--   material, collection, price, cost_of_goods, launch_date, stock_level, safety_stock,
--   restock_date, retail_revenue, retail_units, ecommerce_revenue, ecommerce_units,
--   period, finance_revenue, cogs, gross_margin, opex, staff_cost, marketing_spend,
--   net_margin, budget_revenue, budget_margin, finance_variance, influencer_revenue,
--   influencer_purchases, influencer_roi, influencer_country, influencer_platform,
--   influencer_content_type, influencer_name)
-- VIEW product_performance_master (product_slug, product_name, category, color, material,
--   collection, price, cost_of_goods, launch_date, unique_users, total_revenue_model,
--   event_count, total_revenue_events, total_value_events, influencer_posts,
--   total_engagement, influencer_uplift_revenue, influencer_roi)
-- VIEW product_performance_model
-- VIEW session_level_model (user_pseudo_id, session_start, session_end,
--   events_in_session, session_revenue)
--
-- FIXED 2026-07-19: product_full_stack previously joined product_data.product_id
-- (slug-based, e.g. "curve-bag-ivory") directly against retail_sales/shopify_orders/
-- finance_pnl/influencer_product_performance.product_id, which use a DIFFERENT legacy
-- ID scheme ("P001", "P002", ...). Every LEFT JOIN silently matched zero rows, so
-- retail_revenue/ecommerce_revenue/finance_revenue/influencer_roi were NULL for every
-- product. Root cause: no crosswalk table between the two ID schemes exists anywhere
-- in the dataset EXCEPT inside influencer_product_performance, which happens to carry
-- both product_id (P00x) and product_slug on the same rows. The fix (deployed live via
-- CREATE OR REPLACE VIEW, current definition below) builds that crosswalk from
-- influencer_product_performance and joins through it. influencer_product_performance
-- also has ~2 rows/product (one per campaign post), so it's pre-aggregated (SUM revenue/
-- purchases, AVG roi_pct, STRING_AGG names) before joining, to keep product_full_stack
-- at one row per product_slug (no fan-out).
--
-- CREATE OR REPLACE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.product_full_stack` AS
-- WITH product_id_crosswalk AS (
--   SELECT DISTINCT product_id AS legacy_product_id, product_slug
--   FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance`
-- ),
-- influencer_agg AS (
--   SELECT product_id, SUM(total_revenue) AS influencer_revenue,
--     SUM(purchases) AS influencer_purchases, ROUND(AVG(roi_pct), 1) AS influencer_roi,
--     STRING_AGG(DISTINCT country, ', ') AS influencer_country,
--     STRING_AGG(DISTINCT platform, ', ') AS influencer_platform,
--     STRING_AGG(DISTINCT content_type, ', ') AS influencer_content_type,
--     STRING_AGG(DISTINCT influencer, ', ') AS influencer_name
--   FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance`
--   GROUP BY product_id
-- )
-- SELECT p.*, inv.stock_level, inv.safety_stock, inv.restock_date,
--   rs.revenue AS retail_revenue, rs.units_sold AS retail_units,
--   so.revenue AS ecommerce_revenue, so.quantity AS ecommerce_units,
--   fp.period, fp.revenue AS finance_revenue, fp.cogs, fp.gross_margin, fp.opex,
--   fp.staff_cost, fp.marketing_spend, fp.net_margin, fp.budget_revenue,
--   fp.budget_margin, fp.variance AS finance_variance,
--   ia.influencer_revenue, ia.influencer_purchases, ia.influencer_roi,
--   ia.influencer_country, ia.influencer_platform, ia.influencer_content_type, ia.influencer_name
-- FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_data` p
-- LEFT JOIN product_id_crosswalk x ON p.product_slug = x.product_slug
-- LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.inventory` inv USING (product_id)
-- LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.retail_sales` rs ON x.legacy_product_id = rs.product_id
-- LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_orders` so ON x.legacy_product_id = so.product_id
-- LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.finance_pnl` fp ON x.legacy_product_id = fp.product_id
-- LEFT JOIN influencer_agg ia ON x.legacy_product_id = ia.product_id
--
-- After the fix, retail_revenue/ecommerce_revenue/finance_revenue/stock_level are STILL
-- NULL for most products — but that's now honestly explained by sparse source tables
-- (retail_sales has 3 rows total, finance_pnl has 2, inventory has 3), not a join bug.
--
-- CONFIRMED UNRECOVERABLE (investigated 2026-07-19, do not re-attempt without new source data):
-- 1. events.product_slug is NULL for all 48,793 rows, and `page` only encodes
--    ?influencer=<name>, not product. Checked every other data source in the repo for a
--    recoverable link: influencer_data.csv (48,793 rows — same count as `events`, almost
--    certainly its source) has a `product_slug` column that IS populated (7,373/48,793
--    rows) but it's actually mis-populated with INFLUENCER names ("lucy-williams",
--    "hillary-kerr", pulled from the ?influencer= page param) — a bug in the original CSV
--    generation, not something lost on the way into BigQuery. The CSV's separate
--    `gifted_product_slug` column is 0/48,793 populated. R/influencer_econometrics.R and
--    the notebook were also checked — neither has per-event product association. There is
--    no recoverable product_slug for `events` anywhere in this repo; it would require
--    regenerating the underlying tracking data with real product IDs captured per event.
--    Downstream impact: product_performance_master.total_revenue_model / unique_users stay
--    NULL — use total_revenue_events instead (from the separately-populated sales_events
--    table), which the app already does.
--
-- FIXED 2026-07-19: influencer_product_date_master (the influencer "hype window" uplift
-- model, comparing sales ±7 days around each post vs. a ±14-to-7-day baseline). Two bugs:
-- (a) its `engagement` column (aliased from influencer_posts' headerless int64_field_3)
-- actually held gifted_cost values — confirmed by cross-referencing against
-- influencer_product_performance's real gifted_cost for the same influencer/product/date.
-- Renamed to gifted_cost, and exposed two more previously-dropped headerless columns:
-- string_field_5 = content_type, string_field_6 = country. (b) sessions_7d/purchases_7d/
-- revenue_7d/uplift_* were 0 for every single row — root cause is NOT the join, it's that
-- sales_events only covers 2026-01-03 to 2026-02-04, while influencer_posts spans
-- 2026-02-12 to 2026-11-06 — almost zero date-range overlap between the two source tables.
-- No SQL fix changes that; the view now reports NULL (not a false 0) for the 39/40 posts
-- with zero overlapping sales_events coverage, and a real computed value for the 1 post
-- that does overlap. This required rebuilding product_performance_master too, since its
-- `influencer` CTE referenced the old `engagement` name (now `total_gifted_cost` in its
-- output — confirmed unused anywhere in the Next.js app before renaming).

-- =========================================================================
-- 2. NEW TABLES (Steps 3-4 — mock-only today, matching app/api/*/mock.ts)
-- =========================================================================

-- --- Step 3: geography additions -----------------------------------------

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_orders` (
  order_id STRING,
  customer_id STRING,
  product_slug STRING,
  quantity INT64,
  unit_price FLOAT64,
  total_price FLOAT64,
  discount FLOAT64,
  order_date DATE,
  channel STRING,
  country STRING,
  market_region STRING,
  currency STRING
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.crm_customers` (
  customer_id STRING,
  first_purchase_date DATE,
  lifetime_value FLOAT64,
  segment STRING,
  country STRING,
  market_region STRING,
  currency STRING
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_campaigns` (
  campaign_id STRING,
  influencer_name STRING,
  product_slug STRING,
  platform STRING,
  content_type STRING,
  start_date DATE,
  end_date DATE,
  budget FLOAT64,
  country STRING,
  market_region STRING,
  currency STRING
);

-- retail_sales geography columns already applied via ALTER TABLE on 2026-07-19:
-- ALTER TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.retail_sales`
--   ADD COLUMN IF NOT EXISTS country STRING,
--   ADD COLUMN IF NOT EXISTS market_region STRING,
--   ADD COLUMN IF NOT EXISTS currency STRING;

-- --- Step 4: missing tables ------------------------------------------------

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.markdown_history` (
  product_id STRING,
  original_price FLOAT64,
  markdown_price FLOAT64,
  markdown_date DATE,
  channel STRING,
  reason STRING
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.wholesale_reorders` (
  reorder_id STRING,
  wholesale_partner STRING,
  product_slug STRING,
  quantity INT64,
  unit_cost FLOAT64,
  total_cost FLOAT64,
  requested_date DATE,
  expected_delivery_date DATE,
  status STRING
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.customer_journey` (
  customer_id STRING,
  touchpoint STRING,
  channel STRING,
  product_slug STRING,
  timestamp TIMESTAMP,
  session_id STRING
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.brand_collaborations` (
  collaboration_id STRING,
  partner_brand STRING,
  collection STRING,
  launch_date DATE,
  end_date DATE,
  budget FLOAT64,
  total_revenue FLOAT64
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.trend_signals` (
  signal_id STRING,
  keyword STRING,
  category STRING,
  source STRING,
  momentum_score FLOAT64,
  detected_date DATE
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.store_costs` (
  store_id STRING,
  period STRING,
  rent FLOAT64,
  staff_cost FLOAT64,
  utilities FLOAT64,
  other_opex FLOAT64
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.forecast_budget` (
  period STRING,
  product_category STRING,
  forecast_revenue FLOAT64,
  forecast_units INT64,
  budget_revenue FLOAT64
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.product_costs` (
  product_slug STRING,
  material_cost FLOAT64,
  labor_cost FLOAT64,
  shipping_cost FLOAT64,
  duty_cost FLOAT64,
  total_cost FLOAT64
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle` (
  product_slug STRING,
  stage STRING,
  launch_date DATE,
  peak_date DATE,
  markdown_date DATE,
  discontinued_date DATE
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.store_inventory` (
  store_id STRING,
  product_slug STRING,
  stock_level INT64,
  safety_stock INT64,
  last_restock_date DATE
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.website_product_views` (
  product_slug STRING,
  date DATE,
  views INT64,
  unique_visitors INT64,
  add_to_cart_count INT64
);

CREATE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.marketing_spend` (
  period STRING,
  channel STRING,
  spend FLOAT64,
  attributed_revenue FLOAT64
);

-- =========================================================================
-- 3. MASTER VIEWS (Step 6 — target design, requires tables above to be
--    populated with real data before these will run without errors)
-- =========================================================================

-- product_performance_master: true margin per product after all costs.
CREATE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.product_performance_master_v2` AS
SELECT
  p.product_slug,
  p.product_name,
  p.category,
  p.price,
  SUM(so.total_price) AS shopify_revenue,
  SUM(rs.revenue) AS retail_revenue,
  SUM(inv.stock_level) AS total_inventory,
  SUM(ic.budget) AS influencer_spend,
  fp.net_margin
FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_data` p
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_orders` so
  ON p.product_slug = so.product_slug
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.retail_sales` rs
  ON p.product_id = rs.product_id
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.store_inventory` inv
  ON p.product_slug = inv.product_slug
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_campaigns` ic
  ON p.product_slug = ic.product_slug
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.finance_pnl` fp
  ON p.product_id = fp.product_id
GROUP BY p.product_slug, p.product_name, p.category, p.price, fp.net_margin;

-- influencer_roi_master: full attribution from post to purchase to LTV.
CREATE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_roi_master` AS
SELECT
  ic.campaign_id,
  ic.influencer_name,
  ic.product_slug,
  ic.budget AS gifted_cost,
  COUNT(DISTINCT so.order_id) AS purchases,
  SUM(so.total_price) AS attributed_revenue,
  AVG(crm.lifetime_value) AS avg_customer_ltv,
  ROUND(SAFE_DIVIDE(SUM(so.total_price) - ic.budget, ic.budget) * 100, 1) AS roi_pct
FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_campaigns` ic
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.customer_journey` cj
  ON ic.product_slug = cj.product_slug AND cj.touchpoint = 'influencer_post_view'
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_orders` so
  ON cj.customer_id = so.customer_id AND cj.product_slug = so.product_slug
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.crm_customers` crm
  ON so.customer_id = crm.customer_id
GROUP BY ic.campaign_id, ic.influencer_name, ic.product_slug, ic.budget;

-- market_performance_master: growth analysis by country / market_region.
CREATE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.market_performance_master` AS
SELECT
  country,
  market_region,
  SUM(revenue) AS retail_revenue,
  0 AS shopify_revenue,
  0 AS wholesale_revenue
FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.retail_sales`
GROUP BY country, market_region
UNION ALL
SELECT
  country,
  market_region,
  0 AS retail_revenue,
  SUM(total_price) AS shopify_revenue,
  0 AS wholesale_revenue
FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.shopify_orders`
GROUP BY country, market_region;

-- financial_health_master: margin creation/destruction.
CREATE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.financial_health_master` AS
SELECT
  fp.period,
  fp.revenue,
  fp.cogs,
  fp.gross_margin,
  fp.opex,
  SUM(sc.rent + sc.staff_cost + sc.utilities + sc.other_opex) AS store_costs,
  fp.net_margin,
  fp.budget_revenue,
  fp.budget_margin,
  fp.variance
FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.finance_pnl` fp
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.store_costs` sc
  ON fp.period = sc.period
GROUP BY fp.period, fp.revenue, fp.cogs, fp.gross_margin, fp.opex,
  fp.net_margin, fp.budget_revenue, fp.budget_margin, fp.variance;
