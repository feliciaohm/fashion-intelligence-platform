-- Synthetic sales_events generator (2026-07-19)
--
-- Problem: sales_events only covered 2026-01-03 to 2026-02-04, while influencer_posts
-- spans 2026-02-12 to 2026-11-06 — near-zero date overlap, so the hype-window uplift
-- model (influencer_product_date_master) had nothing to measure against.
--
-- Design principle: don't invent new success stories. influencer_product_performance
-- already has real purchases/total_revenue per campaign (40 rows, ROI ranging from
-- +558% to -88%) — this generator produces event-level detail CONSISTENT with those
-- already-established numbers, rather than contradicting them. Four layers:
--   1. hype_purchases   — exactly `purchases` purchase events per campaign, within
--                         post_date ± 7 days, revenue jittered around total_revenue/purchases
--   2. hype_funnel      — session_start/page_view/add_to_cart browse activity in the same
--                         window, ~5x purchase volume (typical low-conversion funnel)
--   3. baseline_activity — lower-volume purchase + browse events in the pre-post baseline
--                         window (post_date -14 to -7 days), scaled to ~40% of hype volume,
--                         so the uplift comparison has a real "before" state
--   4. ambient           — background organic traffic for all 21 products spread across
--                         the full Feb-Nov 2026 window, independent of any campaign
--
-- Known limitation: 6/40 campaigns have purchases=0 but nonzero total_revenue in the
-- source data (a pre-existing inconsistency, not something this generator invents) —
-- those campaigns get funnel/browse events but no purchase event, so their hype-window
-- revenue will read as 0 rather than matching total_revenue exactly.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events` AS

WITH campaigns AS (
  SELECT influencer, product_slug, post_date, purchases, total_revenue, platform, country
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance`
),

products AS (
  SELECT product_slug, price FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_data`
),

countries AS (
  SELECT country FROM UNNEST([
    'Sweden','Norway','Denmark','Finland','Germany','France','UK','Netherlands',
    'Italy','US','Japan','China','South Korea','Singapore','Australia'
  ]) AS country
),

hype_purchases AS (
  SELECT
    GENERATE_UUID() AS user_pseudo_id,
    GENERATE_UUID() AS session_id,
    1 AS session_number,
    'purchase' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL CAST(FLOOR(RAND() * 15) - 7 AS INT64) DAY) AS event_timestamp,
    product_slug,
    CAST(ROUND(SAFE_DIVIDE(total_revenue, purchases) * (0.85 + RAND() * 0.3)) AS INT64) AS revenue,
    country,
    platform AS traffic_source
  FROM campaigns, UNNEST(GENERATE_ARRAY(1, purchases)) AS n
  WHERE purchases > 0
),

hype_funnel AS (
  SELECT
    GENERATE_UUID() AS user_pseudo_id,
    GENERATE_UUID() AS session_id,
    1 AS session_number,
    CASE WHEN RAND() < 0.5 THEN 'session_start' WHEN RAND() < 0.8 THEN 'page_view' ELSE 'add_to_cart' END AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL CAST(FLOOR(RAND() * 15) - 7 AS INT64) DAY) AS event_timestamp,
    product_slug,
    0 AS revenue,
    country,
    platform AS traffic_source
  FROM campaigns, UNNEST(GENERATE_ARRAY(1, GREATEST(purchases * 5, 10))) AS n
),

baseline_purchases AS (
  SELECT
    GENERATE_UUID() AS user_pseudo_id,
    GENERATE_UUID() AS session_id,
    1 AS session_number,
    'purchase' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL CAST(-7 - FLOOR(RAND() * 7) AS INT64) DAY) AS event_timestamp,
    product_slug,
    CAST(ROUND(SAFE_DIVIDE(total_revenue, purchases) * (0.7 + RAND() * 0.3)) AS INT64) AS revenue,
    country,
    'organic' AS traffic_source
  FROM campaigns, UNNEST(GENERATE_ARRAY(1, GREATEST(CAST(ROUND(purchases * 0.4) AS INT64), 0))) AS n
  WHERE purchases > 0
),

baseline_funnel AS (
  SELECT
    GENERATE_UUID() AS user_pseudo_id,
    GENERATE_UUID() AS session_id,
    1 AS session_number,
    CASE WHEN RAND() < 0.6 THEN 'session_start' ELSE 'page_view' END AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL CAST(-7 - FLOOR(RAND() * 7) AS INT64) DAY) AS event_timestamp,
    product_slug,
    0 AS revenue,
    country,
    'organic' AS traffic_source
  FROM campaigns, UNNEST(GENERATE_ARRAY(1, GREATEST(CAST(ROUND(purchases * 2) AS INT64), 5))) AS n
),

ambient AS (
  SELECT
    GENERATE_UUID() AS user_pseudo_id,
    GENERATE_UUID() AS session_id,
    1 AS session_number,
    CASE
      WHEN RAND() < 0.03 THEN 'purchase'
      WHEN RAND() < 0.15 THEN 'add_to_cart'
      WHEN RAND() < 0.55 THEN 'page_view'
      ELSE 'session_start'
    END AS event_name,
    TIMESTAMP_ADD(TIMESTAMP('2026-02-01'), INTERVAL CAST(FLOOR(RAND() * 273) AS INT64) DAY) AS event_timestamp,
    p.product_slug,
    0 AS revenue,
    (SELECT country FROM countries ORDER BY RAND() LIMIT 1) AS country,
    'organic' AS traffic_source
  FROM products p, UNNEST(GENERATE_ARRAY(1, 40)) AS n
)

SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM hype_purchases

UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM hype_funnel

UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM baseline_purchases

UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM baseline_funnel

UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM ambient
