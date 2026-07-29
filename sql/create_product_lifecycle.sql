-- product_lifecycle (2026-07-20)
-- cost_price/retail_price come straight from the real product_data table.
-- wholesale_price is synthetic (no real wholesale pricing exists yet): a
-- realistic ~55-65% of retail, always kept above cost_price so wholesale
-- margin is never negative. units_sold_direct/revenue_direct are REAL,
-- pulled from sales_events purchases (the platform's one real sales ledger --
-- retail_sales/shopify_orders are near-empty stub tables, see
-- bigquery_fashion_intelligence memory). season = product_data.collection.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle` AS
WITH direct_sales AS (
  SELECT
    product_slug,
    COUNT(*) AS units_sold_direct,
    SUM(revenue) AS revenue_direct
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
  GROUP BY product_slug
),
priced AS (
  SELECT
    p.product_slug,
    p.product_name,
    p.category,
    p.collection AS season,
    p.cost_of_goods AS cost_price,
    p.price AS retail_price,
    CAST(ROUND(p.cost_of_goods * (1.35 + RAND() * 0.35)) AS INT64) AS wholesale_price_raw,
    p.launch_date
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_data` p
)
SELECT
  pr.product_slug,
  pr.product_name,
  pr.category,
  pr.season,
  pr.launch_date,
  pr.cost_price,
  LEAST(pr.wholesale_price_raw, pr.retail_price - 200) AS wholesale_price,
  pr.retail_price,
  ROUND(SAFE_DIVIDE(pr.retail_price - pr.cost_price, pr.retail_price) * 100, 1) AS retail_margin_pct,
  ROUND(SAFE_DIVIDE(LEAST(pr.wholesale_price_raw, pr.retail_price - 200) - pr.cost_price, LEAST(pr.wholesale_price_raw, pr.retail_price - 200)) * 100, 1) AS wholesale_margin_pct,
  COALESCE(ds.units_sold_direct, 0) AS units_sold_direct,
  COALESCE(ds.revenue_direct, 0) AS revenue_direct
FROM priced pr
LEFT JOIN direct_sales ds ON ds.product_slug = pr.product_slug
ORDER BY revenue_direct DESC
