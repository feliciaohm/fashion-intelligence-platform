export interface CrmCustomer {
  customer_id: string;
  first_purchase_date: string;
  lifetime_value: number;
  segment: string;
  country: string;
  market_region: string;
  currency: string;
}

export const mockCrmCustomers: CrmCustomer[] = [
  {
    customer_id: "cust-001",
    first_purchase_date: "2025-11-02",
    lifetime_value: 12400,
    segment: "VIP",
    country: "United Kingdom",
    market_region: "EMEA",
    currency: "GBP",
  },
  {
    customer_id: "cust-002",
    first_purchase_date: "2026-01-18",
    lifetime_value: 4800,
    segment: "Repeat",
    country: "United States",
    market_region: "Americas",
    currency: "USD",
  },
  {
    customer_id: "cust-003",
    first_purchase_date: "2026-10-21",
    lifetime_value: 9800,
    segment: "New",
    country: "Singapore",
    market_region: "APAC",
    currency: "SGD",
  },
];
