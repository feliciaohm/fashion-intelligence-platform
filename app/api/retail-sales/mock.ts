export interface RetailSale {
  product_id: string;
  store_id: string;
  date: string;
  units_sold: number;
  revenue: number;
  discount: number;
  country: string;
  market_region: string;
  currency: string;
}

export const mockRetailSales: RetailSale[] = [
  {
    product_id: "curve-bag-ivory",
    store_id: "store-paris-01",
    date: "2026-02-15",
    units_sold: 3,
    revenue: 15600,
    discount: 0,
    country: "France",
    market_region: "EMEA",
    currency: "EUR",
  },
  {
    product_id: "soft-tote-sand",
    store_id: "store-nyc-01",
    date: "2026-03-03",
    units_sold: 5,
    revenue: 24000,
    discount: 0.1,
    country: "United States",
    market_region: "Americas",
    currency: "USD",
  },
  {
    product_id: "rib-knit-black",
    store_id: "store-tokyo-01",
    date: "2026-03-22",
    units_sold: 2,
    revenue: 6400,
    discount: 0,
    country: "Japan",
    market_region: "APAC",
    currency: "JPY",
  },
];
