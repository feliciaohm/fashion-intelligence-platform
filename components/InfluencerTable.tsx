export default function InfluencerTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b">
          <th className="p-2">Influencer</th>
          <th className="p-2">Events</th>
          <th className="p-2">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.influencer_slug} className="border-b hover:bg-gray-50">
            <td className="p-2">{row.influencer_slug}</td>
            <td className="p-2">{row.total_events}</td>
            <td className="p-2">€{row.total_revenue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
