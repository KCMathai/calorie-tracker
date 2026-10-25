"use client";

import Link from "next/link";
import { useState } from "react";
import { addEntry, deleteEntry, updateEntry } from "@/lib/actions";
import { dayKey, entriesFor, entriesStore, formatDay, shiftDay, totals, type FoodEntry, type Meal } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { AlertBanner } from "./AlertBanner";
import { FoodForm } from "./FoodForm";
import { MealList } from "./MealList";

function mealForHour(hour: number): Meal {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

export function LogView() {
  const now = useNow();
  const profile = profileStore.useValue();
  const allEntries = entriesStore.useValue();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  if (!now || profile === undefined) return <p className="text-muted">Loading…</p>;

  if (profile === null) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Log food</h1>
        <p className="text-muted">First, set your daily calorie target.</p>
        <Link href="/" className="btn-primary text-center">
          Set up my goal
        </Link>
      </div>
    );
  }

  const today = dayKey(now);
  const date = selectedDate ?? today;
  const dayEntries = entriesFor(allEntries, date);
  const eaten = totals(dayEntries).calories;

  function changeDay(days: number) {
    setSelectedDate(shiftDay(date, days));
    setEditing(null);
    setJustAdded(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Log food</h1>
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn" onClick={() => changeDay(-1)} aria-label="Previous day">
            ‹
          </button>
          <span className="min-w-24 text-center text-sm font-medium">{formatDay(date, today)}</span>
          <button type="button" className="icon-btn" onClick={() => changeDay(1)} disabled={date >= today} aria-label="Next day">
            ›
          </button>
        </div>
      </header>

      {date === today && <AlertBanner eaten={eaten} target={profile.calorieTarget} />}

      <section className="card">
        {editing ? (
          <>
            <h2 className="mb-3 font-medium">Edit food</h2>
            <FoodForm
              key={editing.id}
              date={date}
              defaultMeal={editing.meal}
              initial={editing}
              onSubmit={(changes) => {
                updateEntry(editing.id, changes);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </>
        ) : (
          <>
            <h2 className="mb-3 font-medium">Add food</h2>
            <FoodForm
              date={date}
              defaultMeal={mealForHour(now.getHours())}
              onSubmit={(entry) => {
                addEntry(entry);
                setJustAdded(entry.name);
              }}
            />
            {justAdded && (
              <p className="mt-2 text-sm text-[var(--accent)]" role="status">
                Added {justAdded} ✓
              </p>
            )}
          </>
        )}
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">{formatDay(date, today)}&apos;s food</h2>
        <span className="text-sm tabular-nums text-muted">
          {eaten.toLocaleString()} / {profile.calorieTarget.toLocaleString()} kcal
        </span>
      </div>
      <MealList
        entries={dayEntries}
        onEdit={(e) => {
          setEditing(e);
          setJustAdded(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onDelete={(e) => {
          if (confirm(`Delete "${e.name}"?`)) {
            deleteEntry(e.id);
            if (editing?.id === e.id) setEditing(null);
          }
        }}
      />
    </div>
  );
}
