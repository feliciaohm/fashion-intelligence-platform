// Client-safe: shared types for the Decision Intelligence calculators only.
// No BigQuery import here -- see the lib/intelligence.ts and lib/roles.ts
// precedents for why (this file is imported by the client page).

export interface MethodologyResponse {
  methodology: string[];
}

export interface StoreViabilityInput {
  city: string;
  rent: number;
  staffCount: number;
  customerProfile: "broad" | "vip" | "new_to_brand";
}

export interface CollabRoiInput {
  collaborator: string;
  cost: number;
  targetMarket: string;
  category: string;
}

export interface PriceElasticityInput {
  category: string;
  priceChangePct: number;
}

export interface MarketExpansionInput {
  country: string;
}

export interface CampaignImpactInput {
  treatmentCountry: string;
  controlCountry: string;
  campaignStartDate: string;
  windowDays: 14 | 30 | 60;
}

export interface MarketSizingInput {
  country: string;
  category: string;
  pricePoint: number;
}

export interface StoreNpvInput {
  city: string;
  annualRevenue: number;
  setupCost: number;
  annualOperatingCost: number;
}

export interface BrandValuationInput {
  revenueGrowthPct: number;
  ebitdaMarginPct: number;
  discountRatePct: number;
  terminalGrowthPct: number;
}

export interface EoqInput {
  category: string;
}

export interface MarketAdoptionInput {
  country: string;
  p: number;
  q: number;
  avgPrice: number;
}

export interface CapmInput {
  riskFreeRatePct: number;
  marketReturnPct: number;
  beta: number;
}

export interface WaccInput {
  equityValue: number;
  debtValue: number;
  costOfEquityPct: number;
  costOfDebtPct: number;
  taxRatePct: number;
}
