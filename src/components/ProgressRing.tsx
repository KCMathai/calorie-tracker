export function ProgressRing({ eaten, target }: { eaten: number; target: number }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;
  const remaining = target - eaten;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute text-center" role="img" aria-label={`${eaten} of ${target} kcal eaten`}>
        <p className={`text-3xl font-semibold tabular-nums ${over ? "text-[var(--danger)]" : ""}`}>
          {Math.abs(remaining).toLocaleString()}
        </p>
        <p className="text-sm text-muted">{over ? "kcal over" : "kcal left"}</p>
      </div>
    </div>
  );
}
