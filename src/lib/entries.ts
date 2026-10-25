import { createStore } from "./store";

export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";

export const MEALS: { value: Meal; label: string; emoji: string }[] = [
  { value: "breakfast", label: "Breakfast", emoji: "🍳" },
  { value: "lunch", label: "Lunch", emoji: "🥗" },
  { value: "dinner", label: "Dinner", emoji: "🍲" },
  { value: "snacks", label: "Snacks", emoji: "🍎" },
];

export interface FoodEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  name: string;
  /** Free text, e.g. "1 cup" or "150 g". */
  amount?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  createdAt: number;
}

export type NewFoodEntry = Omit<FoodEntry, "id" | "createdAt">;

export const entriesStore = createStore<FoodEntry[]>("calorie-tracker:entries");

/** YYYY-MM-DD in the user's local time zone. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

export function formatDay(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === shiftDay(todayKey, -1)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function entriesFor(all: FoodEntry[] | null | undefined, date: string): FoodEntry[] {
  return (all ?? []).filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
}

export function totals(entries: FoodEntry[]) {
  return entries.reduce(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein: t.protein + (e.protein ?? 0),
      carbs: t.carbs + (e.carbs ?? 0),
      fat: t.fat + (e.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function addEntry(entry: NewFoodEntry) {
  const all = entriesStore.get() ?? [];
  entriesStore.set([...all, { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }]);
}

export function updateEntry(id: string, changes: NewFoodEntry) {
  const all = entriesStore.get() ?? [];
  entriesStore.set(all.map((e) => (e.id === id ? { ...e, ...changes } : e)));
}

export function deleteEntry(id: string) {
  const all = entriesStore.get() ?? [];
  entriesStore.set(all.filter((e) => e.id !== id));
}
