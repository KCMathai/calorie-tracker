"use client";

import { toggleFavorite } from "@/lib/actions";
import { MEALS, totals, type FoodEntry } from "@/lib/entries";
import { favoritesStore, findFavorite } from "@/lib/favorites";

/** Entries grouped by meal. Pass onEdit/onDelete to show action buttons; `favorites` adds a ☆ toggle. */
export function MealList({
  entries,
  onEdit,
  onDelete,
  favorites: showFavorites,
  emptyText = "Nothing logged yet.",
}: {
  entries: FoodEntry[];
  onEdit?: (entry: FoodEntry) => void;
  onDelete?: (entry: FoodEntry) => void;
  favorites?: boolean;
  emptyText?: string;
}) {
  const favorites = favoritesStore.useValue();
  if (entries.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;

  return (
    <div className="flex flex-col gap-3">
      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal.value);
        if (items.length === 0) return null;
        return (
          <section key={meal.value} className="card !p-0">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
              <h3 className="font-medium">
                <span aria-hidden>{meal.emoji}</span> {meal.label}
              </h3>
              <span className="text-sm tabular-nums text-muted">{totals(items).calories.toLocaleString()} kcal</span>
            </header>
            <ul>
              {items.map((e) => (
                <li key={e.id} className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{e.name}</p>
                    <p className="text-xs text-muted">
                      {[e.amount, macroSummary(e)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="tabular-nums">{e.calories.toLocaleString()}</span>
                  {showFavorites && (
                    <FavoriteButton entry={e} isFavorite={!!findFavorite(favorites, e)} />
                  )}
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(e)} className="icon-btn" aria-label={`Edit ${e.name}`}>
                      ✏️
                    </button>
                  )}
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(e)} className="icon-btn" aria-label={`Delete ${e.name}`}>
                      🗑️
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FavoriteButton({ entry, isFavorite }: { entry: FoodEntry; isFavorite: boolean }) {
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(entry)}
      className="icon-btn"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${entry.name} from favourites` : `Add ${entry.name} to favourites`}
      title={isFavorite ? "Remove from favourites" : "Add to favourites"}
    >
      <span className={isFavorite ? "text-amber-500" : "text-muted"}>{isFavorite ? "★" : "☆"}</span>
    </button>
  );
}

function macroSummary(e: FoodEntry): string {
  const parts = [
    e.protein != null && `P ${e.protein}g`,
    e.carbs != null && `C ${e.carbs}g`,
    e.fat != null && `F ${e.fat}g`,
  ].filter(Boolean);
  return parts.join(" ");
}
