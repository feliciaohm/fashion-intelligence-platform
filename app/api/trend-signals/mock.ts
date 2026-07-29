export interface TrendSignal {
  signal_id: string;
  keyword: string;
  category: string;
  source: string;
  momentum_score: number;
  detected_date: string;
}

export const mockTrendSignals: TrendSignal[] = [
  {
    signal_id: "trend-001",
    keyword: "structured bags",
    category: "bags",
    source: "social_listening",
    momentum_score: 82,
    detected_date: "2026-05-01",
  },
  {
    signal_id: "trend-002",
    keyword: "rib knitwear",
    category: "knitwear",
    source: "search_trends",
    momentum_score: 67,
    detected_date: "2026-03-15",
  },
];
