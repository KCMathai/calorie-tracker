"use client";

import { useState } from "react";
import { addEntry, deleteEntry } from "@/lib/actions";
import { entriesStore, MEALS, type FoodEntry, type Meal } from "@/lib/entries";
import { asNewEntry, favoritesStore, recentFoods, type Favorite } from "@/lib/favorites";

/** One-tap logging of favourite and recently eaten foods. */
export function QuickAdd({ date, defaultMeal }: { date: string; defaultMeal: Meal }) {
  const favorites = favoritesStore.useValue() ?? [];
  const entries = entriesStore.useValue();
  const recent = recentFoods(entries, favorites);
  const [tab, setTab] = useState<"favorites" | "recent">(favorites.length ? "favorites" : "recent");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [added, setAdded] = useState<FoodEntry | null>(null);

  if (favorites.length === 0 && recent.length === 0) return null;

  const items: (Favorite | FoodEntry)[] = tab === "favorites" ? favorites : recent;

  function quickAdd(f: Favorite | FoodEntry) {
    setAdded(addEntry(asNewEntry(f, date, meal)));
  }

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="quick-add-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="quick-add-heading" className="font-medium">
          Quick add
        </h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-hover)] p-1" role="tablist" aria-label="Quick add list">
          {(
            [
              ["favorites", `⭐ Favourites`],
              ["recent", `🕘 Recent`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${tab === value ? "bg-[var(--surface)] shadow-sm" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">
          {tab === "favorites" ? "No favourites yet. Tap ☆ next to any food in your list below to add it here." : "Nothing logged recently."}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => quickAdd(f)}
                className="flex max-w-full flex-col rounded-xl border border-[var(--border)] px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                aria-label={`Add ${f.name}${f.amount ? `, ${f.amount}` : ""}, ${f.calories} kcal`}
              >
                <span className="text-sm leading-tight">{f.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {[f.amount, `${f.calories} kcal`].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        Adds to
        <select className="field !py-1 text-xs" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {added && (
        <p className="flex items-center gap-2 text-sm text-[var(--accent)]" role="status">
          Added {added.name} ✓
          <button
            type="button"
            className="text-muted underline"
            onClick={() => {
              deleteEntry(added.id);
              setAdded(null);
            }}
          >
            Undo
          </button>
        </p>
      )}
    </section>
  );
}
