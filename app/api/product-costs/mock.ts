export interface ProductCost {
  product_slug: string;
  material_cost: number;
  labor_cost: number;
  shipping_cost: number;
  duty_cost: number;
  total_cost: number;
}

export const mockProductCosts: ProductCost[] = [
  {
    product_slug: "curve-bag-ivory",
    material_cost: 900,
    labor_cost: 350,
    shipping_cost: 80,
    duty_cost: 70,
    total_cost: 1400,
  },
  {
    product_slug: "linen-shirt-blue",
    material_cost: 220,
    labor_cost: 140,
    shipping_cost: 30,
    duty_cost: 20,
    total_cost: 410,
  },
];
