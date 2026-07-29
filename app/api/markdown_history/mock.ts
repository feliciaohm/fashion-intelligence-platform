export interface MarkdownHistoryEntry {
  product_id: string;
  original_price: number;
  markdown_price: number;
  markdown_date: string;
  channel: string;
  reason: string;
}

export const markdownHistory: MarkdownHistoryEntry[] = [
  {
    product_id: "curve-bag-ivory",
    original_price: 3500,
    markdown_price: 2800,
    markdown_date: "2024-02-15",
    channel: "ecom",
    reason: "seasonal",
  },
  {
    product_id: "soft-tote-sand",
    original_price: 3200,
    markdown_price: 2600,
    markdown_date: "2024-03-01",
    channel: "retail",
    reason: "slow_seller",
  },
];
