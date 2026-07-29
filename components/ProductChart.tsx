"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const GOLD = "#ac7b2e";

export default function ProductChart({ data }: { data: any[] }) {
  const rows = [...(data ?? [])]
    .sort((a, b) => (b.total_revenue_events ?? 0) - (a.total_revenue_events ?? 0))
    .slice(0, 10);

  const chartData = {
    labels: rows.map((d) => d.product_name ?? d.product_slug),
    datasets: [
      {
        label: "Revenue",
        data: rows.map((d) => d.total_revenue_events ?? 0),
        backgroundColor: GOLD,
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "#e4e0d6" }, ticks: { color: "#8b8578" } },
      y: { grid: { display: false }, ticks: { color: "#1c1a16" } },
    },
  };

  return (
    <div className="chart-panel">
      <div className="section-title" style={{ fontSize: 16, marginBottom: 2 }}>
        Top Products by Revenue
      </div>
      <div className="section-subtitle">product_performance_master (BigQuery)</div>
      <Bar data={chartData} options={options} />
    </div>
  );
}
