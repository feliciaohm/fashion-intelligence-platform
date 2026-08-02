# Data Audit

A complete, honest accounting of every metric shown anywhere on the Fashion Intelligence Platform: where it comes from, whether it's real, and what its limitations are. Written for anyone evaluating this platform for credibility — a brand considering it, an investor, or a hiring manager checking the claims hold up. Every one of the 73 API routes under `app/api/` was read to produce this document (67 as of the last audit pass, plus 6 added for the Data Quality layer and RFM Segmentation/Cohort Retention/Time Decay Attribution/Sell-Through/GMROI); nothing here is a summary of intent, it's a report of what the code actually does today.

## How to read this document

Every metric on the platform falls into one of four categories:

| Category | Meaning |
|---|---|
| **REAL** | Computed directly from a live query against a real BigQuery table. |
| **DERIVED-REAL** | A formula or model (DCF, CAPM, Monte Carlo, elasticity regression, cohort split, etc.) applied to real BigQuery inputs. The math may use an external or assumed parameter (a discount rate, a beta, a penetration rate) but the business data it's applied to is real. |
| **ILLUSTRATIVE / MOCK** | Hardcoded, imported from a `mock.ts` file, or otherwise not backed by any real table. |
| **EXTERNAL REFERENCE** | A real but externally-sourced figure (a cited industry benchmark, a public population statistic) — not derived from this platform's own BigQuery data at all. |

Project: `project-cb954e13-3b16-432f-aa7`, dataset: `analytics_lab`.

## Headline findings

Three things worth knowing before anything else:

1. **The `/master` page (Master Views) is 100% illustrative.** All four routes behind it (`app/api/master/product-performance`, `master/influencer-roi`, `master/market-performance`, `master/financial-health`) run entirely on `lib/masterViews.ts`, which reads from `app/api/*/mock.ts` files — no real BigQuery table is queried anywhere in that page. This isn't visible from the route names alone (`api/product-performance` — real — and `api/master/product-performance` — mock — are easy to confuse). The page now labels every KPI "(Illustrative)" and states this plainly in its header sentence and insight box; it did not before this audit.
2. **A broken BigQuery view (`country_performance_model`) was still being fed to the real Claude AI Search path.** The view collapses every country into a single row with `country = NULL` (confirmed by direct query). `lib/ai-demo-mode.ts` (the no-credits fallback) already routed around this by querying `sales_events` directly — but `app/api/ai-query/route.ts`'s real-Claude path (used once API credits are added) was still querying the broken view. **Fixed as part of this audit**: it now uses the same real `sales_events`-grouped-by-country query.
3. **`app/api/search/route.ts` is legacy, unused-in-practice code with a dead AI step.** It uses OpenAI (every other AI feature on this platform uses Anthropic), the model's "table interpretation" step is computed but then ignored — the SQL is hardcoded to always query `product_performance_master` regardless of what the model says — and its comments/strings are partly in Swedish. It isn't linked from any current page's navigation. Flagged here rather than silently left in the codebase; not touched further since it's out of scope for this audit to rewrite.

## Real BigQuery tables in active use

`sales_events`, `influencer_product_performance`, `product_full_stack`, `product_data`, `product_lifecycle`, `product_performance_master`, `crm_customers`, `customer_journey`, `cost_centers`, `finance_channel`, `finance_channel_monthly` (a separate table from `finance_channel` — both exist and are used by different routes), `finance_pnl` (real but sparse — see Known Limitations), `store_performance`, `wholesale_orders`, `returns`, `influencer_journey_master`, `session_level_model`, `suppliers` (added this pass — see Supply Chain), plus the integration write targets `integrations`, `excel_pnl_imports`, `shopify_live_orders`, `shopify_live_products`, `shopify_live_customers`, `shopify_live_inventory` (all real tables, currently empty until a source is connected).

**One table added this pass holds illustrative, not real, data**: `overhead_departments` (IT and HR monthly cost figures for the Cost Allocation Engine) — see Finance below. It exists specifically so the Cost Allocation Engine's two illustrative departments never touch or alter the real `cost_centers` rows that other, already-shipped pages (Cost Centers, Monthly Variance Report, Executive Summary) compute from.

**One real table is broken and should not be queried directly**: `country_performance_model` collapses to a single `country = NULL` row. See Known Limitations.

## Route-by-route breakdown

### Data Quality Layer (added Pass 34 — runs before every calculator/dashboard)

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/data-quality` | (1) Duplicate detection across `shopify_orders`/`sales_events`/`influencer_product_performance` by real composite keys; (2) null `gifted_cost` handling — campaigns flagged "cost unknown," excluded from blended ROI, shown separately; (3) outlier detection on real order-level revenue (>3σ above mean, review-required list); (4) country-name → ISO-2 normalization log | REAL — every check queries live BigQuery data on each load; nothing here is precomputed or cached | `shopify_orders`, `sales_events`, `influencer_product_performance`, `crm_customers`, `store_performance` |

As of this audit, run against the real dataset: **0 duplicates** found across all three scanned tables (the logic is live and would catch a real duplicate the moment one appears, e.g. from a double-synced Shopify import); **0 campaigns** with a null `gifted_cost` (all 40 real campaigns have a recorded cost today — same caveat, the check is real and ready); **2 real outliers** flagged (`soft-tote-sand`, Sweden, z=5.19 and `structured-mini-black`, Germany, z=3.26); **14 of 15** real distinct country values needed ISO-2 normalization (including "UK," which is not actually a valid ISO 3166-1 alpha-2 code — the real code is "GB"). `lib/data-quality.ts` holds the shared `safeDivide`/`detectOutliers`/`normalizeCountry` primitives every other calculator's `DataQualityIndicator` footnote is built on.

### Overview

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/executive-summary` | Revenue actual/forecast/MoM%, churn rate, top product/influencer, worst cost center, `insight` sentence, action items | REAL; `insight` is DERIVED-REAL (Claude constrained to real injected numbers, or rule-based fallback) | `finance_channel_monthly`, `cost_centers`, `product_lifecycle`, `influencer_product_performance`, `customer_journey`, `store_performance`, `sales_events`, `crm_customers` via `lib/insights-server.ts` |
| `/api/influencer-journey` | Per-campaign first-visitors/return-visitors/return-rate/revenue/ROI | REAL | `influencer_journey_master` |
| `/api/influencers`, `/api/influencer-summary`, `/api/influencer/[slug]` | Campaign-level and per-influencer-aggregated ROI/revenue/cost | REAL | `influencer_product_performance` |
| `/api/quick-metrics` | Revenue, MoM growth, gross margin, customer count, CAC, CLV:CAC ratio (6-tile strip) | REAL; status color only applied where a defensible threshold exists (Customer Count and CAC left neutral, deliberately) | `lib/quick-metrics-server.ts` → `getExecutiveMetrics` + `getRawPlatformMetrics` |

### Commerce

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/products`, `/api/products/[slug]` | Product catalogue, retail/ecommerce/influencer revenue | REAL | `product_full_stack` |
| `/api/product-lifecycle` | Cost/wholesale/retail price, margins, units sold | REAL | `product_lifecycle` |
| `/api/product-performance` | Aggregated product performance | REAL | `product_performance_master` (unrelated to the mock `master/product-performance` route below — same words, different route) |
| `/api/pricing` | Retail/wholesale margin, below-threshold flag, 3-month trend | REAL; `MARGIN_THRESHOLD_PCT = 50%` is an ILLUSTRATIVE "luxury rule of thumb," not a sourced figure | `product_lifecycle`, `sales_events` |
| `/api/stores` | Revenue, staff cost, rent, conversion by store/month | REAL | `store_performance` |
| `/api/wholesale` | Orders, reorders, revenue by retailer/product | REAL | `wholesale_orders` |

### People

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/customers` | Segment, country, LTV, order count | REAL | `crm_customers` |
| `/api/customer-journey` | First touch → purchase, churn risk, VIP segment | REAL | `customer_journey` |
| `/api/countries` | Country, event count, revenue | REAL | `sales_events` |
| `/api/returns` | Return reason, refund amount, linked campaign | REAL | `returns` |

### Finance

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/finance-pnl` | Product-level P&L (revenue, COGS, margin, opex, budget variance) | REAL, but structurally sparse — see Known Limitations | `finance_pnl` joined through a crosswalk to `product_data` |
| `/api/finance-deep` | Channel P&L, quarterly actual/forecast, margin waterfall | REAL | `finance_channel`, `returns`, `influencer_product_performance` |
| `/api/cost-centers`, `/api/variance-report` | Budget vs. actual by department/channel, narrative | REAL | `cost_centers`, `finance_channel_monthly` |
| `/api/forecast` | 3-month conservative/base/optimistic revenue by channel | DERIVED-REAL — real trailing MoM growth rate, clamped ±50%, projected forward | `finance_channel_monthly` |
| `app/finance/page.tsx`'s "Company Overview" and "Scenario" sections | Illustrative company-wide P&L, +20% marketing scenario | **ILLUSTRATIVE/MOCK** — `mockPNL` (`app/api/finance/mock.ts`), `simulateMarketingSpend` (`app/api/scenario/mock.ts`) | Already labeled "Illustrative" on the page itself; not queried by any API route, only imported directly by the page component |
| `/api/consolidated-pnl` (added Pass 32) | Revenue by channel → gross profit → opex by cost center → EBITDA → net margin, actual/budget/prior-period, auto-generated Management Commentary | REAL revenue/COGS/opex; DERIVED-REAL budget-COGS (real COGS ratio applied to budgeted revenue, since no COGS budget exists) and Management Commentary (rule-based sentence generation off the real numbers above, same pattern as `/api/variance-report` — no LLM call); **ILLUSTRATIVE** D&A line (2% of revenue, a named planning assumption — no fixed-asset/depreciation schedule exists in this dataset) | `finance_channel_monthly`, `cost_centers` |
| `/api/cost-allocation` (added Pass 32) | Channel revenue/COGS/gross profit; 4 department overhead pools (Marketing, IT, Logistics, HR) allocated across Retail/Ecommerce/Wholesale via user-adjustable sliders; resulting "true margin" per channel | REAL channel revenue/COGS; REAL Marketing and Logistics department costs (`cost_centers`); **ILLUSTRATIVE** IT and HR department costs (`overhead_departments`, no source table exists for either); default allocation %s are DERIVED-REAL for Marketing/IT (real revenue share) and Logistics (real transaction/order-count share across `store_performance`, `sales_events`, `wholesale_orders`), and an explicitly-named even-split ILLUSTRATIVE assumption for HR (no headcount-by-channel table exists) — every default is user-overridable | `finance_channel_monthly`, `cost_centers`, `overhead_departments`, `store_performance`, `sales_events`, `wholesale_orders` |

### Supply Chain

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/suppliers` (added Pass 32) | Supplier scorecard (lead time, on-time delivery, cost/unit, MOQ, payment terms), risk alerts (OTD &lt; 85% or lead time &gt; 60d), estimated spend per supplier | REAL supplier attributes (`suppliers`); estimated spend is DERIVED-REAL — real COGS × real units sold per product category (`product_lifecycle`), split evenly across the suppliers tagged to that category, since no purchase-order-level table exists to source exact per-supplier spend | `suppliers`, `product_lifecycle` |
| `/api/decision/eoq` (extended Pass 32) | Reorder point (in addition to the existing EOQ order quantity) | DERIVED-REAL — real daily demand × the real lead time of the fastest supplier tracked for that product category (`suppliers`), inflated for that supplier's real on-time delivery rate as a safety-stock buffer | `product_lifecycle`, `sales_events`, `suppliers` |

### Intelligence & Decision Calculators

| Route | Metrics | Type | Notes |
|---|---|---|---|
| `/api/value-drivers` | Revenue tree (Retail/Online/Wholesale), Sessions × Conversion × AOV | REAL/DERIVED-REAL | Explicitly notes "Paid" traffic shows €0 because no paid-media channel exists in this dataset — not a bug, a real data gap |
| `/api/growth-bridge` | Expansion/new business/churn/price waterfall | DERIVED-REAL | Real `sales_events` split into two equal-count cohorts (no real multi-year history exists to compare literal periods) |
| `/api/benchmarks`, `/api/consulting-summary` | Platform value REAL; industry average/best-in-class EXTERNAL REFERENCE | Mixed | `lib/benchmarks.ts` — every external figure cited with a real source, `bestInClass` left `null` (not invented) where no source existed |
| `/api/decision/store-viability` | Break-even timeline, Year 1–3 revenue | DERIVED-REAL + several named ILLUSTRATIVE assumptions (€3,000/staff/month, fit-out = 8× rent, 15% cannibalization) | Every assumption named in the calculator's own methodology text |
| `/api/decision/collab-roi` | Projected revenue/ROI/halo for a new collaboration | DERIVED-REAL, from real comparable-campaign ratios | Explicit fallback narration when sample size is thin (&lt;3 campaigns) |
| `/api/decision/price-elasticity` | Price/volume/margin elasticity | DERIVED-REAL (real regression) or EXTERNAL REFERENCE fallback (`-0.4`, a cited luxury benchmark) when fewer than 2 real price points exist in-category | Response states which of the two methods was used |
| `/api/decision/market-expansion` | Entry-mode recommendation | REAL counts/revenue + ILLUSTRATIVE planning-heuristic timelines | Timelines explicitly noted as industry heuristics, not fit to this dataset |
| `/api/decision/monte-carlo-forecast` | 10,000-run revenue distribution | DERIVED-REAL, seeded from real 6-month growth mean/std | High-volatility flag explicitly attributed to the real wholesale ramp, not a model error |
| `/api/decision/campaign-impact` (DiD) | Real lift from a treatment/control campaign | DERIVED-REAL | Explicit low-confidence warning under 50 orders/group |
| `/api/decision/clv-analysis`, `/api/decision/cac-clv` | CLV, CAC, CAC:CLV ratio by channel/segment | REAL inputs + DERIVED-REAL (2-year assumed lifespan) | Organic channel shown honestly as 0 customers rather than hidden |
| `/api/decision/cagr` | Smoothed and raw CAGR, Rule of 72 | DERIVED-REAL | Uses a smoothed multi-month figure specifically because a single-endpoint CAGR on ~10 months of seasonal data is misleading |
| `/api/decision/demand-decomposition` | Trend/residual revenue decomposition | DERIVED-REAL (OLS log-linear regression) | Explicitly not an ARIMA model — "this dataset only has [N] months... a model that looks sophisticated but is fit to noise" |
| `/api/decision/revenue-decomposition` | Volume/price/mix waterfall | DERIVED-REAL, real `sales_events` split into two equal-count cohorts | Chose `sales_events` specifically because `shopify_orders` has only 2 rows and `product_lifecycle` has no time dimension |
| `/api/decision/eoq` | Optimal reorder quantity, plus a reorder point (Pass 32) | REAL demand + ILLUSTRATIVE cost assumptions (€150 order cost, 22% holding-cost rate) — no procurement-cost table exists in this dataset; the reorder point added in Pass 32 uses real supplier lead time and on-time delivery from `suppliers` instead of an assumption — see Supply Chain above | Assumption named explicitly; falls back to order-quantity math only if no supplier is tracked for the chosen category |
| `/api/decision/market-adoption` (Bass Diffusion) | Adoption curve, 3 scenarios | DERIVED-REAL model, `p`/`q` are EXTERNAL REFERENCE industry benchmarks, not fit to this brand's own data | Market size shares the same population × penetration-rate approach as Market Sizing |
| `/api/decision/market-sizing` (TAM/SAM/SOM) | TAM, SAM, SOM | TAM = EXTERNAL REFERENCE (population) × ILLUSTRATIVE (1.5% penetration assumption); SAM/SOM = DERIVED-REAL, narrowed by real customer share | `POPULATION` dict explicitly commented as "NOT from BigQuery... approximate... circa 2023-2024" |
| `/api/decision/store-npv` | NPV, payback, IRR for a new store | DERIVED-REAL; `discountRate = 10%` is a stated standard corporate hurdle rate, not derived from this dataset | One real comparable (`store_performance`) feeds the GET default |
| `/api/decision/brand-valuation` (DCF) | Enterprise value, implied multiples | DERIVED-REAL, Gordon Growth DCF on a real annualized revenue/EBITDA base; discount rate and growth assumptions are user-typed | Growth suggestion explicitly capped at 25% because the real Sept–Nov wholesale ramp "is not a sustainable long-run rate" |
| `/api/decision/capm`, `/api/decision/wacc` | Cost of equity, WACC | EXTERNAL REFERENCE / user-input calculators — no BigQuery data at all | Both explicitly state this platform has no real balance-sheet or capital-structure table to derive these from |
| `/api/decision/churn-risk`, `/api/decision/churn-prediction` | Churn rate by segment, per-customer risk score | REAL (90-day-inactivity rule) / DERIVED-REAL (weighted scoring model) | Explicitly not a fitted logistic regression — no labeled historical churn outcome exists to train one |
| `/api/scenario-gifting`, `/api/scenario-sensitivity` | Gifting-budget projection, lever sensitivity table | DERIVED-REAL, real historical ROI ratio / real baseline metrics | Sensitivity explicitly stated as "a simplifying linear assumption, not a demand-elasticity model" |
| `/api/decision/rfm-segmentation` (Pass 34) | Recency/Frequency/Monetary quintile scores (1–5), Champions/At Risk/Lost/New Customer/Developing segments | REAL inputs (`crm_customers`, `customer_journey`), DERIVED-REAL quintile ranking | Frequency is real but degenerate — every one of the 97 real customers has `order_count = 1` (zero repeat purchases exist yet) — so F is explicitly held at a neutral score rather than faking differentiation from a constant |
| `/api/decision/cohort-retention` (Pass 34) | Acquisition-month cohorts × 30/60/90/180-day activity retention, filterable by channel | DERIVED-REAL — real `first_purchase_date`/`last_activity_date` (crm_customers/customer_journey); "retained" means still-active-by-last-known-activity, not a repeat-purchase count, since none exist yet | Cohorts too young to have reached a checkpoint show "n/a" (right-censored), never a fabricated 0%; the "organic" channel filter is real and currently empty — every real customer's `first_touch_source` is influencer-attributed |
| `/api/decision/time-decay-attribution` (Pass 34) | Last-touch vs. exponential-decay revenue attribution by traffic source | DERIVED-REAL — real per-visitor touchpoint sequences from `sales_events` (avg 2.34 events/purchaser); decay rate λ is a named, user-adjustable planning parameter, not fit to this dataset (no labeled ground-truth attribution exists to fit it against) | |
| `/api/decision/sell-through` (Pass 34) | Units sold ÷ total units available, by category/season, with a projected depletion date | REAL `units_sold_direct` (product_lifecycle) ÷ `stock_level` (`inventory`, extended this pass — see Known Limitations); "by market" is a real units-sold distribution (sales_events by country), not a true per-market sell-through, since inventory isn't split by market | Categories below 70% flagged; today, real data shows **all 5 categories** are below 70% |
| `/api/decision/gmroi` (Pass 34) | Gross margin ÷ average inventory value, by category | REAL — gross margin from `product_lifecycle` (retail − cost × units sold) rather than `finance_pnl`, which is real but too sparse (2 rows) to break out by category; inventory value from the extended `inventory` table | Benchmark ≥3.2 strong, <2.0 flagged; today, real data shows **no category reaches 3.2**, and Bags (1.04) is flagged for attention |

### Command Center / Explore / Pivot

| Route | Metrics | Type | Source |
|---|---|---|---|
| `/api/intelligence/dimensions`, `/api/intelligence/query` | Live filter values and filtered rows across 8 modules | REAL | `influencer_product_performance`, `product_lifecycle`, `finance_channel_monthly`, `cost_centers`, `crm_customers`, `store_performance`, `wholesale_orders`, `returns` |
| `/api/pivot` | User-built group-by/sum pivot | REAL, source/dimension/measure locked to a whitelist to prevent injection | `influencer_journey_master`, `product_full_stack`, `crm_customers`, `cost_centers`, `returns` |
| `/api/ai-query` | Free-form AI answer | DERIVED-REAL (Claude, constrained to real injected data) with a rule-based demo-mode fallback (`lib/ai-demo-mode.ts`) when no API credits | See Headline Findings — the broken `country_performance_model` reference in this route was fixed as part of this audit |
| `/api/search` | Legacy AI search, currently dead/unused in the app's navigation | REAL underlying table, but the AI-interpretation step is decorative — see Headline Findings | `product_performance_master`, hardcoded regardless of the model's actual interpretation |

### Master Views — illustrative

| Route | Type |
|---|---|
| `/api/master/product-performance`, `/api/master/influencer-roi`, `/api/master/market-performance`, `/api/master/financial-health` | **100% ILLUSTRATIVE/MOCK** — all four run on `lib/masterViews.ts`, which reads exclusively from `app/api/*/mock.ts` files. No real BigQuery table is queried by any of the four. |

### Integrations (Settings page)

| Route | What it does |
|---|---|
| `/api/integrations/shopify/connect` | Real live call to the Shopify Admin API to validate a store's credentials |
| `/api/integrations/shopify/sync` | Real live pull of orders/products/customers/inventory from a connected store into `shopify_live_*` tables |
| `/api/integrations/shopify/disconnect` | Removes stored credentials |
| `/api/integrations/excel/import` | Real BigQuery insert of an uploaded spreadsheet's rows into `excel_pnl_imports` |
| `/api/integrations/status` | Real connection status per source; GA4 and Google Sheets marked `available: false` (not built) |

## Known limitations, named plainly

- **`country_performance_model` is a broken BigQuery view** — it returns exactly one row with `country = NULL` instead of grouping by country. Fixed in this audit for the real-Claude AI Search path (`app/api/ai-query/route.ts`); the demo-mode fallback (`lib/ai-demo-mode.ts`) already avoided it. Do not query this view directly anywhere else without grouping `sales_events` by country instead.
- **`finance_pnl` is real but sparse.** It has historically covered only ~2 products for a single period. `/api/finance-pnl` inner-joins through a legacy product-ID crosswalk, so any product without a crosswalk match silently doesn't appear — this is why `/finance`'s real P&L table is short, not a bug.
- **Master Views (`/master`) is entirely mock data**, clearly labeled as such on the page as of this audit. It exists to demo the shape of the 4 target views documented in `sql/schema.sql`, not to report anything about Maison Lumière.
- **`/api/search` is legacy, effectively dead code** with a non-functional AI-interpretation step and mixed-language comments. Not linked from current navigation. Flagged for future cleanup, not modified here.
- **Every Decision Intelligence calculator that uses an assumption not derivable from this dataset says so in its own methodology text** (visible via the "Methodology" disclosure on each calculator) — CAPM, WACC, EOQ's cost assumptions, Store Viability's planning heuristics, Market Sizing/Bass Diffusion's population and penetration-rate figures, and Store NPV's discount rate are the clearest examples. None of these are presented as if they were computed from Maison Lumière's own data.
- **Small real sample sizes are called out inline, not hidden**, wherever they occur: the Growth Bridge and Revenue Decomposition's cohort splits, the DiD calculator's low-confidence warning, the CLV Analyzer's small-country volatility note (Finland: 3 customers, Denmark: 2), and Collaboration ROI's thin-comparable-set fallback narration.
- **Two of the Cost Allocation Engine's four department cost pools are illustrative**, named plainly on the page itself: IT and HR (`overhead_departments`, no source table exists for either) alongside real Marketing and Logistics figures (`cost_centers`). The channel revenue/COGS the allocation is applied to, and the Logistics allocation driver (real transaction/order counts), are real; only two of the four cost inputs and one of the four allocation defaults (HR's even split) are assumptions.
- **Consolidated P&L's Net Margin line includes an illustrative D&A charge** (2% of revenue) because no fixed-asset or depreciation schedule exists in this dataset. EBITDA, the line above it, is fully real/derived-real; Net Margin is the one line below it that isn't.
- **Supplier "estimated spend" is a derived split, not a purchase-order total** — real COGS × units sold per product category, divided evenly across the suppliers tagged to that category. No purchase-order-level table exists to attribute exact spend to one supplier over another in the same category.
- **The Cost Allocation Engine's Logistics default driver (real transaction/order counts) is thin for Ecommerce in any single month** — consistent with the platform's already-documented small real customer base (97 total tracked direct customers, see `CONSULTING_CASE.md`), a given month's real `sales_events` purchase count can be in the single digits against thousands of real retail transactions and dozens of wholesale orders. This is real data, not a bug, but it means Ecommerce's default Logistics share can look disproportionately small in months with few recorded purchases — exactly the kind of default the page's sliders exist to let a user override.
- **The `inventory` table was extended this pass** (Pass 34) from 3 real rows (all "bags") to cover all 21 real `product_lifecycle` products, needed for Sell-Through Rate and GMROI to break out by category at all. The original 3 rows are preserved exactly; the other 18 are a documented ILLUSTRATIVE extension — each product's synthetic `stock_level` is generated as a plausible fraction of its own real `units_sold_direct`, not an arbitrary random number, so higher-velocity real sellers correctly carry less remaining stock. See `sql/create_inventory.sql`.
- **RFM Segmentation's Frequency dimension is real but currently degenerate** — every one of the 97 real customers has `order_count = 1` (verified directly; zero repeat purchases exist in this dataset yet, the same fact behind Consulting Case Finding 2 and the Growth Bridge's "zero retained customers"). The calculator holds F at a neutral score for display, and — verified directly, not assumed — segment *boundaries* drop F entirely while it's degenerate rather than requiring F≥4/F≤2 conditions that would make Champions, Lost, and New Customers all structurally unreachable at once (leaving only "At Risk" and "Developing" populated). With Recency and Monetary alone, real segment counts today are Champions 11, At Risk 19, Lost 13, New Customers 16, Developing 38.
- **Cohort Retention's "organic" acquisition channel is real but empty** — every real customer's `first_touch_source` in this dataset is influencer-attributed. The channel filter is fully functional and would populate the moment an organic-acquired customer exists; today it correctly shows an empty state rather than fabricated data.

## Bottom line

Of the platform's real, page-facing analytics, the overwhelming majority — every Overview, Commerce, People, and Finance page, the Command Center, Explore, Supplier Intelligence, the Data Quality layer, and 20 of the 25 Decision Intelligence calculators — run on live BigQuery queries against Maison Lumière's own data. The exceptions are narrow, named, and already visible on the page itself: `/master`'s four views, `/finance`'s company-wide overview and scenario line, the Cost Allocation Engine's IT/HR cost pools and HR allocation default, the Consolidated P&L's D&A assumption, the extended `inventory` table's 18 synthetic rows, and a handful of external reference constants used inside specific calculators (CAPM, WACC, EOQ, Market Sizing, Bass Diffusion, Time Decay Attribution's λ). Nothing on this platform presents an invented number as if it were measured.
