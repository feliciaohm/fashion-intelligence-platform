export interface WholesaleReorder {
  reorder_id: string;
  wholesale_partner: string;
  product_slug: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  requested_date: string;
  expected_delivery_date: string;
  status: string;
}

export const mockWholesaleReorders: WholesaleReorder[] = [
  {
    reorder_id: "wr-001",
    wholesale_partner: "Selfridges",
    product_slug: "curve-bag-ivory",
    quantity: 25,
    unit_cost: 1400,
    total_cost: 35000,
    requested_date: "2026-03-01",
    expected_delivery_date: "2026-04-15",
    status: "confirmed",
  },
  {
    reorder_id: "wr-002",
    wholesale_partner: "Net-a-Porter",
    product_slug: "silk-slip-dress-ivory",
    quantity: 40,
    unit_cost: 1100,
    total_cost: 44000,
    requested_date: "2026-04-10",
    expected_delivery_date: "2026-05-20",
    status: "pending",
  },
];
