export interface InfluencerCampaign {
  campaign_id: string;
  influencer_name: string;
  product_slug: string;
  platform: string;
  content_type: string;
  start_date: string;
  end_date: string;
  budget: number;
  country: string;
  market_region: string;
  currency: string;
}

export const mockInfluencerCampaigns: InfluencerCampaign[] = [
  {
    campaign_id: "camp-001",
    influencer_name: "Influencer O",
    product_slug: "linen-shirt-blue",
    platform: "Instagram",
    content_type: "story",
    start_date: "2026-05-14",
    end_date: "2026-05-21",
    budget: 1800,
    country: "Singapore",
    market_region: "APAC",
    currency: "SGD",
  },
  {
    campaign_id: "camp-002",
    influencer_name: "Influencer L",
    product_slug: "rib-knit-ivory",
    platform: "TikTok",
    content_type: "reel",
    start_date: "2026-04-02",
    end_date: "2026-04-09",
    budget: 3200,
    country: "France",
    market_region: "EMEA",
    currency: "EUR",
  },
  {
    campaign_id: "camp-003",
    influencer_name: "Influencer B",
    product_slug: "curve-bag-ivory",
    platform: "Instagram",
    content_type: "post",
    start_date: "2026-02-15",
    end_date: "2026-02-22",
    budget: 5200,
    country: "United States",
    market_region: "Americas",
    currency: "USD",
  },
];
