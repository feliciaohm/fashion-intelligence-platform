// Shared empty-state design: used anywhere a filter, search, or lookup can
// legitimately return zero real rows -- never a blank table or a bare error.
export default function EmptyState({ label, message }: { label: string; message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-label">{label}</div>
      <p className="empty-state-message">{message}</p>
    </div>
  );
}
