type KPICardProps = {
  label: string;
  value: string | number;
};

export default function KPICard({ label, value }: KPICardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
