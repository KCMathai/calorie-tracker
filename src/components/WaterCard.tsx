"use client";

import { addWater } from "@/lib/actions";
import { profileStore } from "@/lib/profile";
import { formatMl, WATER_BUTTONS, waterGoal, waterSettingsStore, waterStore } from "@/lib/water";

/** Today's water: progress toward the goal and one-tap buttons. */
export function WaterCard({ date }: { date: string }) {
  const days = waterStore.useValue();
  const settings = waterSettingsStore.useValue();
  const profile = profileStore.useValue();
  const goal = waterGoal(settings, profile);
  const ml = (days ?? []).find((d) => d.date === date)?.ml ?? 0;
  const pct = goal > 0 ? Math.min((ml / goal) * 100, 100) : 0;
  const reached = ml >= goal;

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="water-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="water-heading" className="font-medium">
          💧 Water
        </h2>
        <span className="text-sm tabular-nums">
          <b>{formatMl(ml)}</b> <span className="text-muted">/ {formatMl(goal)}</span>
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={ml}
        aria-label="Water today"
      >
        <div className="h-full rounded-full bg-sky-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted" role="status">
        {reached ? "✓ Goal reached — nice work!" : `${formatMl(goal - ml)} to go`}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {WATER_BUTTONS.map((b) => (
          <button
            key={b.ml}
            type="button"
            onClick={() => addWater(date, b.ml)}
            className="flex flex-col items-center rounded-xl border border-[var(--border)] px-1 py-2 text-xs hover:bg-[var(--surface-hover)]"
            aria-label={`Add ${b.label.toLowerCase()}, ${b.ml} millilitres`}
          >
            <span className="text-lg" aria-hidden>
              {b.emoji}
            </span>
            +{b.ml}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addWater(date, -250)}
          disabled={ml === 0}
          className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] px-1 py-2 text-xs text-muted hover:bg-[var(--surface-hover)] disabled:opacity-40"
          aria-label="Remove 250 millilitres"
        >
          <span className="text-lg" aria-hidden>
            ↩
          </span>
          −250
        </button>
      </div>
    </section>
  );
}
