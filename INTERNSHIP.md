# Fashion Intelligence Platform — Cover Letter & Interview Points

Bullet points for applications and interviews, organized by audience. Each pulls from the same 30-page, role-aware platform — the framing changes to match what each audience is actually evaluating. Demonstrated throughout with a fictional luxury house, Maison Lumière (~€10.8M annual revenue, 6 flagship stores, 40 influencer campaigns, 9 suppliers, wholesale partnerships with Net-a-Porter, Mytheresa, and Browns).

---

## For LBS Analytics & Management

**The problem I identified**
- Fashion brands treat marketing, finance, retail, wholesale, and e-commerce as disconnected systems — decisions about influencer spend, store performance, and wholesale partnerships get made without measurable data on what actually happened, and every executive has to wade through the same generic dashboard to find their four numbers.

**How I built the solution**
- Designed and built a full-stack, 30-page analytics platform (Next.js, TypeScript, Google BigQuery) from scratch, independently, outside any coursework — including a role-based home screen so a CEO, CFO, and Head of Wholesale each see a different, personalized module view of the same underlying data.
- Wrote the SQL schema and cross-functional views myself — including debugging a real data-integrity bug where two incompatible product-ID schemes silently broke every join in a core view, and catching (three separate times, across different modules) a BigQuery footgun where DATE/TIMESTAMP query parameters silently insert NULL instead of erroring unless wrapped correctly.
- Built a real Shopify connector (live Admin API calls, not a simulation) and a drag-and-drop Excel importer, both managed through a `/settings` hub with connection status and manual sync — the step that turns the platform from a demo into something a brand could actually run on their own data.
- Modeled anonymous visitor identity across sessions to build a genuine "return visitor" signal — not a proxy or an assumption, an actual join on a persistent visitor ID — and extended that same event data into a full Customer Journey module (first touch to purchase, churn-risk heuristic, VIP segmentation).
- Built a twenty-calculator decision-intelligence suite covering customer economics, campaign measurement, market entry, capital budgeting, and corporate finance (CAPM, WACC, and a DCF wired together so a single market-assumption change flows through to firm value automatically), plus a McKinsey-style Value Driver Tree, Growth Bridge revenue waterfall, and sensitivity tornado chart.
- Built a Command Center that filters live across 8 different modules at once from a single search bar or drag-and-drop filter zone, with correct AND/OR semantics across and within filter categories.
- Built a margin waterfall that reconciles revenue, COGS, returns, and gifting cost across five different tables into one true net-margin figure, computed live rather than hand-calculated, and an automated Monthly Variance Report that writes its own plain-English summary of what drove the month's numbers.
- Researched and cited real public luxury-industry benchmark reports for a Benchmark Intelligence page, rather than presenting invented comparison figures — including a case where the brief's assumed numbers didn't match what real sources actually said, and I used the sourced figures instead and disclosed the gap.
- Built a Consulting Summary page that compiles the platform's own findings into a structured deliverable (executive summary, key findings, strategic implications, prioritized recommended actions) live from real data, plus a one-click "Copy insight" export on every page with a finding, formatted as a ready-to-use board sentence.
- Implemented real authentication end to end (Supabase Auth): Google OAuth, email/password, and optional TOTP two-factor authentication enforced as a genuine second factor via an Authenticator Assurance Level check on every request — not a decorative enrollment screen — plus Postgres Row Level Security so each account's data is scoped to itself at the database layer, not just the application layer.
- Wrote a full data-accuracy audit (`DATA_AUDIT.md`) covering every metric on 67 API routes, labeling each as real, derived-real, illustrative, or an external benchmark, and redesigned all 32 pages to one consistent, editorial "Document-style" report layout with designed empty states — the credibility and polish work that turns a working demo into something a brand or investor can actually trust.
- Extended the platform into an SAP CO/FI-equivalent layer following a structured SAP-modules analysis: a Consolidated P&L (revenue by channel → gross profit → opex → EBITDA → net margin, actual/budget/prior-period, with auto-generated management commentary), a Supplier Intelligence scorecard (9 suppliers, real risk alerts, real lead-time data wired into the EOQ calculator's reorder-point math instead of a placeholder assumption), and a Cost Allocation Engine (activity-based costing with live, user-adjustable sliders reallocating shared overhead across channels to reveal true profitability by channel) — three modules built to answer questions a real finance/ops function asks that a marketing-and-retail-only platform can't.

**Technical skills demonstrated**
- SQL (BigQuery Standard SQL: CTEs, window functions, procedural multi-statement scripts, view design, parameterized queries)
- Data modeling and schema design across finance, product, retail, wholesale, and marketing domains
- Full-stack software engineering (Next.js/React/TypeScript), API design, cloud infrastructure (GCP service accounts and IAM, BigQuery)
- Third-party API integration (Shopify Admin API) with real credential handling and graceful failure states
- Applied LLM integration (Claude API) with a grounded-data approach to prevent hallucinated outputs — a live, current concern in applied AI
- Authentication and access control: OAuth 2.0, session/cookie handling in a server-rendered framework, multi-factor authentication with real assurance-level enforcement, and Postgres Row Level Security policy design
- Financial and consulting-analytics modeling: DCF, CAPM, WACC, Monte Carlo simulation, difference-in-differences causal measurement, CLV/CAC, price/volume/mix and expansion/new-business/churn/price revenue decomposition, CAGR
- Applied research discipline: sourcing and citing real external benchmark data rather than presenting assumptions as fact
- Product thinking: role-based information architecture, a self-serve pivot builder, one-click CSV/PDF/insight export on every table and finding, built because a real analytics user needs to get data *out*, not just look at it

**The business insight it demonstrates**
- The ability to go from a vague business question ("is our influencer spend working?" "what's our true margin?" "how do we compare to the market?") to a precise, measurable, queryable answer — the exact translation work analytics teams are hired to do.
- Comfort holding both the technical and business sides of a problem at once: I can write the join, build the role-aware UI around it, model the DCF, source the benchmark, *and* explain why the resulting number matters to a CFO.

---

## For the Dior FP&A Internship

**The problem I identified**
- The role's own job description centers on P&L review, budget-vs-actual variance, and KPI analysis by market and category — the exact gap most junior finance candidates haven't touched before their first day.

**How I built the solution**
- Built a Consolidated P&L in SAP FI style — revenue by channel → gross profit → operating expenses by cost center → EBITDA → net margin, actual vs. budget vs. prior period on every line — the single page the role's own job description implies a CFO or FP&A analyst opens every morning, with an auto-generated Management Commentary section that writes the period's variance drivers as plain-English sentences from the real numbers, not a template.
- Built a Cost Allocation Engine applying activity-based costing to reallocate shared overhead (IT, HR, Logistics, Marketing) across Retail, Ecommerce, and Wholesale with live sliders, surfacing "true profitability by channel" — the number most FP&A teams at growing brands don't actually have, because the naive approach is to split overhead by revenue share alone regardless of what actually drives each cost.
- Built a Finance Deep-Dive module with real channel-level P&L (retail, e-commerce, wholesale — each rolled up from its own ledger, not a blended guess), quarterly forecast vs. actual, and a full margin waterfall: revenue minus COGS minus returns minus gifting cost equals true net margin, computed from real figures elsewhere in the platform, not invented for the page.
- Built a Monthly Variance Report that compares budget vs. actual for every cost center and channel and generates its own written summary of the largest overspend, the largest underspend, and the strongest and weakest channels — the exact narrative a controller writes by hand every month, automated — plus a one-click Board Report Generator that turns the same real data into board-presentation talking points.
- Built a Growth Bridge (the standard consulting revenue bridge: expansion, new business, churn, price) and a CAGR & Rule of 72 calculator pre-filled with real revenue by channel — the two calculations that appear in nearly every board deck, built from the brand's own transaction data rather than a template with placeholder numbers.
- Built a Quick Metrics Panel — the six numbers (revenue, growth rate, gross margin, customer count, CAC, CLV:CAC ratio) a finance team checks first every month, color-coded against real thresholds — and a Weekly Digest that auto-generates a copy-paste-ready email summary each time the Executive Summary loads.
- Built a Forecast module projecting next quarter's revenue by channel from real historical trend, shown as conservative/base/optimistic scenarios, with an explicit caveat about the limits of simple trend extrapolation — the kind of honesty a real FP&A model needs.
- Added a Product Lifecycle module tracking cost price, wholesale price, and retail price on the same row for every SKU, so margin is visible at every stage a product moves through — directly relevant to how a luxury house prices and reviews a collection.
- Added one-click CSV, PDF, and formatted-insight export to every table and finding in the platform specifically because an FP&A analyst's actual workflow ends in Excel, a document, or a slide sent to headquarters, not a dashboard screenshot.
- Built a CFO-specific homepage (one of seven role views) surfacing exactly Consolidated P&L, Finance Deep-Dive, the Variance Report, Cost Centers, the Cost Allocation Engine, Decision Intelligence, the Growth Bridge, Benchmark Intelligence, and Forecast on login — nothing else competing for attention.
- Was explicit, in the platform itself, about where real data was sparse or where assumptions were made — including publishing a real luxury-industry Benchmark Intelligence page sourced from public reports rather than invented comparison figures — the same discipline expected of anyone producing numbers a finance team will trust.
- Wrote a full data-accuracy audit (`DATA_AUDIT.md`) labeling every metric on every page as real, derived-real, illustrative, or an external benchmark — the same "know your number's provenance" discipline an FP&A team needs before a figure reaches a board deck.

**Technical skills demonstrated**
- Financial modeling logic in SQL and TypeScript (channel P&L structure, variance calculation, margin waterfall, trend-based forecasting, DCF/CAPM/WACC, CAGR, customer-cohort revenue bridging, activity-based costing/overhead allocation)
- SAP-style financial structuring: a Consolidated P&L walking revenue down to EBITDA and net margin the way SAP FI reporting does, and a Cost Allocation Engine modeled on SAP CO's cost-center-to-profit-center allocation logic
- Data reconciliation across systems — the practical version of what "monthly closing" and "commercial analysis" require, proven by keeping revenue and churn numbers consistent across six independent modules (Consolidated P&L, Finance Deep-Dive, Variance Report, Executive Summary, Benchmark Intelligence, Consulting Summary) that each compute from the same underlying real data via a shared, refactored calculation layer rather than duplicating logic
- Excel-adjacent skills transferable directly: pivot-style aggregation, variance analysis, budget modeling, and now a working CSV/Excel import-and-export pipeline in both directions (currently deepening formal Excel skills via Microsoft Excel Diploma coursework in parallel)

**The business insight it demonstrates**
- I understand that a P&L number is only useful if you can explain *why* it moved — I built the underlying joins, the waterfall, the growth bridge, and the automated variance narrative myself, so I know exactly where every figure comes from, not just how to read a finished report.
- Direct evidence of interest in the intersection of finance, retail, wholesale, and marketing spend accountability — precisely the "commercial analysis on sales, margin, and expenses" the role asks for.

---

## For Strategy Internships at Fashion Brands (general)

**The problem I identified**
- Brands can't answer "where should the next dollar go?" — new store, new market, new influencer, new wholesale partner, markdown or hold — without data spread across systems that don't talk to each other, and without a way to hand a CEO a different, focused view than a Head of Wholesale needs. And when they bring in outside help, the first week of any engagement is spent just building the models an analyst is trained to build from day one.

**How I built the solution**
- Built a platform answering exactly that class of question: attribution (which influencer earns its budget), store performance (which door is actually profitable once staff cost and rent are subtracted), wholesale intelligence (which partner reorders and which doesn't), and scenario modeling (what happens if we change the input) — then built a role-based layer on top so each executive sees their own slice by default.
- Built the actual consulting toolkit, not just a dashboard: a twenty-calculator Decision Intelligence suite (DCF, CAPM, WACC, Monte Carlo simulation, difference-in-differences campaign measurement, TAM/SAM/SOM, CAGR), a McKinsey-style Value Driver Tree and sensitivity tornado chart, a Growth Bridge revenue waterfall, a Cost Allocation Engine applying activity-based costing to answer the "true profitability by channel" question most brands can't, a Supplier Intelligence scorecard with real risk alerts (the supply-chain-risk lens a case team applies to any sourcing-dependent brand), a Benchmark Intelligence page sourced from real public luxury-industry reports, and a Consulting Summary page that compiles the platform's own findings into a structured deliverable — the exact output format a case team hands a client at the end of an engagement.
- Built a Command Center that lets anyone drag a market, a quarter, and a product into a filter zone and see the answer pulled live across every relevant module — the kind of cross-functional question a case interview poses, answered in seconds instead of a week of spreadsheet-stitching.
- Designed the data model myself, end to end, across retail, wholesale, product, and customer domains — the same "translate a business question into a data structure" work strategy case interviews test for, except done for real, against a real database, not a hypothetical.

**Technical skills demonstrated**
- SQL, data modeling, product analytics, scenario/what-if modeling, trend-based forecasting
- The core management-consulting and corporate-finance toolkit applied to real data: value driver trees, sensitivity analysis, revenue bridges, DCF/CAPM/WACC, CAGR, customer lifetime value and acquisition cost economics
- Structured problem decomposition — breaking "is our marketing working?" into first-touch visitors, return rate, conversion, and ROI as separate, measurable stages; breaking "is this store profitable?" into revenue, staff cost, rent, and conversion rate; breaking "how did revenue move?" into expansion, new business, churn, and price

**The business insight it demonstrates**
- Comfort with ambiguity: much of this build was investigating messy, inconsistent real data and making a judgment call about what's fixable versus what's an honest limitation — the core skill of case-based strategy work.
- Intellectual honesty under pressure to look impressive: when researched luxury-industry benchmarks didn't match the numbers I'd assumed going in, I used the real sourced figures instead and said so on the page — the same instinct a case team needs when the data doesn't support the narrative it expected.
- A genuine, demonstrated interest in fashion as a business, not just as a product category — this wasn't built for a class, it was built because the problem is real and I wanted to solve it.
