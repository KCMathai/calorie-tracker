import type { FoodEntry, NewFoodEntry } from "./entries";
import { createStore } from "./store";

/** A food saved for one-tap logging. Kept forever (stored with your preferences). */
export interface Favorite {
  id: string;
  name: string;
  amount?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  createdAt: number;
}

export const favoritesStore = createStore<Favorite[]>("calorie-tracker:favorites");

/** The same food: same name and amount, ignoring case and extra spaces. */
export function foodKey(f: { name: string; amount?: string }) {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(f.name)}|${norm(f.amount)}`;
}

export function findFavorite(favorites: Favorite[] | null | undefined, food: { name: string; amount?: string }) {
  const key = foodKey(food);
  return (favorites ?? []).find((f) => foodKey(f) === key);
}

/** Foods logged recently, newest first, one per name+amount, leaving out favourites. */
export function recentFoods(entries: FoodEntry[] | null | undefined, favorites: Favorite[] | null | undefined, limit = 8) {
  const favKeys = new Set((favorites ?? []).map(foodKey));
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of [...(entries ?? [])].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = foodKey(e);
    if (seen.has(key) || favKeys.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** The parts of a logged food that make up a new entry. */
export function asNewEntry(f: Favorite | FoodEntry, date: string, meal: NewFoodEntry["meal"]): NewFoodEntry {
  return { date, meal, name: f.name, amount: f.amount, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat };
}
