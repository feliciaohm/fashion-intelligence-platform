-- overhead_departments (2026-07-28, Pass 32 -- SAP CO/FI layer)
-- Two shared-services cost pools with no source table anywhere in this
-- dataset: IT (systems, hosting, POS/ecommerce platform licensing) and HR
-- (recruiting, payroll administration, benefits admin). Explicitly a
-- separate table rather than added rows in `cost_centers`, so the existing
-- Cost Centers / Monthly Variance Report / Executive Summary pages --
-- already reviewed and screenshotted -- keep computing from exactly the
-- same `cost_centers` rows they always have; nothing already built shifts.
-- The Cost Allocation Engine reads `marketing`/`logistics` overhead straight
-- from the real `cost_centers` table and only pulls IT/HR from here, so two
-- of its four allocated departments are REAL and two are ILLUSTRATIVE
-- (documented on the page itself), not four illustrative numbers dressed up
-- as one thing. Same monthly window and budget-vs-actual variance pattern
-- as cost_centers for a fair side-by-side.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.overhead_departments` AS
WITH depts AS (
  SELECT * FROM UNNEST([
    STRUCT('it' AS name, 18000 AS base_budget, 0.10 AS variance_pct),
    STRUCT('hr' AS name, 15000 AS base_budget, 0.09 AS variance_pct)
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
  GENERATE_UUID() AS department_id,
  name,
  period,
  base_budget AS budget,
  actual,
  actual - base_budget AS variance
FROM base
ORDER BY period, name
