-- cost_centers (2026-07-19, extended 2026-07-20 Pass 14)
-- Monthly budget vs actual by department, Feb-Nov 2026 -- extended from the
-- original Feb-Jul window so this table shares the same 10-month range as
-- store_performance/wholesale_orders/sales_events, since the Pass 14 Monthly
-- Variance Report and Forecast module both need a consistent monthly window
-- across cost centers AND channels. Synthetic (no source event data to derive
-- this from -- unlike crm_customers/returns, department-level cost accounting
-- isn't observable in web analytics), but realistic: rent has low variance
-- (fixed cost), marketing and logistics have wider swings (variable spend).

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.cost_centers` AS
WITH depts AS (
  SELECT * FROM UNNEST([
    STRUCT('marketing' AS name, 40000 AS base_budget, 0.18 AS variance_pct),
    STRUCT('retail_staff' AS name, 65000 AS base_budget, 0.08 AS variance_pct),
    STRUCT('logistics' AS name, 22000 AS base_budget, 0.14 AS variance_pct),
    STRUCT('rent' AS name, 30000 AS base_budget, 0.02 AS variance_pct)
  ])
),
periods AS (
  SELECT FORMAT_DATE('%Y-%m', period) AS period
  FROM UNNEST(GENERATE_DATE_ARRAY('2026-02-01', '2026-11-01', INTERVAL 1 MONTH)) AS period
),
base AS (
  SELECT
    d.name, p.period, d.base_budget,
    CAST(ROUND(d.base_budget * (1 + (RAND() * 2 - 1) * d.variance_pct)) AS INT64) AS actual
  FROM depts d, periods p
)
SELECT
  GENERATE_UUID() AS cost_center_id,
  name,
  period,
  base_budget AS budget,
  actual,
  actual - base_budget AS variance
FROM base
ORDER BY period, name
