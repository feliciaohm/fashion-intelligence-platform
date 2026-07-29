export interface StoreInventoryEntry {
  store_id: string;
  product_slug: string;
  stock_level: number;
  safety_stock: number;
  last_restock_date: string;
}

export const mockStoreInventory: StoreInventoryEntry[] = [
  {
    store_id: "store-paris-01",
    product_slug: "curve-bag-ivory",
    stock_level: 8,
    safety_stock: 5,
    last_restock_date: "2026-04-20",
  },
  {
    store_id: "store-nyc-01",
    product_slug: "soft-tote-sand",
    stock_level: 3,
    safety_stock: 6,
    last_restock_date: "2026-03-05",
  },
];
