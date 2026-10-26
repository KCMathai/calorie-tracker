"use client";

import { useState } from "react";
import { dailyTotalsStore, type DailyTotal } from "@/lib/dailyTotals";
import { shiftDay } from "@/lib/entries";
import { Stat } from "./Stat";

const RANGES = [
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
  { days: Infinity, label: "All time" },
] as const;

function summary(days: DailyTotal[]) {
  if (days.length === 0) return null;
  const average = Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length);
  const withTarget = days.filter((d) => d.target > 0);
  const onTarget = withTarget.filter((d) => d.calories <= d.target).length;
  return { average, logged: days.length, onTarget, withTarget: withTarget.length };
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Averages from the daily totals, which are kept forever (meals themselves are kept 30 days). */
export function LongTermSection({ today }: { today: string }) {
  const totals = dailyTotalsStore.useValue() ?? [];
  const [range, setRange] = useState<(typeof RANGES)[number]["days"]>(90);

  const cutoff = Number.isFinite(range) ? shiftDay(today, -(range as number) + 1) : "";
  const inRange = totals.filter((t) => t.date >= cutoff && t.date <= today);
  const s = summary(inRange);

  const months = new Map<string, DailyTotal[]>();
  for (const t of inRange) {
    const key = t.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), t]);
  }
  const monthRows = [...months.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const firstDay = totals[0]?.date;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="longterm-heading">
      <div className="flex items-center justify-between">
        <h2 id="longterm-heading" className="text-xl font-semibold">
          Long-term
        </h2>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-hover)] p-1" role="radiogroup" aria-label="Long-term range">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              role="radio"
              aria-checked={range === r.days}
              onClick={() => setRange(r.days)}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${range === r.days ? "bg-[var(--surface)] shadow-sm" : "text-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Average" value={s.average.toLocaleString()} unit="kcal per logged day" />
            <Stat label="On target" value={`${s.onTarget}`} unit={`of ${s.withTarget} days`} />
            <Stat label="Days logged" value={`${s.logged}`} unit={firstDay ? `since ${firstDay}` : ""} />
          </div>
          <div className="card !p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Monthly averages</caption>
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Month
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Avg kcal
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    On target
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map(([key, days]) => {
                  const m = summary(days)!;
                  return (
                    <tr key={key} className="border-b border-[var(--border)] last:border-b-0">
                      <th scope="row" className="px-4 py-2 text-left font-normal">
                        {monthLabel(key)}
                        <span className="block text-xs text-muted">{m.logged} days logged</span>
                      </th>
                      <td className="px-2 py-2 text-right tabular-nums">{m.average.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {m.onTarget}/{m.withTarget}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No days logged in this period yet.</p>
      )}
      <p className="text-xs text-muted">
        Each day&apos;s totals (and the target that applied that day) are kept forever, even after its meals are deleted at 30 days.
      </p>
    </section>
  );
}
