"use client";

import { removeFavorite } from "@/lib/actions";
import { favoritesStore } from "@/lib/favorites";

/** Lists favourite foods with a remove button. */
export function FavoritesSettings() {
  const favorites = favoritesStore.useValue();
  if (favorites === undefined) return null;
  const sorted = [...(favorites ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">★ Favourites</h2>
        <p className="text-sm text-muted">Foods you can log with one tap from Log → Quick add. Kept forever.</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">None yet. Tap ☆ next to a food on the Log screen to add it.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {sorted.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted">{[f.amount, `${f.calories} kcal`].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" className="icon-btn" aria-label={`Remove ${f.name} from favourites`} onClick={() => removeFavorite(f.id)}>
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
