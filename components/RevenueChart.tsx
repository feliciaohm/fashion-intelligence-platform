"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import useSWR from "swr";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const GOLD = "#ac7b2e";

export default function RevenueChart() {
  const { data } = useSWR("/api/revenue-timeline", fetcher);
  const rows = data ?? [];

  const chartData = {
    labels: rows.map((d: any) => d.month),
    datasets: [
      {
        label: "Revenue",
        data: rows.map((d: any) => d.revenue || 0),
        borderColor: GOLD,
        backgroundColor: "rgba(172, 123, 46, 0.12)",
        pointBackgroundColor: GOLD,
        pointRadius: 3,
        tension: 0.35,
        fill: true,
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
        Revenue Over Time
      </div>
      <div className="section-subtitle">Monthly purchase revenue, sales_events (BigQuery)</div>
      <Line data={chartData} options={options} />
    </div>
  );
}
