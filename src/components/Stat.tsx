export function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card !p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{unit}</p>
    </div>
  );
}
