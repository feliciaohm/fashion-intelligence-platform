# Fashion Intelligence Platform — Site Structure

A page-by-page map of all 33 Document-style pages (31 nav pages plus the `/products/[slug]` and `/influencer/[slug]` dynamic detail routes), read directly from source. Three modules — Consolidated P&L, Supplier Intelligence, and Cost Allocation Engine — were added in a later pass to complete a SAP CO/FI-equivalent layer; a further pass added a foundational Data Quality layer (`/data-quality` plus a `DataQualityIndicator` footnote rolled out across key pages/calculators) and five more Decision Intelligence calculators (RFM Segmentation, Cohort Retention Curves, Time Decay Attribution, Sell-Through Rate, GMROI). All of it is noted inline below and follows the same Document-style spec as everything else. Organized by the sections in the left sidebar (`components/Nav.tsx`). Every page shares the same persistent shell: an authentication gate (`proxy.ts`), a left sidebar (`Nav`) with the wordmark, a "Viewing as {role} · Switch" control, the Command Center link, then six grouped sections; the shared Document-style report structure (`components/DocLayout.tsx` — header/KPI-strip/insight-box/footer); and a `PrintButton`/`ExportCsvButton`/`CopyInsightButton` pattern reused across most data pages (noted per-page below).

Two dynamic detail routes exist off the main nav (`/products/[slug]`, `/influencer/[slug]`) — included under their parent section.

---

## Global / Persistent Elements

- **Authentication gate (`proxy.ts`, every request):** Next.js 16's middleware-equivalent (renamed from `middleware.ts` to `proxy.ts`, exporting `proxy` instead of `middleware`). Refreshes the Supabase session; redirects any unauthenticated page request to `/login` (returns 401 JSON for `/api/*`); if the account has a verified TOTP factor but the session is only AAL1, redirects to `/login/verify` before letting the request through anywhere else; bounces already-authenticated users away from `/login`/`/login/verify`. `/login` and `/auth/callback` are the only public paths.
- **Sign-in (`/login`):** Google OAuth button (primary) plus an email/password sign-in/sign-up toggle form. Exempt from the Document-style spec, like the role picker — it's an entry gate, not a report page.
- **Second factor (`/login/verify`):** real TOTP challenge, reached only when a verified factor exists and the session hasn't cleared AAL2 yet. 2FA itself is enrolled from `/settings` (`components/TotpSettings.tsx` — QR code + authenticator app).
- **Sidebar (`Nav`, all pages):** wordmark → `/`; role indicator + "Switch" button (clears role, returns to `/`); a visually distinct "Intelligence · Command Center" link; six labeled sections (Overview, Commerce, People, Finance, Intelligence, Platform) each listing its pages.
- **Role gate:** the entire app is wrapped by a role check, now backed by a `profiles` table (Supabase, Row Level Security scoped to one row per user) instead of `localStorage`. First visit (no stored role) always renders the role picker at `/`, regardless of what URL was requested. Once a role is set, `/` renders that role's personalized, Document-style home (`components/RoleHome.tsx`) instead of the picker.
- **Document-style report shell (`components/DocLayout.tsx`, all 32 pages + role home):** category-label header line, page title, a one-sentence live insight computed from real data, a thin rule, a 3-item `KpiStrip` (label / large monospace value / delta, hairline-separated, no card borders), page-specific main content, a `DocInsightBox` (thin gold left border, italic, single most important finding) directly before the footer, and a `DocFooterNote` ("Data sourced from BigQuery · Last updated: [timestamp]").
- **Empty states (`components/EmptyState.tsx`):** any page where a real filter, search, or lookup can legitimately return zero rows — Products, Influencers, Influencer detail, Product detail, Command Center, Explore, Supplier Intelligence's Risk Alerts — shows a centered category-label-style message with a one-line reason and a suggested action instead of a blank table or generic error.
- **Reused components:** `ExportCsvButton` (CSV download, present on nearly every data table), `PrintButton` (triggers `window.print()`, present on report-style pages only — Executive Summary, Command Center, Finance Deep-Dive, Variance Report, Forecast, Pricing, Growth Bridge), `CopyInsightButton` (clipboard-formats one finding as a board-ready sentence — Executive Summary, Variance Report, Value Driver Tree, Growth Bridge, Benchmark Intelligence, and 6 of the 20 Decision Intelligence calculators), `RelatedPages` (footer navigation — see Cross-Page Connection Summary below, now present on nearly every page, not just 4).
- **Data convention:** every page fetches from its own `/api/*` route on the server (or client, for `"use client"` pages) directly against BigQuery — no page reads another page's fetched data; shared numbers (e.g. total revenue, churn rate) are consistent because the underlying tables are, not because of shared state. Every metric's real/derived/illustrative status is catalogued in **[DATA_AUDIT.md](DATA_AUDIT.md)**.

---

## Entry Point (outside the sidebar sections)

### Role Gate / Home — `/`
**Purpose:** first-visit role picker, then a personalized, Document-style homepage for the chosen role. Only reachable once signed in — an unauthenticated request lands on `/login` first.
**Data shown:** if no role is stored — 7 role cards (CEO, CFO, CMO, Head of Retail, Head of Wholesale, Finance Intern, Marketing Manager), each with a one-line tagline (`RoleSelector`, not detailed further here as it has no other content). If a role is stored — a Document-style header (category label "Overview · {role} Home", live headline naming the top campaign by revenue), a 3-item KPI strip (Revenue Attributed, Return Rate, Campaigns Tracked, each with a real cohort-split delta vs. earlier campaigns), that role's 4–8 module cards, a collapsed `<details>` "View the full platform (27 pages)" listing every page grouped by section, then a `DocInsightBox` (top campaign by return rate, if distinct from the headline) and footer timestamp.
**Interactive elements:** 7 role-selection cards (first visit only); "Switch role" button; module cards (link out); collapsible full-directory disclosure.
**Connects to:** every page in the platform, indirectly, via the role's module cards and the full-directory disclosure. This is the hub every other page's "home" link returns to.

### Command Center — `/intelligence`
**Purpose:** search or drag any real value (influencer, product, country, channel, department, quarter) into a filter zone and see matching rows pulled live from 8 modules at once.
**Data shown:** live distinct values per dimension (`/api/intelligence/dimensions`) rendered as a clickable/draggable "Filter Palette"; on ≥1 active filter, live filtered result tables from up to 8 sources (Influencer Campaigns, Products, Finance by Channel, Cost Centers, Customers, Store Performance, Wholesale Orders, Returns), each only appearing if it has a matching column.
**Interactive elements:** free-text search box with autocomplete suggestions; drag-and-drop filter chips (HTML5 drag/drop) into a drop zone, or click-to-toggle; multi-select filter chips with AND (across dimensions) / OR (within a dimension) semantics; "Clear all"; falls back to a natural-language AI query (`/api/ai-query`, Claude, grounded in real data) when the typed text doesn't match a known value; per-result-table CSV export; Print button.
**Connects to:** footer `RelatedPages` panel pointing to the primary single-topic pages it draws from (Influencers, Products, Finance Deep-Dive, Stores, Wholesale); no in-content outbound links otherwise — it's a query surface over the same 8 modules that have their own dedicated pages elsewhere.

---

## Overview

### Executive Summary — `/executive`
**Purpose:** the daily morning briefing — one page a CEO/CFO opens first.
**Data shown:** a Quick Metrics Panel (6 numbers: Total Revenue, Revenue Growth MoM, Gross Margin, Customer Count, CAC, CLV:CAC Ratio, each with a green/amber/red dot against a real benchmark); a rule-based or AI-generated "Insight" sentence; a "What needs attention" list (top 3 of up to 9 real rule-based findings: cost overspend, low-ROI campaigns, declining stores, high churn, low CLV:CAC); an embedded Weekly Digest (auto-generated plain-text summary); a 4-stat grid (Revenue, Revenue vs. Budget, Products Below Margin Threshold, High Churn Risk Customers); Top Product / Top Influencer / Biggest Cost Overspend / Revenue-by-Channel panels.
**Interactive elements:** "Copy insight" button (top insight); "Copy to Clipboard" on the Weekly Digest; Print button; 4 outbound links.
**Connects to:** Product Lifecycle (`/product-lifecycle`), Influencer ROI (`/roi`), Monthly Variance Report (`/variance-report`), Finance Deep-Dive (`/finance-deep`).

### Dashboard — `/dashboard`
**Purpose:** the original core feature — post → visitor → return → purchase, the platform's founding question.
**Data shown:** a natural-language search box; a 4-stat journey summary (First Visitors 48h, Return Visitors, Return Rate, Revenue Attributed); a full per-campaign journey table (influencer, product, post date, first visitors, return visitors, return rate, purchases, revenue, ROI%); a "Company Snapshot" stat row (Products, Countries, Total Product Revenue, "AI Insights: Ready"); a revenue-over-time chart, a product bar chart, and a country bar chart.
**Interactive elements:** `SearchBar` — free-text question box + 3 example-question pills, calls the same grounded AI query endpoint as the Command Center; CSV export on the journey table.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Influencer ROI — `/roi`
**Purpose:** every campaign's return on gifted product, ranked.
**Data shown:** 4-stat header (Total Revenue, Total Gifted Cost, Average ROI, Campaigns); full campaign table (influencer, product, post date, gifted cost, purchases, revenue, ROI%), sorted by ROI.
**Interactive elements:** CSV export; influencer name links out.
**Connects to:** Influencer detail (`/influencer/[slug]`), one per row.

---

## Commerce

### Products — `/products`
**Purpose:** full product catalogue with retail, ecommerce, and influencer performance joined.
**Data shown:** a `ProductsTable` component (catalogue rows — not read in full here beyond the page shell) filterable by market.
**Interactive elements:** a `<select>` market filter + "Filter" submit button (server-side `?country=` query param) + "Clear" link.
**Connects to:** Product detail (`/products/[slug]`), presumably one per row inside `ProductsTable`.

### Product detail — `/products/[slug]`
**Purpose:** true single-SKU P&L and influencer-attribution view.
**Data shown:** 4-stat header (Retail Revenue, Ecommerce Revenue, Gross Margin, Influencer ROI); a "Details" panel (category, color, material, collection, price, stock); an "Influencer Attribution" panel (influencer name, platform, content type, country, revenue, purchases).
**Interactive elements:** none (read-only detail page).
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links; reached from Products and, indirectly, anywhere `ProductsTable` links out.

### Product Lifecycle — `/product-lifecycle`
**Purpose:** cost vs. wholesale vs. retail price and the resulting margin at every stage, by season.
**Data shown:** 4-stat header (Products Tracked, Avg. Retail Margin, Avg. Wholesale Margin, Direct-Channel Revenue); a "By Season" revenue/units table; a full "Best Sellers" table (product, category, season, cost, wholesale, retail, both margins, units sold, revenue).
**Interactive elements:** 2 separate CSV exports (by-season, full table).
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links; linked from Executive Summary's "Top Performing Product."

### Pricing Intelligence — `/pricing`
**Purpose:** margin at every price point, flagging products below a retail-margin threshold.
**Data shown:** 4-stat header (Products Tracked, Avg. Retail Margin, count Below Threshold, the threshold itself); a flagged-products badge list (only if any exist); a full pricing table with recent-month revenue trend columns per product.
**Interactive elements:** CSV export; Print button.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Store Performance — `/stores`
**Purpose:** revenue, staff cost, rent, and conversion by store and city.
**Data shown:** 4-stat header (Total Retail Revenue, Total Staff Cost, Total Rent, Avg. Conversion Rate); a "By Store" summary table (revenue, staff cost, rent, contribution, avg. conversion) sorted by revenue; a full "Monthly Detail" table (per store per month: revenue, footfall, transactions, conversion, avg. transaction value).
**Interactive elements:** 2 CSV exports.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Wholesale Intelligence — `/wholesale`
**Purpose:** orders and reorder patterns per wholesale partner.
**Data shown:** 4-stat header (Wholesale Revenue, Total Orders, Reorders, Reorder Rate); "By Retailer" table; "Top Products by Wholesale Revenue" table (top 10); "Order Detail" table (most recent 30 of the full order set, with a note that export downloads all).
**Interactive elements:** 3 CSV exports.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Supplier Intelligence — `/suppliers` *(added — SAP CO/FI layer)*
**Purpose:** procurement scorecard and risk monitoring for the 9 suppliers behind Maison Lumière's leather goods, knitwear, accessories, and outerwear categories; feeds real lead-time data into the Decision Intelligence EOQ calculator.
**Data shown:** 3-stat header (Total Suppliers, Suppliers At Risk, Avg. On-Time Delivery); a Risk Alerts table (any supplier with on-time delivery below 85% or lead time over 60 days, with the specific reason) or an `EmptyState` if none are flagged; a full Supplier Scorecard table (country, category, lead time, on-time delivery %, cost/unit, MOQ, payment terms, estimated annual spend).
**Interactive elements:** CSV export on the scorecard table.
**Connects to:** footer `RelatedPages` panel → `/decision-intelligence`, `/product-lifecycle`, `/wholesale`. Also linked from `/product-lifecycle`, `/wholesale`, and `/decision-intelligence`'s own footers.

---

## People

### Influencers — `/influencers`
**Purpose:** aggregated per-influencer campaign performance.
**Data shown:** a full table (influencer, campaign count, products, platforms, gifted cost, purchases, revenue, avg ROI%), filterable by market.
**Interactive elements:** market `<select>` + "Filter"/"Clear"; CSV export; influencer name links out.
**Connects to:** Influencer detail (`/influencer/[slug]`), one per row.

### Influencer detail — `/influencer/[slug]`
**Purpose:** every post from one influencer, with full journey/ROI metrics.
**Data shown:** 4-stat header (Total Revenue, Gifted Cost, Purchases, ROI%); a full posts table (product, platform, content type, country, post date, gifted cost, purchases, revenue, ROI%).
**Interactive elements:** CSV export.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links; reached from Influencers and Influencer ROI.

### Customers — `/customers`
**Purpose:** every customer, segmented by value and behavior.
**Data shown:** 4-stat header (Total Customers, VIP count, Returning count, Total LTV); a full customer table (ID, segment badge, country, first purchase date, order count, lifetime value).
**Interactive elements:** CSV export.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Customer Journey — `/customer-journey`
**Purpose:** first touch to purchase for every converting visitor, with a churn-risk heuristic and VIP segmentation.
**Data shown:** 4-stat header (Converting Customers, Avg. Days to Convert, High Churn Risk count, VIP Customers count); a full journey table (customer, first touch date/source, purchase date, days to convert, sessions, last active, churn risk, VIP segment) — churn risk and segment are color-coded text.
**Interactive elements:** CSV export.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

---

## Finance

### Consolidated P&L — `/consolidated-pnl` *(added — SAP CO/FI layer)*
**Purpose:** the CFO's single source of truth, opened every morning — the full company P&L in SAP FI style, one page.
**Data shown:** 3-stat header (Total Revenue, EBITDA, Net Margin, each with a real vs.-budget or vs.-prior-period delta); a "P&L Summary" table walking Revenue → −COGS → Gross Profit → −Operating Expenses → EBITDA → −D&A (assumed) → Net Margin, each row actual/budget/prior-period/variance; a "Revenue by Channel" table (Retail, Ecommerce, Wholesale); an "Operating Expenses by Cost Center" table; a "Management Commentary" section — 3–4 sentences auto-generated from the real actual/budget/prior-period figures above (same rule-based narrative engine as the Monthly Variance Report, not an LLM call).
**Interactive elements:** 2 CSV exports; Print button.
**Connects to:** footer `RelatedPages` panel → `/finance-deep`, `/variance-report`, `/cost-allocation`. Also linked from Finance Deep-Dive's, the Variance Report's, and `/finance`'s own footers.

### Finance — `/finance`
**Purpose:** live product-level P&L and budget variance (the platform's original, sparser finance view).
**Data shown:** a real product P&L table (2 products, one period — explicitly labeled sparse-but-real, not a bug); an explicitly-labeled **illustrative/mock** company-wide overview (Revenue, Gross Margin, Net Margin, Budget vs. Actual); a static "Marketing Spend +20%" scenario line.
**Interactive elements:** CSV export on the product P&L table only.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links. (Superseded in depth by Finance Deep-Dive, but not removed — both exist.)

### Finance Deep-Dive — `/finance-deep`
**Purpose:** channel-level P&L, forecast vs. actual, and the true-margin waterfall.
**Data shown:** 4-stat header (Total Revenue, Total COGS, Returns + Gifting, True Net Margin); a custom SVG/CSS "Margin Waterfall" bar chart (Revenue → −COGS → −Returns → −Gifting → True Net Margin); a "P&L by Channel" summary table; a "Quarterly Detail" table (per channel per quarter: actual, forecast, variance, COGS).
**Interactive elements:** 2 CSV exports; Print button.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links; linked from Executive Summary's channel panel.

### Monthly Variance Report — `/variance-report`
**Purpose:** budget vs. actual for every cost center and revenue channel, with a written summary.
**Data shown:** an auto-generated plain-English narrative of the month's key drivers; a Board Report Generator (on-demand); a full "Cost Centers — Budget vs. Actual" table (all months); a full "Channels — Actual vs. Forecast" table (all months).
**Interactive elements:** "Copy insight" button on the summary; "Generate Board Report" → "Copy to Clipboard" (Board Report Generator, appears only after generating); 2 CSV exports; Print button.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links; linked from Executive Summary.

### Cost Centers — `/cost-centers`
**Purpose:** monthly budget vs. actual by department, the raw FP&A working view.
**Data shown:** 3-stat header (Total Budget, Total Actual, Total Variance); a full department × month table.
**Interactive elements:** CSV export.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Cost Allocation Engine — `/cost-allocation` *(added — SAP CO/FI layer, client component)*
**Purpose:** activity-based costing — allocate shared overhead (IT, HR, Logistics, Marketing) across Retail/Ecommerce/Wholesale and see "true profitability by channel," the number most fashion brands never actually compute, live as the allocation basis changes.
**Data shown:** 3-stat header (Total Overhead Allocated, Weakest True Margin channel, Best True Margin channel); a "True Profitability by Channel" table (Revenue, Gross Profit, Gross Margin %, Allocated Overhead, True Profit, True Margin %) that recomputes live as sliders move; four department panels (Marketing, IT, Logistics, HR), each showing its real-or-labeled-illustrative cost and a driver note, with 2 sliders each (Retail %, Ecommerce %; Wholesale takes the remainder, shown as a bar, always summing to 100%).
**Interactive elements:** 2 sliders per department (8 total); "Use activity-based defaults" and "Use naive revenue-only split" reset buttons, to make the naive-vs-ABC gap this page exists to demonstrate directly comparable.
**Connects to:** footer `RelatedPages` panel → `/consolidated-pnl`, `/finance-deep`, `/value-drivers`. Also linked from Cost Centers', Consolidated P&L's, and Value Driver Tree's own footers.

### Returns — `/returns`
**Purpose:** refunds by reason, linked back to the originating campaign where traceable.
**Data shown:** 3-stat header (Total Returns, Total Refunded, Linked-to-Campaign count); a full returns table (product, reason, date, refund amount, influencer campaign or "—").
**Interactive elements:** CSV export.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

---

## Intelligence

### Decision Intelligence — `/decision-intelligence`
**Purpose:** twenty on-demand calculators covering the decisions a CEO/CMO/CFO actually has to make — the platform's largest single page.
**Data shown (per calculator, each independently run):**
1. New Store Viability Calculator — form (city, rent, staff, customer profile) → break-even timeline, Year 1–3 revenue
2. Collaboration ROI Predictor — form (name, cost, market, category) → projected revenue/halo effect
3. Price Elasticity Tool — projected unit/revenue/margin impact of a price change
4. Market Expansion Analyzer — form (country) → entry-mode recommendation
5. Monte Carlo Revenue Forecast — 10,000-simulation histogram + percentile stat grid
6. Difference-in-Differences Campaign Analyzer — form (treatment/control country, date, window) → real campaign lift
7. CLV Analyzer — customer lifetime value by channel/country/segment
8. CAC vs. CLV — per-channel ratio table with "Copy insight"
9. Churn Risk Model — per-segment churn/retention table with "Copy insight"
10. Market Sizing (TAM/SAM/SOM) — form (country, category, price) → sizing
11. NPV & Payback for Store Expansion — form (city, revenue, setup cost, opex) → NPV/payback/IRR
12. Demand Decomposition — trend-vs-pattern table + "Copy insight"
13. Brand Valuation (DCF) — form, accepts a live WACC feed from #17
14. Economic Order Quantity (EOQ) — form (category) → optimal reorder size, plus a real reorder point derived from the fastest supplier's actual lead time and on-time delivery rate (`/suppliers`)
15. Market Adoption S-Curve (Bass Diffusion) — form (country, p, q, price) → adoption curve
16. CAPM — form (risk-free rate, market return, beta) → cost of equity, feeds #17
17. WACC — form + live CAPM feed → hurdle rate, feeds #13
18. Revenue Growth Decomposition — waterfall chart (price/volume/mix) + "Copy insight"
19. Churn Prediction Model — 0–100 scored top-10-most-urgent customer list
20. CAGR & Rule of 72 — per-channel CAGR, editable Start/End/Years, doubling time, "grow at Z% to halve that"
21. RFM Segmentation *(added)* — "Run Analysis" → quintile-scores every real customer on Recency/Frequency/Monetary, a 3×3 Recency×FM segment matrix, and Champions/At Risk/Lost/New Customer/Developing counts; Frequency is real but currently degenerate (every customer has ordered exactly once), so segment boundaries use Recency and Monetary alone rather than a constant F that would make three of the four segments unreachable — stated on the page
22. Cohort Retention Curves *(added)* — acquisition-month × 30/60/90/180-day activity-retention heatmap (dark = high, light = low), filterable by acquisition channel; "organic" is real but empty today (every real customer is influencer-acquired), shown as an honest empty state
23. Time Decay Attribution *(added)* — form (decay rate λ, default 0.1) → last-touch vs. exponential-decay revenue attribution by traffic source, built from real multi-touchpoint sequences in `sales_events`
24. Sell-Through Rate *(added)* — "Run Analysis" → units sold ÷ total units available by category/season/market, categories below 70% flagged red, projected depletion date at current velocity
25. GMROI *(added)* — "Run Analysis" → gross margin ÷ average inventory value by category, benchmarked against a 3.2 "strong" / 2.0 "needs attention" luxury-industry threshold

Every calculator is laid out **form-left / result-right** (`.calc-layout` — a CSS grid, inputs in a fixed-width left column, the result panel filling the rest, collapsing to a single column under 900px), with a `calc-result-placeholder` message shown until the form is run, and a collapsible "Methodology" disclosure below the result explaining its formula and named assumptions.
**Interactive elements:** ~15 of the 25 are form-driven (text/number/select inputs + Calculate/Run buttons); the rest auto-run on a "Run Analysis" click against real data with no inputs; CAPM→WACC→DCF are live-wired (CAPM's output prefills WACC, WACC's output prefills the DCF discount rate); 6 calculators have a "Copy insight" button; all 5 newest calculators carry a `DataQualityIndicator` footnote.
**Connects to:** footer `RelatedPages` panel (now including `/data-quality`); no other in-content outbound links; shares `countries` dropdown data with several forms via `/api/intelligence/dimensions`.

### Value Driver Tree — `/value-drivers`
**Purpose:** how every real number rolls up into total revenue, visually, plus which lever moves the business most.
**Data shown:** an indented tree (Total Revenue → Retail / Online / Wholesale → for Online: Sessions × Conversion Rate × AOV, with a further "Sessions breaks down into" disclosure); a collapsible methodology; a Sensitivity Tornado Chart (every business lever's ±20% revenue impact, longest-bar-first, green/red split bars).
**Interactive elements:** nested `<details>` disclosures; "Copy insight" button on the tornado chart (top lever).
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Growth Bridge — `/growth-bridge`
**Purpose:** the standard consulting revenue bridge — how the brand got from last period's revenue to this period's.
**Data shown:** a 6-bar waterfall (Prior Period Revenue → Expansion → New Business → Churn Impact → Price Effect → Current Period Revenue); a real-finding callout (currently: zero retained customers, so Expansion/Price Effect are genuinely €0); a 4-stat grid (Prior/Current Period Revenue, Net Change, New/Retained/Churned customer counts); a collapsible methodology.
**Interactive elements:** "Copy insight" button; methodology disclosure. No forms — auto-loads on page visit.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Benchmark Intelligence — `/benchmarks`
**Purpose:** how the brand's key metrics compare to real, cited luxury-industry benchmarks.
**Data shown:** 5 comparison panels (Influencer ROI, Gross Margin, Customer Retention Rate, CAC:CLV Ratio, Return Rate), each with the platform's real value, a 3-bar chart (platform / industry average / best-in-class), a real-data methodology line, a caveat/note line, and a cited source with link.
**Interactive elements:** "Copy insight" button per panel (5 total).
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); also referenced by name from Consulting Summary and Executive-adjacent copy.

### Consulting Summary — `/consulting-summary`
**Purpose:** the platform's three most important findings, compiled live into a structured consulting deliverable.
**Data shown:** Executive Summary (2–3 sentences); Key Findings (3, numbered); Strategic Implications (3, numbered); Recommended Actions (3, prioritized, each with an "Expected impact" line) — all recomputed from real data on every page load.
**Interactive elements:** "Copy Full Summary" button (clipboard, formats the whole page as plain text).
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Scenario Modeling — `/scenario`
**Purpose:** interactive gifting-budget simulator plus a full sensitivity table.
**Data shown:** a live-updating projection (historical vs. projected gifted cost/revenue/ROI/net new profit) driven by a slider; a "top ROI influencers" ranked table (where incremental budget should go); a separate Sensitivity Analysis panel — a McKinsey-style table of every lever × ±10%/±20%, selectable target metric (Revenue / Gross Margin / Net Margin).
**Interactive elements:** a range slider (−50% to +100% gifting budget change, live re-fetch on change); a target-metric `<select>` for the sensitivity table; CSV export on the top-influencers table; methodology disclosure.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Forecast — `/forecast`
**Purpose:** next quarter's revenue by channel, projected from real trend, conservative/base/optimistic.
**Data shown:** an explicit caveat that this is trend extrapolation, not a demand model; a company-wide 3-month stat grid + table (conservative/base/optimistic per month); per-channel sections each with its trailing growth rate and its own 3-scenario table.
**Interactive elements:** CSV export (company-wide + one per channel); Print button.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Explore — `/explore`
**Purpose:** a self-serve pivot builder — pick a source, a dimension, a measure, get a live cross-tab.
**Data shown:** on "Run," a grouped sum table (dimension value, summed measure, row count) for the chosen combination.
**Interactive elements:** 3 chained `<select>` dropdowns (Data Source → Row Dimension → Measure, options change with source: Influencer Campaigns / Products / Customers / Cost Centers / Returns); "Run" button; CSV export on results.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

### Master Views — `/master`
**Purpose:** the four cross-functional views that sit "above" the raw tables (a demo implementation of a target BigQuery view design documented in `sql/schema.sql`).
**Data shown:** four full tables — Product Performance Master (Shopify revenue, retail revenue, inventory, influencer spend), Influencer ROI Master (gifted cost, purchases, attributed revenue, avg customer LTV, ROI%), Market Performance Master (country, region, retail/Shopify revenue), Financial Health Master (period, revenue, gross margin, opex, store costs, net margin, budget margin).
**Interactive elements:** 4 CSV exports.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

---

## Platform

### Data Quality — `/data-quality` *(added — foundation layer)*
**Purpose:** the one page every calculation on this platform is answerable to — real duplicate detection, null handling, outlier review, and normalization, run live on every load.
**Data shown:** 3-stat header (Duplicate Records, Outliers Flagged, Records Normalized); a duplicate-detection table (shopify_orders/sales_events/influencer_product_performance, real composite keys, real counts — 0 found today); a null-handling section (campaigns with unknown gifted cost, shown separately and excluded from blended ROI, an `EmptyState` today since none exist); an outlier "Review Required" table (real order-level revenue >3σ above the mean — 2 real outliers today) with an include/exclude toggle showing both totals live; a normalization log (real country-name → ISO-2 conversions, e.g. "UK" → "GB").
**Interactive elements:** the outlier include/exclude toggle recomputes the displayed total live; CSV export on the normalization log.
**Connects to:** footer `RelatedPages` panel → `/roi`, `/consolidated-pnl`, `/decision-intelligence`. A `DataQualityIndicator` footnote ("This calculation uses X data points. Y were excluded. See data quality report.") links back here from `/roi`, `/products`, `/finance-deep`, `/consolidated-pnl`, `/customers`, `/influencer/[slug]`, and all 5 newest Decision Intelligence calculators.

### Settings — `/settings`
**Purpose:** connect real data sources so the platform can run on a brand's actual data instead of the demo dataset.
**Data shown:** live connection status per integration (connected/disconnected/error), last-sync time, row counts, and any last error, for Shopify and Excel; two visually disabled "coming soon" cards (GA4, Google Sheets).
**Interactive elements:** Shopify — a connect form (shop domain, Admin API access token) when disconnected, or "Sync Now" / "Disconnect" buttons when connected; Excel — a drag-and-drop upload zone (`ExcelUploadZone`, parses any spreadsheet client-side via SheetJS and saves it live); GA4/Google Sheets — disabled "Connect" buttons only.
**Connects to:** footer `RelatedPages` panel (2–3 curated related pages); no other in-content outbound links.

---

## Cross-Page Connection Summary

*(Updated for the Document-style redesign — every page now closes with a footer `RelatedPages` panel, not just the four listed in the original pre-redesign audit below.)*

| From | Links to |
|---|---|
| `/` (Role Gate) | every page (via role modules + full directory) |
| `/executive` | `/product-lifecycle`, `/roi`, `/variance-report`, `/finance-deep` (in-content), plus its own `RelatedPages` footer |
| `/roi` | `/influencer/[slug]` (per row) |
| `/products` | `/products/[slug]` (per row, inside `ProductsTable`) |
| `/influencers` | `/influencer/[slug]` (per row) |
| All other 28 of 33 Document-style pages | a footer `RelatedPages` panel pointing to 2–4 related pages, curated per page (e.g. `/influencer/[slug]` → `/influencers`, `/roi`, `/scenario`) |

**Structural observation, current state:** all 33 Document-style pages (31 nav pages + `/products/[slug]` + `/influencer/[slug]`) now close with a curated `RelatedPages` footer, so no page is a dead end reachable only via the sidebar or the browser back button — this replaces the earlier "23 islands" finding from the pre-redesign audit. The Command Center (`/intelligence`) and Explore (`/explore`) remain the two pages designed as cross-module query surfaces rather than single-topic reports; their own `RelatedPages` footers point back to the primary single-topic pages (Influencers, Products, Finance Deep-Dive, Stores, etc.) they draw from. The 3 modules added for the SAP CO/FI layer (Consolidated P&L, Supplier Intelligence, Cost Allocation Engine) and the Data Quality layer are cross-linked into existing pages' footers, not left as an isolated new cluster.
