import { mockShopifyOrders } from "@/app/api/shopify-orders/mock";
import { mockRetailSales } from "@/app/api/retail-sales/mock";
import { mockCrmCustomers } from "@/app/api/crm-customers/mock";
import { mockInfluencerCampaigns } from "@/app/api/influencer-campaigns/mock";
import { mockCustomerJourney } from "@/app/api/customer-journey/mock";
import { mockStoreInventory } from "@/app/api/store-inventory/mock";
import { mockStoreCosts } from "@/app/api/store-costs/mock";
import { mockPNL } from "@/app/api/finance/mock";

// Mock-data implementations of the 4 master views defined in sql/schema.sql.
// These mirror the SQL views' join logic so the platform is demoable today,
// without live BigQuery tables behind shopify_orders/crm_customers/etc.

export interface ProductPerformanceMasterRow {
  product_slug: string;
  shopify_revenue: number;
  retail_revenue: number;
  total_inventory: number;
  influencer_spend: number;
}

export function getProductPerformanceMaster(): ProductPerformanceMasterRow[] {
  const slugs = new Set<string>([
    ...mockShopifyOrders.map((o) => o.product_slug),
    ...mockRetailSales.map((r) => r.product_id),
    ...mockStoreInventory.map((i) => i.product_slug),
    ...mockInfluencerCampaigns.map((c) => c.product_slug),
  ]);

  return Array.from(slugs).map((product_slug) => ({
    product_slug,
    shopify_revenue: mockShopifyOrders
      .filter((o) => o.product_slug === product_slug)
      .reduce((sum, o) => sum + o.total_price, 0),
    retail_revenue: mockRetailSales
      .filter((r) => r.product_id === product_slug)
      .reduce((sum, r) => sum + r.revenue, 0),
    total_inventory: mockStoreInventory
      .filter((i) => i.product_slug === product_slug)
      .reduce((sum, i) => sum + i.stock_level, 0),
    influencer_spend: mockInfluencerCampaigns
      .filter((c) => c.product_slug === product_slug)
      .reduce((sum, c) => sum + c.budget, 0),
  }));
}

export interface InfluencerRoiMasterRow {
  campaign_id: string;
  influencer_name: string;
  product_slug: string;
  gifted_cost: number;
  purchases: number;
  attributed_revenue: number;
  avg_customer_ltv: number;
  roi_pct: number;
}

export function getInfluencerRoiMaster(): InfluencerRoiMasterRow[] {
  return mockInfluencerCampaigns.map((campaign) => {
    const viewedCustomerIds = mockCustomerJourney
      .filter(
        (j) =>
          j.product_slug === campaign.product_slug &&
          j.touchpoint === "influencer_post_view"
      )
      .map((j) => j.customer_id);

    const attributedOrders = mockShopifyOrders.filter(
      (o) =>
        o.product_slug === campaign.product_slug &&
        viewedCustomerIds.includes(o.customer_id)
    );

    const attributedRevenue = attributedOrders.reduce(
      (sum, o) => sum + o.total_price,
      0
    );

    const ltvs = attributedOrders
      .map((o) => mockCrmCustomers.find((c) => c.customer_id === o.customer_id)?.lifetime_value)
      .filter((v): v is number => typeof v === "number");
    const avgLtv = ltvs.length ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0;

    return {
      campaign_id: campaign.campaign_id,
      influencer_name: campaign.influencer_name,
      product_slug: campaign.product_slug,
      gifted_cost: campaign.budget,
      purchases: attributedOrders.length,
      attributed_revenue: attributedRevenue,
      avg_customer_ltv: Math.round(avgLtv),
      roi_pct: campaign.budget
        ? Math.round(((attributedRevenue - campaign.budget) / campaign.budget) * 1000) / 10
        : 0,
    };
  });
}

export interface MarketPerformanceMasterRow {
  country: string;
  market_region: string;
  retail_revenue: number;
  shopify_revenue: number;
}

export function getMarketPerformanceMaster(): MarketPerformanceMasterRow[] {
  const keys = new Set<string>([
    ...mockRetailSales.map((r) => `${r.country}|${r.market_region}`),
    ...mockShopifyOrders.map((o) => `${o.country}|${o.market_region}`),
  ]);

  return Array.from(keys).map((key) => {
    const [country, market_region] = key.split("|");
    return {
      country,
      market_region,
      retail_revenue: mockRetailSales
        .filter((r) => r.country === country && r.market_region === market_region)
        .reduce((sum, r) => sum + r.revenue, 0),
      shopify_revenue: mockShopifyOrders
        .filter((o) => o.country === country && o.market_region === market_region)
        .reduce((sum, o) => sum + o.total_price, 0),
    };
  });
}

export interface FinancialHealthMasterRow {
  period: string;
  revenue: number;
  gross_margin: number;
  opex: number;
  store_costs: number;
  net_margin: number;
  budget_margin: number;
}

export function getFinancialHealthMaster(): FinancialHealthMasterRow[] {
  // finance/mock.ts only models a single flat P&L today (no period breakdown),
  // so this master view has one row until that mock grows a period dimension.
  const period = "2026-Q1";
  const storeCostsTotal = mockStoreCosts
    .filter((s) => s.period === period)
    .reduce((sum, s) => sum + s.rent + s.staff_cost + s.utilities + s.other_opex, 0);

  return [
    {
      period,
      revenue: mockPNL.revenue,
      gross_margin: mockPNL.gross_margin,
      opex: mockPNL.opex,
      store_costs: storeCostsTotal,
      net_margin: mockPNL.net_margin,
      budget_margin: mockPNL.budget_margin,
    },
  ];
}
