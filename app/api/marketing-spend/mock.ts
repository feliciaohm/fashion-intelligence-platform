export interface MarketingSpend {
  period: string;
  channel: string;
  spend: number;
  attributed_revenue: number;
}

export const mockMarketingSpend: MarketingSpend[] = [
  {
    period: "2026-Q1",
    channel: "paid_social",
    spend: 32000,
    attributed_revenue: 98000,
  },
  {
    period: "2026-Q1",
    channel: "influencer",
    spend: 41000,
    attributed_revenue: 156000,
  },
];
