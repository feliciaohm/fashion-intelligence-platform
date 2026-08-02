# Fashion Intelligence Platform

**A unified operating system for a luxury fashion brand — influencer attribution, retail, wholesale, product lifecycle, customer journey, finance, and a full McKinsey-style consulting toolkit, all queried live from a single Google BigQuery warehouse, with real Shopify and Excel connectors so it works on a brand's own data, not just a demo.**

Built by Felicia Ohm. Demonstrated throughout with a fictional luxury house, **Maison Lumière** — six flagship stores, ~€10.8M in annual revenue, 40 influencer campaigns, and wholesale partnerships with Net-a-Porter, Mytheresa, and Browns.

---

## The Problem

Fashion brands run marketing, finance, retail, wholesale, and e-commerce as separate systems that don't talk to each other. A brand can tell you what an influencer campaign *cost*, but not what actually happened after the post went live: how many people visited, how many came back, how many bought. They can tell you a product's retail price, but not its true margin once wholesale and cost price are in the picture. They can tell you revenue, but not what's left after COGS, returns, and gifting costs are actually subtracted. And every CEO, CFO, and Head of Retail has to dig through the same generic platform to find the four numbers that actually matter to their job — or bring in a consultant to build the analysis from scratch every time.

This platform closes that gap — starting from the question that matters most: **what happens after an influencer posts?** — and grows outward until it can answer nearly every question a CEO, CMO, CFO, Head of Retail, Head of Wholesale, or an external strategy consultant would actually ask, surfaced to each of them differently.

## The Core Feature: Post → Visitor → Return → Purchase

Every gifted campaign is tracked at the visitor level, not just the aggregate level. For each post, the platform answers:

- **First visitors (48h)** — how many anonymous visitors landed on the product within 48 hours of the post
- **Return visitors** — of those, how many came back in a later session (the same anonymous visitor ID, tracked across sessions) — the strongest signal that a post created lasting interest, not just a momentary click
- **Purchases and revenue attributed** — tied precisely to the campaign via UTM-style attribution, so numbers are never guessed or double-counted across overlapping campaigns
- **Return rate and ROI** — computed live, per post

Across Maison Lumière's 40 campaigns and 16 influencers, this funnel shows real, varied results — some campaigns return over 500%, others go negative — because the numbers are computed, not curated to look good.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Data warehouse:** Google BigQuery — the single source of truth, queried live on every page load, no cached duplicate copies of the numbers
- **Authentication:** Supabase Auth (`@supabase/ssr`) gates every page and API route — Google OAuth as the primary sign-in method, email/password as a secondary method, and optional TOTP two-factor authentication enrolled from `/settings`. A verified TOTP factor is enforced as a real second factor (not decorative) via an Authenticator Assurance Level check in `proxy.ts`, Next.js 16's renamed middleware layer, on every request. Role storage moved from `localStorage` to a Postgres `profiles` table with Row Level Security, so each account can only ever read or write its own row.
- **Real integrations:** a Shopify connector (enter a store domain + Admin API token, the platform pulls real orders, products, customers, and inventory) and a drag-and-drop Excel importer (any spreadsheet is parsed in-browser and saved live) — both managed from a `/settings` hub with connection status, last-sync time, and manual sync
- **AI layer:** Anthropic Claude API, grounded in real BigQuery query results — the model is instructed to answer only from data it's been given and say so plainly if it can't. *(Built and tested end-to-end; not yet switched on in the live demo pending an account credit top-up — see note below.)*
- **Design system:** a custom white-background editorial visual system, built from scratch — near-black ink, hairline borders, a gold accent reserved for highlights and active states, tabular monospace numerics for every figure. No UI framework; every rule is hand-written. Every one of the platform's 29 pages follows one strict Document-style report layout (`components/DocLayout.tsx`): category-label header with a live one-sentence insight, a 3-item KPI strip, main content, a gold-bordered insight callout, and a footer with related-page links and a data-source timestamp.
- **Data integrity discipline:** every metric across all ~64 API routes is catalogued in `DATA_AUDIT.md` as real BigQuery data, a derived-real calculation, an illustrative/mock placeholder, or an external reference benchmark — so nothing is presented as live when it isn't. Empty states (`components/EmptyState.tsx`) replace blank tables or generic errors anywhere a real filter or search can legitimately return zero rows.
- **Data export:** every data table across the platform has a one-click CSV export, plus a Print/PDF export on every report-style page, and a one-click "Copy insight" button on every page with a key finding — formatted as a single board-ready sentence — so a CFO or FP&A user can pull any table into Excel, a PDF, or straight into a slide.
- **Infrastructure:** Google Cloud service-account auth (with write permissions correctly scoped for the app's own real-data writes, not just read access), SQL views and multi-statement scripts for cross-functional joins and internally consistent data generation, a documented target schema (`sql/schema.sql`)

## Role-Based Views

The platform opens with a one-time, single-question onboarding screen the first time a user signs in — not a role-picker page shown on every visit. Seven roles — CEO, CFO, CMO, Head of Retail, Head of Wholesale, Finance Intern, Marketing Manager — each get a personalized homepage showing only their 4-6 most relevant modules, with the full 31-page platform still one click away. The choice is stored permanently in the user's Supabase profile and can be changed anytime from Settings — never a picker screen again after the first login. A CFO opens Consolidated P&L, Finance Deep-Dive, the Monthly Variance Report, Cost Centers, and the Cost Allocation Engine; a Head of Wholesale opens Wholesale Intelligence, Product Lifecycle, Pricing Intelligence, and Supplier Intelligence — the same underlying data, surfaced differently depending on who's asking.

## The Platform — 31 Pages

**Overview**
1. **Intelligence / Command Center** (`/intelligence`) — search or drag any influencer, product, country, channel, department, or quarter into a filter zone and get live matching results pulled from all 8 underlying modules at once
2. **Executive Summary** (`/executive`) — the morning briefing: a Quick Metrics Panel of the six numbers a consultant checks first (revenue, MoM growth, gross margin, customer count, CAC, CLV:CAC ratio, each flagged green/amber/red against a real benchmark), revenue vs. budget, top product, top influencer, biggest cost overspend, and one auto-generated insight
3. **Dashboard** (`/dashboard`) — the journey funnel (post → visitor → return → purchase), company snapshot, natural-language search
4. **Influencer ROI** (`/roi`) — every campaign's return on gifted product, ranked

**Commerce & Product**
5. **Products** (`/products`) — full catalogue with retail, e-commerce, and influencer performance joined, filterable by market; each SKU also has its own detail page with a true P&L view
6. **Product Lifecycle** (`/product-lifecycle`) — cost price vs. retail price vs. wholesale price and the resulting margin at each stage, best sellers by season
7. **Pricing Intelligence** (`/pricing`) — margin at every price point, products flagged below a 50% retail-margin threshold, recent revenue trend per product
8. **Store Performance** (`/stores`) — revenue, staff cost, rent, footfall, and conversion rate per store and city, across Maison Lumière's 6 flagship doors
9. **Wholesale Intelligence** (`/wholesale`) — orders, reorder patterns, and revenue per wholesale partner (Net-a-Porter, Mytheresa, Browns)
10. **Supplier Intelligence** (`/suppliers`) — a scorecard for the 9 suppliers behind the brand's leather goods, knitwear, accessories, and outerwear: lead time, on-time delivery, cost per unit, MOQ, and payment terms, with automatic risk alerts and real lead-time data feeding straight into the EOQ calculator

**People**
11. **Influencers** (`/influencers`) — aggregated performance per influencer, filterable by market, with a detail page per influencer showing every post and its journey metrics
12. **Customers** (`/customers`) — every customer, segmented by lifetime value and behavior
13. **Customer Journey** (`/customer-journey`) — first touch to purchase for every converting visitor, with a churn-risk heuristic and VIP segmentation

**Finance**
14. **Consolidated P&L** (`/consolidated-pnl`) — the CFO's single source of truth: revenue by channel → gross profit → operating expenses by cost center → EBITDA → net margin, actual vs. budget vs. prior period, with an auto-generated Management Commentary section explaining the period's key variances
15. **Finance** (`/finance`) — live product-level P&L and budget variance
16. **Finance Deep-Dive** (`/finance-deep`) — P&L by channel (retail / e-commerce / wholesale), quarterly forecast vs. actual, and a true-margin waterfall: revenue minus COGS minus returns minus gifting cost equals true net margin
17. **Monthly Variance Report** (`/variance-report`) — budget vs. actual for every cost center and channel, every month, with an automatically generated written summary of the key drivers, plus a one-click Board Report Generator that turns the month's variance data into board-presentation talking points
18. **Cost Centers** (`/cost-centers`) — monthly budget vs. actual by department
19. **Cost Allocation Engine** (`/cost-allocation`) — activity-based costing: allocate shared IT, HR, Logistics, and Marketing overhead across Retail, Ecommerce, and Wholesale with adjustable sliders and see true profitability by channel change live — the number most fashion brands never actually compute
20. **Returns** (`/returns`) — refunds by reason, linked back to the originating campaign where traceable

**Intelligence**
21. **Decision Intelligence** (`/decision-intelligence`) — twenty-five calculators for the decisions a CEO, CMO, or CFO actually has to make: store viability, collaboration ROI, price elasticity, market expansion, Monte Carlo revenue forecasting, difference-in-differences campaign measurement, CLV, CAC:CLV, churn risk and churn prediction, TAM/SAM/SOM market sizing, store NPV/payback/IRR, demand decomposition, brand valuation (DCF), EOQ (now with a real reorder point, sourced from Supplier Intelligence's lead-time data), Bass diffusion adoption curves, CAPM, WACC (wired into the DCF automatically), price/volume/mix revenue decomposition, CAGR & Rule of 72, RFM segmentation, cohort retention curves, time-decay attribution, sell-through rate, and GMROI
22. **Value Driver Tree** (`/value-drivers`) — how every real number rolls up into total revenue and margin, visually, plus a sensitivity tornado chart ranking every business lever by impact
23. **Growth Bridge** (`/growth-bridge`) — the standard consulting revenue bridge (expansion, new business, churn, price) showing exactly how the brand got from last period's revenue to this period's, built from real customer-level purchase data
24. **Benchmark Intelligence** (`/benchmarks`) — how Maison Lumière's key metrics compare to real, publicly-sourced luxury industry benchmarks (influencer ROI, gross margin, customer retention, CAC:CLV, return rate), each with a cited source
25. **Consulting Summary** (`/consulting-summary`) — the platform's three most important findings, compiled live into a structured consulting deliverable: executive summary, key findings, strategic implications, and prioritized recommended actions, fully copyable
26. **Scenario Modeling** (`/scenario`) — interactive gifting-budget simulator, grounded in real historical ROI, plus a full one-at-a-time sensitivity table
27. **Forecast** (`/forecast`) — next quarter's revenue by channel, projected from real trend data, in conservative/base/optimistic scenarios
28. **Explore** (`/explore`) — a dropdown pivot builder: pick a data source, a dimension, a measure, get a live cross-tab
29. **Master Views** (`/master`) — the four cross-functional views (product performance, influencer ROI, market performance, financial health) that sit above the raw tables

**Platform**
30. **Settings** (`/settings`) — manage the Shopify and Excel connectors, connection status, and manual sync, plus the role-change control (the only place a role can be changed after onboarding)
31. **Data Quality** (`/data-quality`) — the foundation layer every calculation runs on: real duplicate detection, null-value handling, outlier review with an include/exclude toggle, and country/currency normalization, all run live against BigQuery

## Key Features

**A command center that searches across the whole platform** — the Intelligence page lets you drag or click any real value (an influencer, a country, a quarter) into a filter zone and see matching results pulled live from 8 different modules at once, each independently filtered by whichever tags actually apply to it. The same search bar is wired to fall back to a natural-language AI query for anything it doesn't recognize as a keyword.

**A twenty-calculator decision-intelligence suite** — the standard toolkit a strategy consultant or corporate-finance analyst would reach for, applied directly to the brand's own real data: customer economics (CLV, CAC, churn risk and prediction), campaign measurement (difference-in-differences, Monte Carlo simulation), market entry (TAM/SAM/SOM, market expansion, Bass diffusion), capital budgeting (store NPV/IRR, EOQ), corporate finance (DCF, CAPM, WACC — wired together so a single input change flows through to firm value), and growth analysis (price/volume/mix decomposition, demand-trend decomposition, and CAGR & Rule of 72). Every one of the 20 is laid out form-left / result-right, with the formula and named assumptions in a collapsible Methodology section below the result.

**A Growth Bridge and Value Driver Tree** — the two visual formats every board presentation in the world uses: a waterfall showing exactly how revenue moved from expansion, new business, churn, and price, and a tree showing how every real number rolls up into the top line, with a sensitivity tornado chart ranking every lever by impact.

**Benchmark Intelligence, sourced honestly** — the platform's own real metrics held up against real, cited luxury-industry benchmark reports, not invented numbers. Where the brand's own research didn't cleanly match a claimed figure, the platform shows the real, sourced number instead and says so.

**A Quick Metrics Panel and a Consulting Summary** — the six numbers a consultant checks in the first hour of any engagement, color-coded against real benchmarks, always visible at the top of the Executive Summary; and a single page that compiles the platform's three most important findings into a structured, board-ready consulting deliverable, refreshed live every time it loads.

**One-click Insight Export** — every page with a key finding has a "Copy insight" button that formats it as a single board-ready sentence: metric, value, percentage above or below benchmark, driver, and a recommended action — turning any analysis into a ready-to-use talking point.

**Real connectors, not just synthetic data** — a Shopify integration that makes a genuine live API call to verify a store connection and pull real orders/products/customers/inventory, and a drag-and-drop Excel importer that reads any spreadsheet in-browser and saves it live. Connect a real brand's Shopify store and the platform runs on their actual data.

**Two automated reports that write themselves** — a Weekly Digest on the Executive Summary (a copy-paste-ready email summary: revenue vs. last period, top influencer, biggest cost variance, a churn alert if above threshold, one recommended action) and a Board Report Generator on the Variance Report (turns the month's real numbers into board-presentation talking points) — both built without an AI API, purely from rule-based logic against real data.

**Role-based homepages** — seven roles, each seeing only the modules relevant to their job on login, with the full platform always a click away.

**Real authentication, not a cosmetic gate** — Google OAuth and email/password sign-in via Supabase Auth, with optional TOTP two-factor authentication that's a genuine second factor (enforced by an Authenticator Assurance Level check on every request, not just an enrollment screen), and Row Level Security so each account's role is only ever readable or writable by that account.

**A documented data-accuracy audit** — every metric across the platform's ~64 API routes is labeled real, derived-real, illustrative, or an external benchmark in `DATA_AUDIT.md`, plus designed empty states everywhere a real query can legitimately return nothing — the credibility layer that matters when showing this to a brand or an investor.

**A true-margin waterfall**, not just a revenue number — Finance Deep-Dive computes revenue minus COGS minus real returns minus real gifting cost, live, from the platform's own data, to answer the question every CFO actually asks: what's left.

**An SAP CO/FI-equivalent layer** — three modules built directly from an SAP financial-modules analysis: Consolidated P&L (`/consolidated-pnl`), the single page a CFO opens every morning, walking real revenue by channel down to net margin with auto-generated management commentary; Supplier Intelligence (`/suppliers`), a procurement scorecard with risk alerts that feeds real lead-time data into the EOQ calculator instead of a placeholder assumption; and the Cost Allocation Engine (`/cost-allocation`), an activity-based-costing tool that lets you reallocate shared overhead across channels with sliders and watch "true profitability by channel" — the number most fashion brands never compute — change live.

**A foundational Data Quality layer** (`/data-quality`) that runs before any number reaches a calculator or dashboard: real duplicate detection across three source tables, null-value handling that flags "cost unknown" campaigns instead of silently dropping or dividing by zero, statistical outlier detection (>3σ) with an include/exclude toggle that recomputes totals live, and a country-name-to-ISO normalization log. Every calculator and key data page carries a small footnote — "This calculation uses X data points. Y were excluded. See data quality report." — because a CFO doesn't trust a number without knowing what it excluded.

**Five more Decision Intelligence models**, each grounded in real data rather than built as a generic template: RFM Segmentation (quintile-scored on real Recency/Frequency/Monetary — and honest about Frequency currently being degenerate, since every real customer has purchased exactly once); Cohort Retention Curves (a real acquisition-month heatmap, right-censored so young cohorts show "not yet observable" instead of a fabricated 0%, filterable by channel); Time Decay Attribution (splits real purchase revenue across a customer's actual touchpoint history by exponential decay instead of crediting the last click alone); Sell-Through Rate (real units sold vs. available, categories under 70% flagged, with a depletion-date projection); and GMROI (real gross margin over real inventory value, benchmarked against a 3.2 luxury-industry threshold).

**A forecast built on real trend, not a guess** — next quarter's revenue by channel, projected from each channel's own historical month-over-month movement, shown as conservative/base/optimistic scenarios with an honest caveat about what simple trend extrapolation can and can't tell you.

**One-click CSV and PDF export** — every data table exports to CSV, and every report-style page has a clean Print/PDF export, so a CFO or FP&A user can get data into Excel or a document ready to send to headquarters.

**An AI query layer already built and tested** — grounded strictly in the platform's own BigQuery data, ready to activate the moment API credits are available.

## Business Value

- Turns "which influencer should we re-sign?" from a week of spreadsheet reconciliation into a live query.
- Turns "what's our true margin after returns and gifting?" from a quarterly finance exercise into a number on screen.
- Turns "how do we compare to the market?" — the question every board member and consultant asks first — into a sourced, cited comparison instead of a guess.
- Gives a CFO and a CMO the same underlying data without either of them wading through the other's irrelevant pages to find it.
- Makes gifting spend accountable to a measurable visitor-to-purchase outcome, not treated as a sunk marketing cost.
- Replaces the first week of a strategy engagement — data gathering, framework selection, model building — with a platform that already has the CLV, CAC, DCF, sensitivity analysis, and revenue bridge built and current.
- Surfaces exactly the questions a management controller, Head of Retail, or strategy team is paid to answer: where is margin being made or lost, which stores and wholesale partners are actually performing, where should the next incremental dollar go.

## What Makes It Unique

Very few people can build the actual data infrastructure — write the SQL, design the schema, wire a real Shopify integration, debug a BigQuery join, model visitor identity across sessions, build a margin waterfall that reconciles across five different tables, implement a full corporate-finance and consulting-analytics toolkit — **and** read the output the way an FP&A analyst or strategy consultant would. This platform is proof of both. It's not a mockup: real bugs were found and fixed in the underlying data model along the way — a join-key mismatch between two incompatible product-ID schemes, a BigQuery footgun where DATE and TIMESTAMP query parameters silently insert NULL unless wrapped correctly (caught and fixed three separate times across different modules), a service-account permissions gap that meant the app itself couldn't write real data until it was diagnosed and granted, a store cost-structure imbalance that left five of six stores showing a loss until the underlying assumptions were corrected, and a real luxury-industry benchmark research pass that deliberately used sourced figures over invented ones wherever they disagreed. Each is documented, not hidden.

## Why It Matters — By Audience

**For LBS Analytics & Management:** a self-directed, end-to-end data project spanning data engineering, software engineering, and business analysis — translating raw event data into the specific questions a brand's leadership team asks, across marketing, retail, wholesale, and finance, then surfacing it differently depending on who's asking, backed by a genuine twenty-model analytics toolkit and real production authentication (OAuth, password auth, 2FA, Row Level Security) rather than a demo-only login screen. Built independently, not as a course assignment.

**For the Dior FP&A Internship:** the Finance, Finance Deep-Dive, and Monthly Variance Report modules mirror what the role's job description asks for — P&L review by channel, budget-vs-actual variance with a written explanation of drivers, a full margin waterfall down to true net margin, and now a Growth Bridge and CAGR calculator, the exact revenue-movement analyses an FP&A team presents to leadership every quarter. Building it from scratch, including the CSV and PDF export CFOs and FP&A teams actually need, means arriving at the internship already fluent in *why* a variance exists, not just how to read one.

**For fashion brands (Toteme, House of Dagmar, and similar):** a direct, working answer to a problem most mid-sized brands have and few have solved — influencer spend that isn't tied to a measurable visitor-to-purchase outcome, retail and wholesale performance that live in disconnected systems, margin that isn't visible until it's too late to act on, no honest read on how the business compares to the market, and a real Shopify connector so it isn't just a demo — it can run on the brand's own store the same day.

## A Note on the Data

The dataset behind this platform is demonstrated through a fictional luxury house, **Maison Lumière** — 21 products, 40 influencer campaigns, 16 influencers, 6 flagship stores (Paris, New York, London, Milan, Stockholm, Copenhagen), 3 wholesale partners (Net-a-Porter, Mytheresa, Browns), 9 suppliers across leather goods, knitwear, accessories, and outerwear, and roughly €10.8M in annual revenue. Every number is generated to be internally consistent across every module rather than to look impressive: store revenue rolls up into the same channel P&L shown in Finance Deep-Dive, the Monthly Variance Report, and the Executive Summary; wholesale orders reference the same wholesale price used in the Product Lifecycle table; the margin waterfall reconciles against real returns and gifting figures elsewhere in the platform; the Growth Bridge and Benchmark Intelligence pages are computed from the same underlying real tables as everything else, not a separate curated dataset. The infrastructure, the SQL, the schema design, the industry-benchmark research, and the bugs found and fixed along the way are real, and the Shopify/Excel connectors work against real data the same way they work against this demo. This is a prototype built to demonstrate the *method*, ready to be pointed at a brand's actual data.

## Status Note: AI Query Layer

The natural-language search bar (Claude API, grounded in live BigQuery data) is fully built and was verified end-to-end during development — it correctly authenticates, pulls real data, and reaches the model. It's currently switched off in demos pending an Anthropic account credit top-up; activating it requires no code changes. All other automation on the platform (Weekly Digest, Board Report Generator, the rule-based Executive Summary insight engine, Consulting Summary, and Insight Export) runs without any AI API at all, by design, so the platform's core reporting never depends on external API availability.
