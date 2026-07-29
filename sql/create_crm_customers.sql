-- crm_customers (2026-07-19)
-- Derived directly from real purchase events in sales_events, so it's consistent
-- with everything else on the platform rather than a disconnected new dataset.
-- customer_id IS the visitor's user_pseudo_id -- this is the literal "connect
-- visitor IDs to customer LTV" link Felicia asked for, not a separate join table.
-- segment is behavioral, not just spend-based: VIP (high spend) > returning
-- (converted on a return visit, session_number > 1 -- ties directly into the
-- journey feature) > new (converted on their first visit).
-- Only purchases with revenue > 0 are counted as customers -- a small number of
-- ambient "purchase" events in sales_events log $0 revenue (a pre-existing generator
-- simplification, not a real order), so they're excluded rather than creating
-- phantom $0-LTV customers.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.crm_customers` AS
WITH purchases AS (
  SELECT user_pseudo_id, revenue, event_timestamp, country, session_number
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND revenue > 0
),
agg AS (
  SELECT
    user_pseudo_id AS customer_id,
    MIN(event_timestamp) AS first_purchase_ts,
    SUM(revenue) AS total_spend,
    COUNT(*) AS order_count,
    MAX(session_number) AS max_session_number,
    ANY_VALUE(country) AS country
  FROM purchases
  GROUP BY user_pseudo_id
)
SELECT
  customer_id,
  DATE(first_purchase_ts) AS first_purchase_date,
  total_spend,
  total_spend AS lifetime_value,
  order_count,
  CASE
    WHEN total_spend >= 8000 THEN 'VIP'
    WHEN max_session_number > 1 THEN 'returning'
    ELSE 'new'
  END AS segment,
  country
FROM agg
