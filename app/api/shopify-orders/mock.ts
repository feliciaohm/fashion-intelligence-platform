export interface ShopifyOrder {
  order_id: string;
  customer_id: string;
  product_slug: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  order_date: string;
  channel: string;
  country: string;
  market_region: string;
  currency: string;
}

export const mockShopifyOrders: ShopifyOrder[] = [
  {
    order_id: "sh-1001",
    customer_id: "cust-001",
    product_slug: "linen-shirt-blue",
    quantity: 1,
    unit_price: 1800,
    total_price: 1800,
    discount: 0,
    order_date: "2026-05-15",
    channel: "online",
    country: "United Kingdom",
    market_region: "EMEA",
    currency: "GBP",
  },
  {
    order_id: "sh-1002",
    customer_id: "cust-002",
    product_slug: "silk-slip-dress-black",
    quantity: 1,
    unit_price: 4800,
    total_price: 4320,
    discount: 0.1,
    order_date: "2026-04-04",
    channel: "online",
    country: "United States",
    market_region: "Americas",
    currency: "USD",
  },
  {
    order_id: "sh-1003",
    customer_id: "cust-003",
    product_slug: "oversized-coat-camel",
    quantity: 1,
    unit_price: 9800,
    total_price: 9800,
    discount: 0,
    order_date: "2026-10-21",
    channel: "online",
    country: "Singapore",
    market_region: "APAC",
    currency: "SGD",
  },
];
