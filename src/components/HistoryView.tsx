"use client";

import Link from "next/link";
import { useState } from "react";
import { dayKey, entriesFor, entriesStore, LOG_RETENTION_DAYS, shiftDay, totals } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { CalorieChart, type DayBar } from "./charts";
import { LongTermSection } from "./LongTermSection";
import { MealList } from "./MealList";
import { Stat } from "./Stat";
import { WeightSection } from "./WeightSection";

const RANGES = [7, LOG_RETENTION_DAYS] as const;

function dayTitle(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function HistoryView() {
  const now = useNow();
  const profile = profileStore.useValue();
  const allEntries = entriesStore.useValue();
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);

  if (!now || profile === undefined) return <p className="text-muted">Loading…</p>;

  if (profile === null) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-muted">Set your daily calorie target first.</p>
        <Link href="/" className="btn-primary text-center">
          Set up my goal
        </Link>
      </div>
    );
  }

  const today = dayKey(now);
  const target = profile.calorieTarget;
  const days = Array.from({ length: range }, (_, i) => shiftDay(today, i - range + 1)).map((date) => {
    const items = entriesFor(allEntries, date);
    const [y, m, d] = date.split("-").map(Number);
    const jsDate = new Date(y, m - 1, d);
    return {
      date,
      label: range <= 7 ? jsDate.toLocaleDateString(undefined, { weekday: "short" }) : String(d),
      title: dayTitle(date),
      calories: totals(items).calories,
      logged: items.length > 0,
      items,
    } satisfies DayBar & { items: typeof items };
  });

  const logged = days.filter((d) => d.logged);
  const average = logged.length ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : null;
  const onTarget = logged.filter((d) => d.calories <= target).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">History</h1>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-hover)] p-1" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${range === r ? "bg-[var(--surface)] shadow-sm" : "text-muted"}`}
            >
              {r} days
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Daily average" value={average !== null ? average.toLocaleString() : "—"} unit={average !== null ? "kcal" : ""} />
        <Stat label="On target" value={`${onTarget}`} unit={`of ${logged.length} days`} />
        <Stat label="Days logged" value={`${logged.length}`} unit={`of ${range}`} />
      </section>

      <section className="card flex flex-col gap-2">
        <div>
          <h2 className="font-medium">Calories per day</h2>
          <p className="text-xs text-muted">▲ marks days over your {target.toLocaleString()} kcal target. Tap a bar for details.</p>
        </div>
        <CalorieChart days={days} target={target} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Day by day</h2>
        <ul className="card !p-0">
          {[...days].reverse().map((d) => (
            <li key={d.date} className="border-b border-[var(--border)] last:border-b-0">
              {d.logged ? (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5">
                    <DayRow title={d.date === today ? "Today" : d.title} calories={d.calories} target={target} />
                    <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
                      ›
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    <MealList entries={d.items} />
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 pr-[30px]">
                  <span className="flex-1 text-sm">{d.date === today ? "Today" : d.title}</span>
                  <span className="text-sm text-muted">not logged</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Food logs are kept for {LOG_RETENTION_DAYS} days.</p>
      </section>

      <LongTermSection today={today} />

      <WeightSection today={today} />
    </div>
  );
}

function DayRow({ title, calories, target }: { title: string; calories: number; target: number }) {
  const over = calories > target;
  return (
    <>
      <span className="flex-1 text-sm">{title}</span>
      <span className="text-sm tabular-nums">{calories.toLocaleString()} kcal</span>
      <span className="w-24 text-right text-xs tabular-nums text-muted">
        {over ? `▲ ${(calories - target).toLocaleString()} over` : `${(target - calories).toLocaleString()} under`}
      </span>
    </>
  );
}
