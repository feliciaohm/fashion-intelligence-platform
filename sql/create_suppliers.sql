-- suppliers (2026-07-28, Pass 32 -- SAP CO/FI layer)
-- Synthetic (no real procurement/supplier-master table exists in this
-- dataset). Nine suppliers across the three sourcing categories a small
-- luxury house actually has (leather goods, knitwear, accessories), plus
-- outerwear and ready-to-wear. `category` is the supplier's own descriptive
-- sourcing category (for the scorecard); `product_category` uses the exact
-- vocabulary of product_lifecycle.category (bags/dresses/knitwear/outerwear/
-- tops) so the Decision Intelligence EOQ calculator and the "total spend per
-- supplier" derivation can join straight onto real product/COGS data instead
-- of maintaining a second, disconnected category taxonomy.
-- Two suppliers are deliberately designed to trip the risk thresholds
-- (on_time_delivery_rate < 85% or lead_time_days > 60) so the Supplier
-- Intelligence page's risk-alert logic has real rows to surface, not an
-- always-empty state.

CREATE OR REPLACE TABLE `project-cb954e13-3b16-432f-aa7.analytics_lab.suppliers` AS
SELECT * FROM UNNEST([
  STRUCT(
    GENERATE_UUID() AS supplier_id,
    'Florence Leather Co.' AS supplier_name,
    'Italy' AS country,
    'Leather Goods' AS category,
    'bags' AS product_category,
    45 AS lead_time_days,
    94.2 AS on_time_delivery_rate,
    185.0 AS cost_per_unit,
    50 AS minimum_order_quantity,
    'Net 30' AS payment_terms
  ),
  STRUCT(GENERATE_UUID(), 'Toscana Pelletteria', 'Italy', 'Leather Goods', 'bags',
    38, 91.5, 210.0, 30, 'Net 45'),
  STRUCT(GENERATE_UUID(), 'Loire Leather Ateliers', 'France', 'Leather Goods', 'bags',
    72, 86.5, 198.0, 25, 'Net 45'),
  STRUCT(GENERATE_UUID(), 'Nordic Knits AB', 'Sweden', 'Knitwear', 'knitwear',
    52, 88.0, 62.0, 100, '50% deposit, Net 30'),
  STRUCT(GENERATE_UUID(), 'Alpine Wool Mill', 'Austria', 'Knitwear', 'knitwear',
    67, 79.4, 58.0, 150, 'Net 60'),
  STRUCT(GENERATE_UUID(), 'Lyon Silk Atelier', 'France', 'Accessories', 'tops',
    30, 96.8, 45.0, 80, 'Net 30'),
  STRUCT(GENERATE_UUID(), 'Como Silk Works', 'Italy', 'Accessories', 'dresses',
    41, 89.3, 78.0, 60, 'Net 45'),
  STRUCT(GENERATE_UUID(), 'Porto Outerwear Manufacturing', 'Portugal', 'Outerwear', 'outerwear',
    58, 83.7, 145.0, 40, 'Net 60'),
  STRUCT(GENERATE_UUID(), 'Istanbul Textile Group', 'Turkey', 'Ready-to-Wear', 'dresses',
    35, 92.1, 52.0, 120, 'Net 30')
])
ORDER BY supplier_name
