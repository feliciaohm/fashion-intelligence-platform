export interface StoreCost {
  store_id: string;
  period: string;
  rent: number;
  staff_cost: number;
  utilities: number;
  other_opex: number;
}

export const mockStoreCosts: StoreCost[] = [
  {
    store_id: "store-paris-01",
    period: "2026-Q1",
    rent: 45000,
    staff_cost: 32000,
    utilities: 4000,
    other_opex: 6000,
  },
  {
    store_id: "store-nyc-01",
    period: "2026-Q1",
    rent: 60000,
    staff_cost: 41000,
    utilities: 5000,
    other_opex: 8000,
  },
];
