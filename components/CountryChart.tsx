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

const INK = "#1c1a16";

export default function CountryChart({ data }: { data: any[] }) {
  const rows = [...(data ?? [])].sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0));

  const chartData = {
    labels: rows.map((d) => d.country),
    datasets: [
      {
        label: "Revenue",
        data: rows.map((d) => d.total_revenue ?? 0),
        backgroundColor: INK,
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  };

  const options = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8b8578" } },
      y: { grid: { color: "#e4e0d6" }, ticks: { color: "#8b8578" } },
    },
  };

  return (
    <div className="chart-panel">
      <div className="section-title" style={{ fontSize: 16, marginBottom: 2 }}>
        Revenue by Country
      </div>
      <div className="section-subtitle">country_performance_model (BigQuery)</div>
      <Bar data={chartData} options={options} />
    </div>
  );
}
