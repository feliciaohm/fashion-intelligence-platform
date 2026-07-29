// Client-safe: role config + Supabase-backed role storage. No server-only
// imports -- this is read by app/page.tsx and components/Nav.tsx, both
// client components. Role preference is stored in Supabase's `profiles`
// table (one row per user, id = auth.users.id), not localStorage -- so it
// follows the signed-in user across devices/browsers instead of resetting.
import { createClient } from "@/lib/supabase/client";

export type RoleId =
  | "ceo"
  | "cfo"
  | "cmo"
  | "head_of_retail"
  | "head_of_wholesale"
  | "finance_intern"
  | "marketing_manager";

export interface RoleModule {
  href: string;
  name: string;
  desc: string;
}

export interface RoleConfig {
  id: RoleId;
  label: string;
  tagline: string;
  modules: RoleModule[];
}

// Every module maps to a real existing page -- no new pages were built for
// this feature. Where Felicia's brief named something without a 1:1 page
// (e.g. CFO's "Margin Waterfall," Marketing Manager's "Social," Finance
// Intern's "Monthly close data"), it's mapped to the closest real capability
// and the description says so plainly rather than implying a page that
// doesn't exist.
export const ROLES: RoleConfig[] = [
  {
    id: "ceo",
    label: "CEO",
    tagline: "Company-wide performance, at a glance.",
    modules: [
      { href: "/executive", name: "Executive Summary", desc: "Revenue vs. budget, top performers, and one thing that needs attention." },
      { href: "/consolidated-pnl", name: "Consolidated P&L", desc: "Revenue → gross profit → opex → EBITDA → net margin, with auto-generated management commentary." },
      { href: "/intelligence", name: "Command Center", desc: "Search or filter across every module at once." },
      { href: "/decision-intelligence", name: "Decision Intelligence", desc: "Twenty calculators covering revenue forecasting, campaign analysis, CLV, CAC, churn, market sizing, store NPV, and more — the decisions that actually matter." },
      { href: "/value-drivers", name: "Value Driver Tree", desc: "How every real number rolls up into total revenue and margin, visually." },
      { href: "/growth-bridge", name: "Growth Bridge", desc: "The standard consulting revenue bridge — expansion, new business, churn, and price." },
      { href: "/benchmarks", name: "Benchmark Intelligence", desc: "How Maison Lumière compares to real, sourced luxury industry benchmarks." },
      { href: "/consulting-summary", name: "Consulting Summary", desc: "The three most important findings across the platform, compiled into a board-ready summary." },
      { href: "/forecast", name: "Forecast", desc: "Next quarter's revenue by channel — conservative, base, optimistic." },
      { href: "/dashboard", name: "Top-Line KPIs", desc: "The full post → visitor → return → purchase funnel, live." },
    ],
  },
  {
    id: "cfo",
    label: "CFO",
    tagline: "Margin, variance, and what's coming next quarter.",
    modules: [
      { href: "/consolidated-pnl", name: "Consolidated P&L", desc: "The single source of truth open every morning — revenue by channel → gross profit → opex → EBITDA → net margin, actual vs. budget vs. prior period." },
      { href: "/finance-deep", name: "Finance Deep-Dive", desc: "Channel P&L and the true-margin waterfall — revenue minus COGS, returns, and gifting." },
      { href: "/variance-report", name: "Monthly Variance Report", desc: "Budget vs. actual for every cost center and channel, with a written summary." },
      { href: "/cost-centers", name: "Cost Centers", desc: "Budget vs. actual by department, monthly." },
      { href: "/cost-allocation", name: "Cost Allocation Engine", desc: "True profitability by channel once shared overhead is allocated with activity-based costing." },
      { href: "/decision-intelligence", name: "Decision Intelligence", desc: "Twenty calculators covering revenue forecasting, campaign analysis, CLV, CAC, churn, market sizing, store NPV, and more." },
      { href: "/value-drivers", name: "Value Driver Tree", desc: "How every real number rolls up into total revenue and margin, visually." },
      { href: "/growth-bridge", name: "Growth Bridge", desc: "The standard consulting revenue bridge — expansion, new business, churn, and price." },
      { href: "/benchmarks", name: "Benchmark Intelligence", desc: "How Maison Lumière compares to real, sourced luxury industry benchmarks." },
      { href: "/consulting-summary", name: "Consulting Summary", desc: "The three most important findings across the platform, compiled into a board-ready summary." },
      { href: "/forecast", name: "Forecast", desc: "Next quarter's revenue by channel — conservative, base, optimistic." },
    ],
  },
  {
    id: "cmo",
    label: "CMO",
    tagline: "What's driving revenue, and where the next dollar should go.",
    modules: [
      { href: "/roi", name: "Influencer ROI", desc: "Campaign-level return on every gifted post." },
      { href: "/intelligence", name: "Command Center", desc: "Search or filter across every module at once." },
      { href: "/decision-intelligence", name: "Decision Intelligence", desc: "Twenty calculators covering revenue forecasting, campaign analysis, CLV, CAC, churn, market sizing, store NPV, and more — the decisions that actually matter." },
      { href: "/benchmarks", name: "Benchmark Intelligence", desc: "How Maison Lumière compares to real, sourced luxury industry benchmarks." },
      { href: "/pricing", name: "Pricing Intelligence", desc: "Margin at every price point and where it's under threshold." },
      { href: "/customer-journey", name: "Customer Journey", desc: "First touch to purchase, churn risk, VIP segmentation." },
    ],
  },
  {
    id: "head_of_retail",
    label: "Head of Retail",
    tagline: "Store performance, product, and the customers walking in.",
    modules: [
      { href: "/stores", name: "Store Performance", desc: "Revenue, staff cost, rent, and conversion by store and city." },
      { href: "/products", name: "Products", desc: "Full catalogue, retail + ecommerce + influencer performance joined." },
      { href: "/returns", name: "Returns", desc: "Refunds by reason, linked back to the originating campaign." },
      { href: "/customers", name: "Customer Segments", desc: "Every customer, segmented by value and behavior." },
    ],
  },
  {
    id: "head_of_wholesale",
    label: "Head of Wholesale",
    tagline: "Partner performance, product lifecycle, and margin by channel.",
    modules: [
      { href: "/wholesale", name: "Wholesale Intelligence", desc: "Orders and reorder patterns by wholesale partner." },
      { href: "/product-lifecycle", name: "Product Lifecycle", desc: "Cost, retail, and wholesale price by product — true margin, by season." },
      { href: "/pricing", name: "Pricing Intelligence", desc: "Margin at every price point and where it's under threshold." },
      { href: "/suppliers", name: "Supplier Intelligence", desc: "Scorecard, risk alerts, and spend per supplier." },
    ],
  },
  {
    id: "finance_intern",
    label: "Finance Intern",
    tagline: "The monthly close — variance, cost centers, and P&L.",
    modules: [
      { href: "/consolidated-pnl", name: "Consolidated P&L", desc: "Revenue → gross profit → opex → EBITDA → net margin, with auto-generated management commentary." },
      { href: "/variance-report", name: "Monthly Variance Report", desc: "Budget vs. actual for every cost center and channel, with a written summary." },
      { href: "/cost-centers", name: "Cost Centers", desc: "Budget vs. actual by department, monthly." },
      { href: "/cost-allocation", name: "Cost Allocation Engine", desc: "True profitability by channel once shared overhead is allocated." },
      { href: "/finance-deep", name: "Finance Deep-Dive", desc: "Channel P&L and the true-margin waterfall." },
      { href: "/finance", name: "Monthly Close Data", desc: "Product-level P&L and budget variance, sourced live." },
    ],
  },
  {
    id: "marketing_manager",
    label: "Marketing Manager",
    tagline: "Campaign performance and marketing spend, budget to actual.",
    modules: [
      { href: "/roi", name: "Influencer ROI", desc: "Campaign-level return on every gifted post." },
      { href: "/dashboard", name: "Campaign Performance", desc: "The full post → visitor → return → purchase funnel, live." },
      { href: "/customer-journey", name: "Customer Journey", desc: "First touch to purchase — including social/organic attribution." },
      { href: "/cost-centers", name: "Marketing Budget vs. Actual", desc: "Marketing department spend vs. plan, monthly." },
    ],
  },
];

// The full platform directory (all 30 pages), grouped -- shown de-emphasized
// below each role's personalized module set, so the whole platform stays one
// click away without competing with the 4-5 modules that matter to this role.
export const ALL_MODULES: { group: string; items: RoleModule[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/intelligence", name: "Intelligence", desc: "The command center — search or drag any filter to pull live results across every module." },
      { href: "/executive", name: "Executive Summary", desc: "The morning briefing — revenue vs. budget, top performers, one insight." },
      { href: "/dashboard", name: "Dashboard", desc: "The full post → visitor → return → purchase funnel, live." },
      { href: "/roi", name: "Influencer ROI", desc: "Campaign-level return on every gifted post." },
    ],
  },
  {
    group: "Commerce & Product",
    items: [
      { href: "/products", name: "Products", desc: "Full catalogue, retail + ecommerce + influencer performance joined." },
      { href: "/product-lifecycle", name: "Product Lifecycle", desc: "Cost, retail, and wholesale price by product — true margin, by season." },
      { href: "/pricing", name: "Pricing Intelligence", desc: "Margin at every price point, flagged below-threshold products, price trend over time." },
      { href: "/stores", name: "Store Performance", desc: "Revenue, staff cost, rent, and conversion by store and city." },
      { href: "/wholesale", name: "Wholesale Intelligence", desc: "Orders and reorder patterns by wholesale partner." },
      { href: "/suppliers", name: "Supplier Intelligence", desc: "Scorecard, risk alerts, and spend per supplier — lead time and on-time delivery feed the EOQ calculator." },
    ],
  },
  {
    group: "People",
    items: [
      { href: "/influencers", name: "Influencers", desc: "Aggregated performance per influencer, filterable by market." },
      { href: "/customers", name: "Customers", desc: "Every customer, segmented by value and behavior." },
      { href: "/customer-journey", name: "Customer Journey", desc: "First touch to purchase, churn risk, VIP analysis." },
    ],
  },
  {
    group: "Finance",
    items: [
      { href: "/consolidated-pnl", name: "Consolidated P&L", desc: "Revenue by channel → gross profit → opex → EBITDA → net margin, actual vs. budget vs. prior period, with auto-generated management commentary." },
      { href: "/finance", name: "Finance", desc: "Live product-level P&L and budget variance." },
      { href: "/finance-deep", name: "Finance Deep-Dive", desc: "Channel P&L, quarterly forecast, and the true-margin waterfall." },
      { href: "/variance-report", name: "Monthly Variance Report", desc: "Budget vs. actual for every cost center and channel, with a written summary." },
      { href: "/cost-centers", name: "Cost Centers", desc: "Budget vs. actual by department, monthly." },
      { href: "/cost-allocation", name: "Cost Allocation Engine", desc: "Allocate shared overhead across channels with adjustable activity-based-costing drivers — true profitability by channel." },
      { href: "/returns", name: "Returns", desc: "Refunds by reason, linked back to the originating campaign." },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/decision-intelligence", name: "Decision Intelligence", desc: "Twenty calculators covering revenue forecasting, campaign analysis, CLV, CAC, churn, market sizing, store NPV, and more — the decisions that actually matter." },
      { href: "/value-drivers", name: "Value Driver Tree", desc: "How every real number rolls up into total revenue and margin, visually." },
      { href: "/growth-bridge", name: "Growth Bridge", desc: "The standard consulting revenue bridge — expansion, new business, churn, and price, real customer-level data." },
      { href: "/benchmarks", name: "Benchmark Intelligence", desc: "How Maison Lumière's key metrics compare to real, sourced luxury industry benchmarks." },
      { href: "/consulting-summary", name: "Consulting Summary", desc: "The three most important findings across the platform, compiled into a structured consulting deliverable." },
      { href: "/scenario", name: "Scenario Modeling", desc: "Project the return on a gifting budget change before you spend it — now with a full sensitivity analysis." },
      { href: "/forecast", name: "Forecast", desc: "Next quarter's revenue by channel — conservative, base, and optimistic." },
      { href: "/explore", name: "Explore", desc: "Build your own cross-tab: pick a source, a dimension, a measure." },
      { href: "/master", name: "Master Views", desc: "The cross-functional views that sit above the raw tables." },
    ],
  },
  {
    group: "Platform",
    items: [{ href: "/settings", name: "Settings", desc: "Connect real data sources — Shopify, Excel, and more." }],
  },
];

export const ROLE_CHANGE_EVENT = "fip-role-change";

export async function getStoredRole(): Promise<RoleId | null> {
  if (typeof window === "undefined") return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const value = data?.role;
  return (ROLES.some((r) => r.id === value) ? value : null) as RoleId | null;
}

export async function setStoredRole(id: RoleId | null): Promise<void> {
  if (typeof window === "undefined") return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ role: id }).eq("id", user.id);
  }
  window.dispatchEvent(new Event(ROLE_CHANGE_EVENT));
}
