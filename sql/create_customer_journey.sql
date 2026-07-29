-- customer_journey (2026-07-20)
-- Real, derived entirely from sales_events -- every converting visitor
-- (user_pseudo_id with a real purchase, revenue > 0) gets one row: first
-- touch (their earliest event, any type) through purchase, days-to-convert,
-- total sessions, and days since their last recorded activity. churn_risk is
-- a heuristic threshold (not a model) documented here: high if inactive 60+
-- days since the dataset's own latest activity, medium 30-59, else low.
-- vip_segment joins straight from crm_customers.segment (same customer_id =
-- user_pseudo_id key already established there).

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.customer_journey` AS
WITH dataset_anchor AS (
  SELECT DATE(MAX(event_timestamp)) AS as_of_date
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
),
converters AS (
  SELECT DISTINCT user_pseudo_id
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
),
first_touch AS (
  SELECT
    user_pseudo_id,
    ARRAY_AGG(STRUCT(event_timestamp, traffic_source) ORDER BY event_timestamp ASC LIMIT 1)[OFFSET(0)] AS row
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE user_pseudo_id IN (SELECT user_pseudo_id FROM converters)
  GROUP BY user_pseudo_id
),
first_purchase AS (
  SELECT
    user_pseudo_id,
    MIN(event_timestamp) AS purchase_timestamp
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
  GROUP BY user_pseudo_id
),
activity AS (
  SELECT
    user_pseudo_id,
    COUNT(DISTINCT session_id) AS total_sessions,
    MAX(event_timestamp) AS last_activity_timestamp
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE user_pseudo_id IN (SELECT user_pseudo_id FROM converters)
  GROUP BY user_pseudo_id
)
SELECT
  ft.user_pseudo_id AS customer_id,
  DATE(ft.row.event_timestamp) AS first_touch_date,
  ft.row.traffic_source AS first_touch_source,
  DATE(fp.purchase_timestamp) AS purchase_date,
  DATE_DIFF(DATE(fp.purchase_timestamp), DATE(ft.row.event_timestamp), DAY) AS days_to_convert,
  act.total_sessions,
  DATE(act.last_activity_timestamp) AS last_activity_date,
  DATE_DIFF(a.as_of_date, DATE(act.last_activity_timestamp), DAY) AS days_since_last_activity,
  CASE
    WHEN DATE_DIFF(a.as_of_date, DATE(act.last_activity_timestamp), DAY) >= 60 THEN 'high'
    WHEN DATE_DIFF(a.as_of_date, DATE(act.last_activity_timestamp), DAY) >= 30 THEN 'medium'
    ELSE 'low'
  END AS churn_risk,
  COALESCE(c.segment, 'new') AS vip_segment
FROM first_touch ft
JOIN first_purchase fp ON fp.user_pseudo_id = ft.user_pseudo_id
JOIN activity act ON act.user_pseudo_id = ft.user_pseudo_id
CROSS JOIN dataset_anchor a
LEFT JOIN `project-cb954e13-3b16-432f-aa7.analytics_lab.crm_customers` c ON c.customer_id = ft.user_pseudo_id
ORDER BY purchase_date DESC
