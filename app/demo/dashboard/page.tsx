"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/products");
      const json = await res.json();
      setData(json);
    }
    load();
  }, []);

  if (data.length === 0) {
    return <div className="p-10 text-xl">Laddar data…</div>;
  }

  const totalStock = data.reduce((sum, p) => sum + (p.stock_level || 0), 0);
  const totalRetailRevenue = data.reduce((sum, p) => sum + (p.retail_revenue || 0), 0);
  const totalEcomRevenue = data.reduce((sum, p) => sum + (p.ecommerce_revenue || 0), 0);
  const totalInfluencerRevenue = data.reduce((sum, p) => sum + (p.influencer_revenue || 0), 0);

  return (
    <div className="p-10 space-y-10">

      <div className="grid grid-cols-4 gap-6">
        <KPI title="Total Stock" value={totalStock} />
        <KPI title="Retail Revenue" value={totalRetailRevenue + " kr"} />
        <KPI title="E‑com Revenue" value={totalEcomRevenue + " kr"} />
        <KPI title="Influencer Revenue" value={totalInfluencerRevenue + " kr"} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Product Overview</h2>
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Product</th>
              <th className="p-2 border">Stock</th>
              <th className="p-2 border">Retail Revenue</th>
              <th className="p-2 border">E‑com Revenue</th>
              <th className="p-2 border">Influencer Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.product_id}>
                <td className="p-2 border">{p.product_name}</td>
                <td className="p-2 border">{p.stock_level}</td>
                <td className="p-2 border">{p.retail_revenue || 0}</td>
                <td className="p-2 border">{p.ecommerce_revenue || 0}</td>
                <td className="p-2 border">{p.influencer_revenue || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function KPI({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <div className="text-gray-500">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
