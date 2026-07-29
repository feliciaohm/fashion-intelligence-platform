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

export default function FunnelChart({ data }: { data: any[] }) {
  // Räkna antal events per funnel-steg
  const views = data.filter((e) => e.event_name === "view_item").length;
  const addToCart = data.filter((e) => e.event_name === "add_to_cart").length;
  const purchases = data.filter((e) => e.event_name === "purchase").length;

  const chartData = {
    labels: ["Views", "Add to Cart", "Purchases"],
    datasets: [
      {
        label: "Funnel",
        data: [views, addToCart, purchases],
        backgroundColor: ["#93c5fd", "#60a5fa", "#3b82f6"],
      },
    ],
  };

  return (
    <div className="p-4 bg-white border rounded-xl shadow-sm">
      <Bar data={chartData} />
    </div>
  );
}
