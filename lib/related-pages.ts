// Client-safe: reuses the same name/description copy already established in
// ALL_MODULES (lib/roles.ts) so "Related pages" cards never say something
// different than the platform directory does for the same page.
import { ALL_MODULES } from "./roles";

export const PAGE_INFO: Record<string, { name: string; desc: string }> = Object.fromEntries(
  ALL_MODULES.flatMap((g) => g.items.map((i) => [i.href, { name: i.name, desc: i.desc }]))
);

// Hand-picked per page from the real thematic/data connections documented in
// STRUCTURE.md -- not automatically derived, since "related" is a judgment
// call (shared data source, shared workflow, or natural "go deeper" step),
// not just "same nav section."
export const RELATED_PAGES: Record<string, string[]> = {
  "/intelligence": ["/explore", "/executive", "/decision-intelligence"],
  "/executive": ["/consulting-summary", "/benchmarks", "/decision-intelligence"],
  "/dashboard": ["/roi", "/customer-journey", "/intelligence"],
  "/roi": ["/influencers", "/scenario", "/decision-intelligence"],

  "/products": ["/product-lifecycle", "/pricing", "/wholesale"],
  "/product-lifecycle": ["/products", "/suppliers", "/finance-deep"],
  "/pricing": ["/product-lifecycle", "/products", "/decision-intelligence"],
  "/stores": ["/finance-deep", "/value-drivers", "/decision-intelligence"],
  "/wholesale": ["/product-lifecycle", "/suppliers", "/finance-deep"],
  "/suppliers": ["/decision-intelligence", "/product-lifecycle", "/wholesale"],

  "/influencers": ["/roi", "/scenario", "/customer-journey"],
  "/customers": ["/customer-journey", "/returns", "/decision-intelligence"],
  "/customer-journey": ["/customers", "/growth-bridge", "/decision-intelligence"],

  "/consolidated-pnl": ["/finance-deep", "/variance-report", "/cost-allocation"],
  "/finance": ["/finance-deep", "/cost-centers", "/variance-report"],
  "/finance-deep": ["/consolidated-pnl", "/variance-report", "/forecast"],
  "/variance-report": ["/consolidated-pnl", "/cost-centers", "/executive"],
  "/cost-centers": ["/variance-report", "/cost-allocation", "/finance-deep"],
  "/cost-allocation": ["/consolidated-pnl", "/finance-deep", "/value-drivers"],
  "/returns": ["/customers", "/products", "/finance-deep"],

  "/decision-intelligence": ["/suppliers", "/value-drivers", "/growth-bridge"],
  "/value-drivers": ["/decision-intelligence", "/scenario", "/growth-bridge"],
  "/growth-bridge": ["/decision-intelligence", "/value-drivers", "/customer-journey"],
  "/benchmarks": ["/consulting-summary", "/executive", "/decision-intelligence"],
  "/consulting-summary": ["/benchmarks", "/executive", "/variance-report"],
  "/scenario": ["/roi", "/forecast", "/value-drivers"],
  "/forecast": ["/scenario", "/finance-deep", "/decision-intelligence"],
  "/explore": ["/intelligence", "/master", "/decision-intelligence"],
  "/master": ["/explore", "/finance-deep", "/products"],

  "/settings": ["/intelligence", "/executive", "/dashboard"],
  "/data-quality": ["/roi", "/consolidated-pnl", "/decision-intelligence"],
};
