export interface ForecastBudget {
  period: string;
  product_category: string;
  forecast_revenue: number;
  forecast_units: number;
  budget_revenue: number;
}

export const mockForecastBudget: ForecastBudget[] = [
  {
    period: "2026-Q3",
    product_category: "bags",
    forecast_revenue: 210000,
    forecast_units: 140,
    budget_revenue: 220000,
  },
  {
    period: "2026-Q3",
    product_category: "knitwear",
    forecast_revenue: 95000,
    forecast_units: 90,
    budget_revenue: 100000,
  },
];
