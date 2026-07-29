-- store_performance (2026-07-20, rebranded to Maison Lumière 2026-07-24 Pass 18)
-- Synthetic (no real store-level POS data exists -- retail_sales has only
-- 3 rows total, see bigquery_fashion_intelligence memory). Six flagship
-- markets for the demo brand "Maison Lumière": Paris (HQ/flagship), New
-- York and London (flagship-tier), Milan (strong), Stockholm and
-- Copenhagen (established). Monthly Feb-Nov 2026.
-- Country values use the short forms already established elsewhere in the
-- platform ('UK', 'US') so cross-module country filtering (Command Center)
-- keeps working -- see the Pass 15 UK/United Kingdom bug this avoids.
-- Revenue base (32000 + RAND()*18000, was 55000+RAND()*30000) was tuned
-- down from the original six-city set specifically so total company
-- revenue (retail + wholesale + ecommerce, see finance_channel_monthly)
-- lands in Felicia's requested "around EUR 8-12M annually" band rather than
-- overshooting -- wholesale is the dominant channel by design (~7.3M),
-- consistent with a luxury house's real dependency on multi-brand retail
-- partners like Net-a-Porter/Mytheresa.
-- base_rent/base_staff were re-tuned in the same pass to ~45-52% of each
-- store's own average monthly revenue (was still calibrated for the old,
-- higher pre-rescale revenue formula, which left 5 of 6 stores showing a
-- negative contribution margin -- not a believable demo number for a
-- "healthy luxury retailer" story). Now every store contributes positive
-- margin before overhead, consistent with realistic retail economics.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.store_performance` AS
WITH stores AS (
  SELECT * FROM UNNEST([
    STRUCT('store_paris' AS store_id, 'Maison Lumière Paris' AS store_name, 'Paris' AS city, 'France' AS country, 1.7 AS tier, 11000 AS base_rent, 21000 AS base_staff),
    STRUCT('store_newyork', 'Maison Lumière New York', 'New York', 'US', 1.6, 14000, 20000),
    STRUCT('store_london', 'Maison Lumière London', 'London', 'UK', 1.5, 10000, 19000),
    STRUCT('store_milan', 'Maison Lumière Milan', 'Milan', 'Italy', 1.2, 7500, 15000),
    STRUCT('store_stockholm', 'Maison Lumière Stockholm', 'Stockholm', 'Sweden', 1.0, 6000, 12500),
    STRUCT('store_copenhagen', 'Maison Lumière Copenhagen', 'Copenhagen', 'Denmark', 0.9, 5500, 11000)
  ])
),
months AS (
  SELECT period FROM UNNEST(GENERATE_DATE_ARRAY('2026-02-01', '2026-11-01', INTERVAL 1 MONTH)) AS period
),
base AS (
  SELECT
    s.store_id,
    s.store_name,
    s.city,
    s.country,
    FORMAT_DATE('%Y-%m', m.period) AS period,
    CAST(ROUND(s.tier * (32000 + RAND() * 18000)) AS INT64) AS revenue,
    CAST(ROUND(s.base_staff * (0.94 + RAND() * 0.12)) AS INT64) AS staff_cost,
    CAST(ROUND(s.base_rent * (0.98 + RAND() * 0.06)) AS INT64) AS rent,
    CAST(ROUND(s.tier * (3200 + RAND() * 1800)) AS INT64) AS footfall,
    CAST(ROUND(s.tier * (3200 + RAND() * 1800) * (0.14 + RAND() * 0.1)) AS INT64) AS transactions
  FROM stores s
  CROSS JOIN months m
)
SELECT
  *,
  ROUND(SAFE_DIVIDE(transactions, footfall) * 100, 1) AS conversion_rate_pct,
  CAST(ROUND(SAFE_DIVIDE(revenue, transactions)) AS INT64) AS avg_transaction_value
FROM base
ORDER BY store_id, period
