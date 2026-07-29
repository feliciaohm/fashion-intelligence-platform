-- wholesale_orders (2026-07-20, date-wrap fix 2026-07-20 Pass 14)
-- Synthetic (no real wholesale order data exists) but anchored to real
-- products and their wholesale_price from product_lifecycle, so revenue
-- ties out consistently across modules. Three retailers, per Felicia's spec:
-- Net-a-Porter and Mytheresa buy deeper/more often (bigger accounts);
-- Browns orders smaller and less frequently. Reorder pattern: each
-- retailer x product pairing gets 1-4 orders across the season; order_number
-- 2+ is flagged is_reorder so "who reorders this product" is a real signal,
-- not just randomly scattered rows.
-- Real bug fixed here: the original generator used LEAST(date, '2026-11-30')
-- to keep dates in range, which instead piled every overflowing reorder onto
-- the single date 2026-11-30 (23 orders / $1.86M landed on one day -- badly
-- distorting the Pass 14 Forecast module's month-over-month trend calc).
-- Fixed by wrapping the offset with MOD() into the valid [launch_date,
-- 2026-11-30] window instead of clamping, so overflow orders land on a
-- plausible spread of earlier dates rather than piling onto one.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.wholesale_orders` AS
WITH retailers AS (
  SELECT retailer, tier_multiplier FROM UNNEST([
    STRUCT('Net-a-Porter' AS retailer, 1.4 AS tier_multiplier),
    STRUCT('Mytheresa' AS retailer, 1.25 AS tier_multiplier),
    STRUCT('Browns' AS retailer, 0.85 AS tier_multiplier)
  ])
),
pairs AS (
  SELECT
    r.retailer,
    r.tier_multiplier,
    p.product_slug,
    p.season,
    p.wholesale_price,
    p.launch_date,
    CAST(1 + FLOOR(RAND() * (r.tier_multiplier * 3)) AS INT64) AS order_count
  FROM retailers r
  CROSS JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle` p
  WHERE RAND() < 0.7
),
exploded AS (
  SELECT
    retailer,
    product_slug,
    season,
    wholesale_price,
    launch_date,
    order_number,
    tier_multiplier
  FROM pairs, UNNEST(GENERATE_ARRAY(1, order_count)) AS order_number
)
SELECT
  GENERATE_UUID() AS order_id,
  retailer,
  product_slug,
  season,
  DATE_ADD(launch_date, INTERVAL MOD(
    CAST(FLOOR((order_number - 1) * (40 + RAND() * 30) + RAND() * 14) AS INT64),
    GREATEST(DATE_DIFF(DATE '2026-11-30', launch_date, DAY), 1)
  ) DAY) AS order_date,
  CAST(ROUND((6 + RAND() * 18) * tier_multiplier) AS INT64) AS quantity,
  wholesale_price,
  CAST(ROUND((6 + RAND() * 18) * tier_multiplier) AS INT64) * wholesale_price AS revenue,
  order_number > 1 AS is_reorder
FROM exploded
ORDER BY order_date
