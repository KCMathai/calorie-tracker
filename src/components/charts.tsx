"use client";

import { useEffect, useRef, useState } from "react";

/** Width of an element, kept up to date as it resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(max: number, maxTicks = 4) {
  for (const s of [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000]) if (max / s <= maxTicks) return s;
  return 10000;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  // Keep the tooltip inside the chart horizontally.
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs shadow-md"
      style={{ left, top: y - 8 }}
      role="status"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- calories per day

export interface DayBar {
  date: string;
  /** short axis label, e.g. "Mon" or "12" */
  label: string;
  /** full label for the tooltip, e.g. "Mon 12 Oct" */
  title: string;
  calories: number;
  logged: boolean;
}

/**
 * Daily bars against a reference line. "limit" mode (calories) marks days over
 * the line with ▲; "goal" mode (water) marks days that reached it with ✓.
 * Bars are always one colour — the marker and text carry the meaning.
 */
export function CalorieChart({
  days,
  target,
  unit = "kcal",
  mode = "limit",
  label = "Calories per day compared with your target",
}: {
  days: DayBar[];
  target: number;
  unit?: string;
  mode?: "limit" | "goal";
  label?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const marked = (v: number) => (mode === "limit" ? v > target : v >= target);
  const describe = (v: number) =>
    mode === "limit"
      ? v > target
        ? `▲ ${fmt(v - target)} over`
        : `${fmt(target - v)} under`
      : v >= target
        ? "✓ goal reached"
        : `${fmt(target - v)} ${unit} to go`;
  const [active, setActive] = useState<number | null>(null);

  const height = 190;
  // the right margin holds the target label, so it never sits on top of a bar
  const m = { top: 16, right: 42, bottom: 24, left: 40 };
  const innerW = Math.max(width - m.left - m.right, 0);
  const innerH = height - m.top - m.bottom;
  const maxVal = Math.max(target, ...days.map((d) => d.calories)) * 1.1 || 1;
  const step = niceStep(maxVal);
  const yMax = Math.ceil(maxVal / step) * step;
  const y = (v: number) => m.top + innerH - (v / yMax) * innerH;
  const band = days.length ? innerW / days.length : 0;
  const barW = Math.min(24, band * 0.6);
  const labelEvery = days.length > 10 ? Math.ceil(days.length / 7) : 1;
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const activeDay = active !== null ? days[active] : null;

  return (
    <div ref={ref} className="relative w-full" onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[10px] tabular-nums">
                {fmt(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const cx = m.left + band * i + band / 2;
            const over = d.logged && marked(d.calories);
            const h = d.logged ? Math.max(y(0) - y(d.calories), 2) : 0;
            const top = y(0) - h;
            const r = Math.min(4, h, barW / 2);
            return (
              <g
                key={d.date}
                tabIndex={0}
                role="img"
                aria-label={`${d.title}: ${d.logged ? `${d.calories} ${unit}, ${describe(d.calories).replace(/^[▲✓] /, "")}` : "nothing logged"}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none [&:focus-visible>rect.hit]:stroke-[var(--accent)]"
              >
                {/* hit target: the whole column, not just the painted bar */}
                <rect className="hit" x={cx - band / 2} y={m.top} width={band} height={innerH} fill="transparent" strokeWidth={1} rx={4} />
                {h > 0 && (
                  <path
                    d={`M${cx - barW / 2},${y(0)} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${y(0)} Z`}
                    fill="var(--chart)"
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                )}
                {over && (
                  <text x={cx} y={top - 4} textAnchor="middle" className="fill-[var(--foreground)] text-[9px]" aria-hidden>
                    {mode === "limit" ? "▲" : "✓"}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* target reference line */}
          <line x1={m.left} x2={width - m.right + 2} y1={y(target)} y2={y(target)} stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.5} />
          <text x={width - m.right + 4} y={y(target)} className="fill-[var(--foreground)] text-[9px]">
            <tspan x={width - m.right + 4} dy="-0.2em">
              {mode === "limit" ? "Target" : "Goal"}
            </tspan>
            <tspan x={width - m.right + 4} dy="1.1em" className="tabular-nums">
              {fmt(target)}
            </tspan>
          </text>
        </svg>
      )}

      {activeDay && active !== null && (
        <Tooltip x={m.left + band * active + band / 2} y={activeDay.logged ? y(activeDay.calories) : y(0)} width={width}>
          <p className="font-semibold tabular-nums">{activeDay.logged ? `${fmt(activeDay.calories)} ${unit}` : "Nothing logged"}</p>
          <p className="text-muted">
            {activeDay.title}
            {activeDay.logged && ` · ${describe(activeDay.calories)}`}
          </p>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- weight trend

export interface WeightPoint {
  date: string;
  title: string;
  kg: number;
}

export function WeightChart({ points }: { points: WeightPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 170;
  const m = { top: 16, right: 14, bottom: 24, left: 40 };
  const innerW = Math.max(width - m.left - m.right, 0);
  const innerH = height - m.top - m.bottom;

  const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
  const first = points.length ? dayNum(points[0].date) : 0;
  const span = points.length > 1 ? dayNum(points[points.length - 1].date) - first : 0;
  const x = (d: string) => (span ? m.left + ((dayNum(d) - first) / span) * innerW : m.left + innerW / 2);

  const kgs = points.map((p) => p.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const pad = Math.max((hi - lo) * 0.15, 1);
  const step = niceStep(hi - lo + pad * 2);
  const yMin = Math.floor((lo - pad) / step) * step;
  const yMax = Math.ceil((hi + pad) / step) * step;
  const y = (v: number) => m.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.kg)}`).join(" ");

  function nearest(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    return best;
  }

  const activePoint = active !== null ? points[active] : null;
  const edgeLabels = points.length > 1 ? [points[0], points[points.length - 1]] : points;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          tabIndex={0}
          role="img"
          aria-label={`Weight trend from ${points[0].kg} kg to ${points[points.length - 1].kg} kg. Use left and right arrow keys to read each entry.`}
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max((a ?? points.length) - 1, 0));
            if (e.key === "ArrowRight") setActive((a) => Math.min((a ?? -1) + 1, points.length - 1));
          }}
          className="touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[10px] tabular-nums">
                {fmt(t)}
              </text>
            </g>
          ))}
          {edgeLabels.map((p) => (
            <text
              key={p.date}
              x={x(p.date)}
              y={height - 6}
              textAnchor={points.length > 1 ? (p === points[0] ? "start" : "end") : "middle"}
              className="fill-[var(--muted)] text-[10px]"
            >
              {p.title}
            </text>
          ))}

          {activePoint && <line x1={x(activePoint.date)} x2={x(activePoint.date)} y1={m.top} y2={m.top + innerH} stroke="var(--muted)" strokeWidth={1} />}

          {points.length > 1 && <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((p, i) => {
            const isEnd = i === points.length - 1;
            if (!isEnd && active !== i && points.length > 14) return null; // keep dense trends clean
            return (
              <circle
                key={p.date}
                cx={x(p.date)}
                cy={y(p.kg)}
                r={active === i ? 5.5 : 4}
                fill="var(--chart)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            );
          })}
          {/* direct label on the latest value — on the side away from the incoming line */}
          {points.length > 0 && (
            <text
              x={x(points[points.length - 1].date)}
              y={y(points[points.length - 1].kg) + (points.length > 1 && points[points.length - 2].kg > points[points.length - 1].kg ? 18 : -10)}
              textAnchor={points.length > 1 ? "end" : "middle"}
              className="fill-[var(--foreground)] text-[11px] font-semibold tabular-nums"
            >
              {fmt(points[points.length - 1].kg)} kg
            </text>
          )}
        </svg>
      )}

      {activePoint && active !== null && (
        <Tooltip x={x(activePoint.date)} y={y(activePoint.kg)} width={width}>
          <p className="font-semibold tabular-nums">{fmt(activePoint.kg)} kg</p>
          <p className="text-muted">{activePoint.title}</p>
        </Tooltip>
      )}
    </div>
  );
}
