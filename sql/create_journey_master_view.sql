CREATE OR REPLACE VIEW `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_journey_master` AS
WITH campaigns AS (
  SELECT
    influencer, product_slug, post_date, gifted_cost, platform, country,
    CONCAT('influencer_', LOWER(REPLACE(influencer, ' ', '_'))) AS attribution_key
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.influencer_product_performance`
),

first_touch AS (
  SELECT product_slug, traffic_source AS attribution_key,
    COUNT(DISTINCT user_pseudo_id) AS first_visitors_48h
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'session_start' AND session_number = 1 AND traffic_source LIKE 'influencer_%'
  GROUP BY product_slug, traffic_source
),

returners AS (
  SELECT product_slug, traffic_source AS attribution_key,
    COUNT(DISTINCT user_pseudo_id) AS return_visitors
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'session_start' AND session_number > 1 AND traffic_source LIKE 'influencer_%'
  GROUP BY product_slug, traffic_source
),

purchases AS (
  SELECT product_slug, traffic_source AS attribution_key,
    COUNT(*) AS purchases,
    SUM(revenue) AS revenue_attributed
  FROM `project-cb954e13-3b16-432f-aa7.analytics_lab.sales_events`
  WHERE event_name = 'purchase' AND traffic_source LIKE 'influencer_%'
  GROUP BY product_slug, traffic_source
)

SELECT
  c.influencer,
  c.product_slug,
  c.post_date,
  c.gifted_cost,
  c.platform,
  c.country,
  COALESCE(ft.first_visitors_48h, 0) AS first_visitors_48h,
  COALESCE(r.return_visitors, 0) AS return_visitors,
  ROUND(SAFE_DIVIDE(COALESCE(r.return_visitors, 0), NULLIF(ft.first_visitors_48h, 0)) * 100, 1) AS return_rate_pct,
  COALESCE(p.purchases, 0) AS purchases,
  COALESCE(p.revenue_attributed, 0) AS revenue_attributed,
  ROUND(SAFE_DIVIDE(COALESCE(p.revenue_attributed, 0) - c.gifted_cost, c.gifted_cost) * 100, 1) AS roi_pct
FROM campaigns c
LEFT JOIN first_touch ft ON c.product_slug = ft.product_slug AND c.attribution_key = ft.attribution_key
LEFT JOIN returners r ON c.product_slug = r.product_slug AND c.attribution_key = r.attribution_key
LEFT JOIN purchases p ON c.product_slug = p.product_slug AND c.attribution_key = p.attribution_key
ORDER BY c.post_date DESC
