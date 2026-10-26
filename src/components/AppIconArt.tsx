/**
 * The app icon: a white progress ring (like the Today screen) on green, with a
 * small leaf. Plain shapes only, so it renders inside ImageResponse.
 */
export function AppIconArt({ size, padding, rounded }: { size: number; padding: number; rounded: boolean }) {
  const inner = size * (1 - padding * 2);
  const stroke = inner * 0.13;
  const r = (inner - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#16a34a",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg width={inner} height={inner} viewBox={`0 0 ${inner} ${inner}`}>
        <circle cx={inner / 2} cy={inner / 2} r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} />
        <circle
          cx={inner / 2}
          cy={inner / 2}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.72} ${c}`}
          transform={`rotate(-90 ${inner / 2} ${inner / 2})`}
        />
        {/* leaf */}
        <path
          d={`M ${inner * 0.5} ${inner * 0.66} C ${inner * 0.34} ${inner * 0.6}, ${inner * 0.34} ${inner * 0.4}, ${inner * 0.5} ${inner * 0.32} C ${inner * 0.66} ${inner * 0.4}, ${inner * 0.66} ${inner * 0.6}, ${inner * 0.5} ${inner * 0.66} Z`}
          fill="#ffffff"
        />
        <path d={`M ${inner * 0.5} ${inner * 0.38} L ${inner * 0.5} ${inner * 0.7}`} stroke="#16a34a" strokeWidth={inner * 0.025} strokeLinecap="round" />
      </svg>
    </div>
  );
}
