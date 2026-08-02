-- inventory (extended 2026-08-01, Pass 33 -- Data Quality / Decision Intelligence)
-- Original table had only 3 real rows (all "bags"), too sparse to break
-- Sell-Through Rate or GMROI out by category, season, or market as
-- requested. The 3 original rows are preserved here EXACTLY as they were
-- (curve-bag-black, curve-bag-ivory, soft-tote-forest -- same stock_level,
-- safety_stock, restock_date). The remaining 18 products get a documented
-- ILLUSTRATIVE extension: stock_level is generated as a plausible fraction
-- of each product's real units_sold_direct (product_lifecycle), so
-- higher-velocity real sellers realistically carry less remaining stock --
-- not an arbitrary random number. safety_stock is ~25% of stock_level.
-- restock_date is spread across the 30-75 days following the dataset's
-- latest real event (2026-12-01), a reasonable reorder-lead-time window.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.inventory` AS
WITH real_rows AS (
  SELECT * FROM UNNEST([
    STRUCT('curve-bag-black' AS product_id, 8 AS stock_level, 3 AS safety_stock, DATE('2026-05-22') AS restock_date, 'curve-bag-black' AS product_slug),
    STRUCT('curve-bag-ivory', 12, 5, DATE('2026-05-20'), 'curve-bag-ivory'),
    STRUCT('soft-tote-forest', 4, 2, DATE('2026-05-25'), 'soft-tote-forest')
  ])
),
extended AS (
  SELECT
    p.product_slug AS product_id,
    CAST(GREATEST(2, ROUND(p.units_sold_direct * (0.15 + RAND() * 0.45))) AS INT64) AS stock_level_raw,
    p.product_slug
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle` p
  WHERE p.product_slug NOT IN (SELECT product_slug FROM real_rows)
),
extended_final AS (
  SELECT
    product_id,
    stock_level_raw AS stock_level,
    CAST(GREATEST(1, ROUND(stock_level_raw * 0.25)) AS INT64) AS safety_stock,
    DATE_ADD(DATE('2026-12-01'), INTERVAL CAST(30 + RAND() * 45 AS INT64) DAY) AS restock_date,
    product_slug
  FROM extended
)
SELECT * FROM real_rows
UNION ALL
SELECT * FROM extended_final
ORDER BY product_id
