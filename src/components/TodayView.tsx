"use client";

import Link from "next/link";
import { macroTargets } from "@/lib/calories";
import { dayKey, entriesFor, entriesStore, totals } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { AlertBanner } from "./AlertBanner";
import { GoalForm } from "./GoalForm";
import { MealList } from "./MealList";
import { ProgressRing } from "./ProgressRing";
import { SyncBadge } from "./SyncBadge";
import { WaterCard } from "./WaterCard";

export function TodayView() {
  const now = useNow();
  const profile = profileStore.useValue();
  const allEntries = entriesStore.useValue();

  if (!now || profile === undefined) return <p className="text-muted">Loading…</p>;

  if (profile === null) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold">Welcome 👋</h1>
          <p className="text-muted">Tell us a little about yourself so we can suggest a daily calorie target.</p>
        </header>
        <GoalForm />
      </div>
    );
  }

  const target = profile.calorieTarget;
  const todays = entriesFor(allEntries, dayKey(now));
  const sum = totals(todays);
  const macroGoal = macroTargets(target);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      <SyncBadge />
      <AlertBanner eaten={sum.calories} target={target} />

      <section className="card flex flex-col items-center gap-4">
        <ProgressRing eaten={sum.calories} target={target} />
        <div className="grid w-full grid-cols-2 text-center">
          <div>
            <p className="text-lg font-semibold tabular-nums">{sum.calories.toLocaleString()}</p>
            <p className="text-xs text-muted">eaten</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{target.toLocaleString()}</p>
            <p className="text-xs text-muted">target</p>
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">Macros</h2>
        <MacroBar label="Protein" value={sum.protein} goal={macroGoal.protein} color="#3b82f6" />
        <MacroBar label="Carbs" value={sum.carbs} goal={macroGoal.carbs} color="#f59e0b" />
        <MacroBar label="Fat" value={sum.fat} goal={macroGoal.fat} color="#ec4899" />
        <p className="text-xs text-muted">Goals assume a balanced 25 / 50 / 25 split. Only foods with macros entered count here.</p>
      </section>

      <WaterCard date={dayKey(now)} />

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Today&apos;s food</h2>
        <Link href="/log" className="text-sm font-medium text-[var(--accent)]">
          + Add food
        </Link>
      </div>
      <MealList entries={todays} emptyText="No food logged yet today. Tap “+ Add food” to start." />
    </div>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value)} / {goal} g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
