# Fashion Intelligence Platform

A single, real-data analytics platform for a fashion brand — built around a fictional luxury house, **Maison Lumière**, as a working demonstration of what this kind of system looks like for a real company. Every page sits behind real authentication and follows one consistent, editorial report layout, not a generic dashboard template.

## What problem this solves

A growing fashion brand's data usually lives in five different places: a POS system for stores, Shopify or GA4 for ecommerce, spreadsheets for influencer campaigns, a wholesale partner's own reporting, and Excel for finance. No one person — not the CEO, not the CFO, not the marketing team — can see the whole picture in one place, and building that picture by hand every month eats hours that should go to actually running the business.

This platform pulls all of it into one system, built directly on real transactional data (no fabricated numbers — every figure is either computed live from the data or clearly labeled as an assumption where real data doesn't exist), and adds the analytical tools a management consultant, a corporate finance team, or a data science team would normally have to build separately: revenue forecasting, customer economics, campaign measurement, market sizing, and company valuation, all working from the same real numbers.

## Who it's for

Seven role-based views — CEO, CFO, CMO, Head of Retail, Head of Wholesale, Finance Intern, Marketing Manager — each open to a homepage showing only the 4–6 modules that role actually needs, with the full 27-page platform always one click away. Every user signs in first; there is no anonymous access to any page or API route.

## Authentication

The entire platform sits behind real authentication (Supabase Auth), not a cosmetic login screen:

- **Google OAuth** — primary sign-in method, one click.
- **Email + password** — secondary method, with standard sign-up/confirmation.
- **Optional TOTP two-factor authentication** — enrolled from `/settings` (QR code + authenticator app). Once enrolled, it's a real second factor: `proxy.ts` (this codebase's Next.js 16 middleware-equivalent, renamed from `middleware.ts`) checks the session's Authenticator Assurance Level on every request and forces a stop at `/login/verify` if a verified TOTP factor exists but the session is only AAL1 (password/OAuth alone) — a stolen password can't produce a fully valid session on its own.
- **Row Level Security** on the `profiles` table (role storage) — every user can only ever read or write their own row, enforced by Postgres policies, not application logic.
- Unauthenticated requests to any page redirect to `/login`; unauthenticated requests to any `/api/*` route return a 401.

## Document-style layout

All 29 pages (27 nav pages plus the `/influencer/[slug]` and `/products/[slug]` detail routes) — and the role-gate home page — follow one strict report layout, built around a shared `components/DocLayout.tsx`:

- **Header** — a small uppercase category label (e.g. "Finance · Variance Analysis"), the page title, one sentence stating the key finding computed live from real BigQuery data (never hardcoded), then a thin rule.
- **KPI strip** — exactly 3 numbers per page, each with a label, a large monospace value, and a delta versus an earlier period — no card borders or shadows, just hairlines.
- **Main content** — clean tables (no zebra striping, hairline borders, sticky headers, monospace numerics), single-gold-accent charts, and calculators laid out form-left / result-right with methodology in a collapsible section.
- **Insight box** — a thin gold-left-border, italic callout stating the single most important finding on the page, placed just before the footer.
- **Footer** — a Related Pages panel plus "Data sourced from BigQuery · Last updated: [timestamp]" in small grey text.

## Empty states

Every page where a real filter, search, or lookup can legitimately return zero rows (`components/EmptyState.tsx`) shows a designed empty state instead of a blank table or a generic error — a category-label-style heading, a one-line reason, and a suggested next action (e.g. "NO RESULTS · Try removing a filter or broadening your search").

## Data accuracy

**[DATA_AUDIT.md](DATA_AUDIT.md)** documents every metric on every one of the platform's ~64 API routes: its source table, whether it's real BigQuery data, a derived-real calculation, an illustrative/mock placeholder, or an external reference benchmark, plus known limitations — the credibility record for showing this platform to a brand or an investor.

## What's inside

- **A real data foundation.** Every table (store sales, ecommerce events, influencer campaigns, wholesale orders, customer records, cost centers) is either genuine transactional data or realistic synthetic data built to be internally consistent — the same revenue figure matches everywhere it appears across the platform.
- **A Command Center** that searches or filters across every module at once.
- **A Value Driver Tree**, **Sensitivity Tornado Chart**, and **Growth Bridge** — the visual tools management consultants use to show how every number rolls up into total revenue, which levers matter most, and how you got from last period's revenue to this period's (expansion, new business, churn, price).
- **A Quick Metrics Panel** on the Executive Summary — the six numbers a consultant checks in the first hour of any engagement (revenue, growth rate, gross margin, customer count, CAC, CLV:CAC ratio), each flagged green/amber/red against a real benchmark where one exists.
- **Benchmark Intelligence** — how the brand's key metrics compare to real, sourced luxury-industry benchmarks, and an Insight Export button on every page with a finding, for one-click board-ready talking points.
- **Two one-click automations**: a Weekly Digest (a copy-paste-ready email summary for a Monday morning check-in) and a Board Report Generator (turns this month's variance data into board-presentation talking points, the kind of write-up that otherwise takes a Finance Intern a few hours every month).
- **Real integrations**: a Shopify connector and an Excel/CSV importer, so the platform can run on a real brand's actual data, not just this demo.
- **Twenty decision-support calculators** (below), each laid out form-left / result-right — the heart of the platform.

Every calculator shows its formula and its assumptions in plain language, in a collapsible Methodology section below the result. Nothing is a black box: if a number depends on an assumption rather than real data, the platform says so, right next to the number.

## The 20 calculators

1. **New Store Viability Calculator** — projects a new store's break-even timeline and Year 1–3 revenue from the brand's own existing stores, including the risk it steals sales from online.
2. **Collaboration ROI Predictor** — estimates the revenue a new influencer or brand collaboration will generate, based on how similar past campaigns actually performed.
3. **Price Elasticity Tool** — projects how a price change would move units sold, revenue, and margin, based on real historical price-and-volume data.
4. **Market Expansion Analyzer** — reads real traffic, customer, and influencer signals from a candidate country to recommend how to enter it (online, wholesale, or retail first).
5. **Monte Carlo Revenue Forecast** — runs 10,000 randomized simulations of next quarter's revenue to show a realistic range of outcomes, not just one guess.
6. **Difference-in-Differences Campaign Analyzer** — isolates a campaign's true impact from normal seasonal ups and downs, the standard method for proving a campaign actually worked.
7. **Customer Lifetime Value (CLV) Analyzer** — shows which acquisition channel, country, and customer segment produce the most valuable long-term customers.
8. **Customer Acquisition Cost (CAC) vs. CLV** — checks whether each marketing channel earns back more than it costs, and flags the ones that don't.
9. **Churn Risk Model** — measures how many customers have gone quiet in each segment, and how long they typically stay before returning.
10. **Market Sizing Tool (TAM/SAM/SOM)** — estimates the total, realistically serviceable, and realistically obtainable revenue opportunity in a new market.
11. **NPV & Payback Period for Store Expansion** — the standard capital-budgeting math (net present value, payback period, internal rate of return) for deciding whether a new store is worth funding.
12. **Demand Decomposition** — separates real revenue into its underlying growth trend versus month-to-month ups and downs, so a one-off spike doesn't get mistaken for sustainable growth.
13. **Brand Valuation (DCF)** — estimates what the whole brand is worth today, the same discounted-cash-flow math private equity firms use when pricing an acquisition.
14. **Economic Order Quantity (EOQ)** — calculates the optimal inventory reorder size and frequency to minimize ordering and holding costs.
15. **Market Adoption S-Curve (Bass Diffusion)** — projects how quickly a new market or product catches on, from early adopters through word-of-mouth growth.
16. **CAPM (Cost of Equity)** — estimates the return shareholders should expect for the risk of investing in a business like this one.
17. **WACC (Weighted Average Cost of Capital)** — blends the cost of equity and debt into the single hurdle rate any investment needs to clear to be worth doing; feeds automatically into the Brand Valuation calculator above.
18. **Revenue Growth Decomposition** — breaks revenue growth into three causes — charging more, selling more units, or selling a pricier mix of products — shown as the waterfall chart used in board presentations.
19. **Churn Prediction Model** — scores every current customer 0–100 on churn risk and lists the ten most urgent to re-engage, with a suggested next action for each.
20. **CAGR & Rule of 72** — compound annual growth rate by channel from real revenue, plus how many years until revenue doubles at that rate — the single most common calculation in a board presentation.

## Tech stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Google BigQuery** as the single source of truth for all real data
- **Supabase Auth** (`@supabase/ssr`) for authentication — Google OAuth, email/password, and TOTP 2FA, with Postgres Row Level Security
- Deployed as a standard web application — no separate backend service required

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in — every page requires a session. The platform connects to a real BigQuery dataset (see `lib/bigquery.ts` for `GCP_PROJECT_ID`, `GCP_KEYFILE_PATH`) and a Supabase project for auth (`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/publishable key only; the app never uses a service-role key).

## Further reading

- **[PORTFOLIO.md](PORTFOLIO.md)** — the platform framed for a portfolio audience
- **[INTERNSHIP.md](INTERNSHIP.md)** — framed for internship applications (LBS, Dior FP&A, general strategy)
- **[CONSULTING_CASE.md](CONSULTING_CASE.md)** — a case study showing what the platform actually found when pointed at Maison Lumière's data
- **[DATA_AUDIT.md](DATA_AUDIT.md)** — every metric on every API route: source table, real vs. illustrative, known limitations
- **[STRUCTURE.md](STRUCTURE.md)** — a full page-by-page map of the platform's layout and navigation
