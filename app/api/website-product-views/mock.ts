export interface WebsiteProductView {
  product_slug: string;
  date: string;
  views: number;
  unique_visitors: number;
  add_to_cart_count: number;
}

export const mockWebsiteProductViews: WebsiteProductView[] = [
  {
    product_slug: "linen-shirt-blue",
    date: "2026-05-14",
    views: 1240,
    unique_visitors: 980,
    add_to_cart_count: 62,
  },
  {
    product_slug: "curve-bag-ivory",
    date: "2026-02-15",
    views: 3100,
    unique_visitors: 2400,
    add_to_cart_count: 145,
  },
];
