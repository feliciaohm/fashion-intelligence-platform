-- finance_channel (2026-07-20)
-- Quarterly revenue by channel, rolled up from each channel's real ledger:
-- retail <- store_performance, ecommerce <- sales_events purchases,
-- wholesale <- wholesale_orders. cogs applies product_lifecycle's real
-- blended cost/retail ratio to each channel's revenue (a reasonable proxy --
-- no channel-level cost ledger exists). revenue_forecast is synthetic
-- (budget-style variance around actual, same spirit as cost_centers) so
-- forecast-vs-actual is comparable, not circular.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.finance_channel` AS
WITH blended_cogs_ratio AS (
  SELECT SAFE_DIVIDE(SUM(cost_price), SUM(retail_price)) AS ratio
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle`
),
retail AS (
  SELECT
    'retail' AS channel,
    CONCAT('2026-Q', CAST(CEIL(CAST(SUBSTR(period, 6, 2) AS INT64) / 3.0) AS INT64)) AS quarter,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.store_performance`
  GROUP BY quarter
),
ecommerce AS (
  SELECT
    'ecommerce' AS channel,
    CONCAT('2026-Q', CAST(EXTRACT(QUARTER FROM event_timestamp) AS INT64)) AS quarter,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
  GROUP BY quarter
),
wholesale AS (
  SELECT
    'wholesale' AS channel,
    CONCAT('2026-Q', CAST(EXTRACT(QUARTER FROM order_date) AS INT64)) AS quarter,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.wholesale_orders`
  GROUP BY quarter
),
unioned AS (
  SELECT * FROM retail
  UNION ALL SELECT * FROM ecommerce
  UNION ALL SELECT * FROM wholesale
)
SELECT
  channel,
  quarter,
  CAST(ROUND(revenue_actual) AS INT64) AS revenue_actual,
  CAST(ROUND(revenue_actual * (0.88 + RAND() * 0.22)) AS INT64) AS revenue_forecast,
  CAST(ROUND(revenue_actual * (SELECT ratio FROM blended_cogs_ratio)) AS INT64) AS cogs
FROM unioned
ORDER BY quarter, channel
