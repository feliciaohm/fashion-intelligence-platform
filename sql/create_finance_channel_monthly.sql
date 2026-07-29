-- finance_channel_monthly (2026-07-20, Pass 14)
-- Same rollup logic as finance_channel (retail <- store_performance,
-- ecommerce <- sales_events purchases, wholesale <- wholesale_orders,
-- cogs <- product_lifecycle's blended cost/retail ratio) but grouped by
-- month instead of quarter -- the Monthly Variance Report, Executive
-- Summary, and Forecast module all need monthly granularity to compare
-- against cost_centers (which is monthly) and to compute a real trend.
-- revenue_forecast is synthetic budget-style variance around actual, same
-- spirit as cost_centers, so forecast-vs-actual is comparable, not circular.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.finance_channel_monthly` AS
WITH blended_cogs_ratio AS (
  SELECT SAFE_DIVIDE(SUM(cost_price), SUM(retail_price)) AS ratio
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_lifecycle`
),
retail AS (
  SELECT
    'retail' AS channel,
    period AS month,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.store_performance`
  GROUP BY month
),
ecommerce AS (
  SELECT
    'ecommerce' AS channel,
    FORMAT_TIMESTAMP('%Y-%m', event_timestamp) AS month,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
  GROUP BY month
),
wholesale AS (
  SELECT
    'wholesale' AS channel,
    FORMAT_DATE('%Y-%m', order_date) AS month,
    SUM(revenue) AS revenue_actual
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.wholesale_orders`
  GROUP BY month
),
unioned AS (
  SELECT * FROM retail
  UNION ALL SELECT * FROM ecommerce
  UNION ALL SELECT * FROM wholesale
)
SELECT
  channel,
  month,
  CAST(ROUND(revenue_actual) AS INT64) AS revenue_actual,
  CAST(ROUND(revenue_actual * (0.88 + RAND() * 0.22)) AS INT64) AS revenue_forecast,
  CAST(ROUND(revenue_actual * (SELECT ratio FROM blended_cogs_ratio)) AS INT64) AS cogs
FROM unioned
ORDER BY month, channel
