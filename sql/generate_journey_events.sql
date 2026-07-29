-- Influencer journey event generator (2026-07-19)
-- Rebuilds sales_events with real visitor-level journey tracking:
-- post -> first-touch visitor (within 48h) -> some fraction return later -> some purchase.
-- Same user_pseudo_id is reused across a visitor's first-touch and return-visit rows so
-- "return visitor" is a real, joinable signal (session_number > 1 for a known first-touch ID),
-- not a coincidence. Campaign-attributed rows carry traffic_source =
-- 'influencer_<name>' (a realistic UTM-style tag) so the journey view can join precisely
-- without ambiguity, even though multiple campaigns can share a product_slug.
--
-- Step 1: materialize one row per (campaign, first-touch visitor) with stable random
-- assignment (must materialize — BigQuery does not guarantee RAND() stays stable across
-- multiple references to the same CTE within one query).

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab._tmp_visitors` AS
WITH campaigns AS (
  SELECT
    influencer, product_slug, post_date, gifted_cost, purchases, total_revenue, platform, country,
    CAST(GREATEST(purchases, 1) * (8 + RAND() * 14) AS INT64) AS first_visitor_count
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance`
),
expanded AS (
  SELECT
    c.*,
    GENERATE_UUID() AS user_pseudo_id,
    ROW_NUMBER() OVER (PARTITION BY c.influencer, c.product_slug, c.post_date ORDER BY GENERATE_UUID()) AS visitor_rank,
    RAND() AS returner_rand,
    RAND() AS split_rand,
    CAST(FLOOR(RAND() * 44) AS INT64) AS first_touch_offset_hours,
    CAST(3 + FLOOR(RAND() * 22) AS INT64) AS return_gap_days
  FROM campaigns c, UNNEST(GENERATE_ARRAY(1, c.first_visitor_count)) AS n
)
SELECT
  influencer, product_slug, post_date, gifted_cost, purchases, total_revenue, platform, country,
  user_pseudo_id, visitor_rank,
  (visitor_rank <= purchases) AS is_purchaser,
  (returner_rand < 0.28) AS is_returner,
  (returner_rand < 0.28 AND split_rand < 0.55) AS purchase_on_return,
  first_touch_offset_hours, return_gap_days
FROM expanded;

-- Step 2: build sales_events from the materialized visitors, plus browse-funnel noise
-- and ambient (non-campaign) organic traffic across the full period.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events` AS

WITH v AS (
  SELECT * FROM `project-cb954e13-3b16-432f-aa7.analytics_lab._tmp_visitors`
),

first_touch AS (
  SELECT
    GENERATE_UUID() AS session_id, 1 AS session_number, 'session_start' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL first_touch_offset_hours HOUR) AS event_timestamp,
    product_slug, 0 AS revenue, country,
    CONCAT('influencer_', LOWER(REPLACE(influencer, ' ', '_'))) AS traffic_source,
    user_pseudo_id
  FROM v
),

first_purchase AS (
  SELECT
    GENERATE_UUID() AS session_id, 1 AS session_number, 'purchase' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL first_touch_offset_hours HOUR) AS event_timestamp,
    product_slug,
    CAST(ROUND(SAFE_DIVIDE(total_revenue, purchases) * (0.85 + RAND() * 0.3)) AS INT64) AS revenue,
    country,
    CONCAT('influencer_', LOWER(REPLACE(influencer, ' ', '_'))) AS traffic_source,
    user_pseudo_id
  FROM v
  WHERE is_purchaser AND NOT purchase_on_return
),

return_visit AS (
  SELECT
    GENERATE_UUID() AS session_id, 2 AS session_number, 'session_start' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL first_touch_offset_hours HOUR), INTERVAL return_gap_days DAY) AS event_timestamp,
    product_slug, 0 AS revenue, country,
    CONCAT('influencer_', LOWER(REPLACE(influencer, ' ', '_'))) AS traffic_source,
    user_pseudo_id
  FROM v
  WHERE is_returner
),

return_purchase AS (
  SELECT
    GENERATE_UUID() AS session_id, 2 AS session_number, 'purchase' AS event_name,
    TIMESTAMP_ADD(TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL first_touch_offset_hours HOUR), INTERVAL return_gap_days DAY) AS event_timestamp,
    product_slug,
    CAST(ROUND(SAFE_DIVIDE(total_revenue, purchases) * (0.85 + RAND() * 0.3)) AS INT64) AS revenue,
    country,
    CONCAT('influencer_', LOWER(REPLACE(influencer, ' ', '_'))) AS traffic_source,
    user_pseudo_id
  FROM v
  WHERE is_purchaser AND purchase_on_return AND is_returner
),

hype_funnel AS (
  SELECT
    GENERATE_UUID() AS session_id, 1 AS session_number,
    CASE WHEN RAND() < 0.6 THEN 'page_view' ELSE 'add_to_cart' END AS event_name,
    TIMESTAMP_ADD(TIMESTAMP(c.post_date), INTERVAL CAST(FLOOR(RAND() * 44) AS INT64) HOUR) AS event_timestamp,
    c.product_slug, 0 AS revenue, c.country,
    CONCAT('influencer_', LOWER(REPLACE(c.influencer, ' ', '_'))) AS traffic_source,
    GENERATE_UUID() AS user_pseudo_id
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance` c,
  UNNEST(GENERATE_ARRAY(1, GREATEST(c.purchases * 3, 6))) AS n
),

ambient AS (
  SELECT
    GENERATE_UUID() AS session_id, 1 AS session_number,
    CASE
      WHEN RAND() < 0.03 THEN 'purchase'
      WHEN RAND() < 0.15 THEN 'add_to_cart'
      WHEN RAND() < 0.55 THEN 'page_view'
      ELSE 'session_start'
    END AS event_name,
    TIMESTAMP_ADD(TIMESTAMP('2026-02-01'), INTERVAL CAST(FLOOR(RAND() * 273) AS INT64) DAY) AS event_timestamp,
    p.product_slug, 0 AS revenue,
    (SELECT country FROM UNNEST(['Sweden','Norway','Denmark','Finland','Germany','France','UK',
      'Netherlands','Italy','US','Japan','China','South Korea','Singapore','Australia']) AS country
      ORDER BY RAND() LIMIT 1) AS country,
    'organic' AS traffic_source,
    GENERATE_UUID() AS user_pseudo_id
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.product_data` p, UNNEST(GENERATE_ARRAY(1, 40)) AS n
)

SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM first_touch
UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM first_purchase
UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM return_visit
UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM return_purchase
UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM hype_funnel
UNION ALL
SELECT user_pseudo_id, session_id, session_number, event_name, event_timestamp, product_slug,
  revenue, revenue AS value_per_event, traffic_source, country, country AS geo_city,
  CAST(NULL AS STRING) AS event_params
FROM ambient;

DROP TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab._tmp_visitors`;
