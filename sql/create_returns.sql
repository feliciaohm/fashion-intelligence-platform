-- returns (2026-07-19)
-- ~11% of real purchase events (revenue > 0) become a return, so refund_amount and
-- product_slug tie back to an actual order rather than being invented independently.
-- influencer_campaign is populated whenever the originating purchase was
-- attributed to an influencer post (traffic_source LIKE 'influencer_%'), and left
-- NULL for organic/ambient purchases -- "linked where possible," not forced.
-- Note: traffic_source values are double-prefixed ("influencer_influencer_o") due
-- to a pre-existing quirk in the Pass 9 sales_events generator (harmless there --
-- both sides of the journey_master join compute the same doubled string, so
-- equality still holds) -- extracting via SUBSTR(..., -1) (last character) sidesteps
-- it rather than fixing the underlying generator, which is out of this task's scope.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.returns` AS
WITH purchases AS (
  SELECT
    GENERATE_UUID() AS order_id,
    product_slug,
    revenue,
    event_timestamp,
    traffic_source,
    RAND() AS select_rand,
    RAND() AS reason_rand,
    RAND() AS refund_rand,
    CAST(3 + FLOOR(RAND() * 11) AS INT64) AS days_to_return
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
)
SELECT
  order_id,
  product_slug,
  CASE
    WHEN reason_rand < 0.28 THEN 'wrong_size'
    WHEN reason_rand < 0.48 THEN 'changed_mind'
    WHEN reason_rand < 0.68 THEN 'quality_issue'
    WHEN reason_rand < 0.85 THEN 'damaged_in_transit'
    ELSE 'other'
  END AS reason,
  DATE_ADD(DATE(event_timestamp), INTERVAL days_to_return DAY) AS return_date,
  CAST(ROUND(revenue * (0.85 + refund_rand * 0.15)) AS INT64) AS refund_amount,
  CASE
    WHEN traffic_source LIKE 'influencer_%'
    THEN CONCAT('Influencer ', UPPER(SUBSTR(traffic_source, -1)))
    ELSE CAST(NULL AS STRING)
  END AS influencer_campaign
FROM purchases
WHERE select_rand < 0.11
ORDER BY return_date DESC
