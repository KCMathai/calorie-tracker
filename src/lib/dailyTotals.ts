import { entriesFor, totals, type FoodEntry } from "./entries";
import { createStore } from "./store";

/**
 * One summary row per day, kept forever (individual meals are deleted after 30
 * days). `target` is the daily target that applied that day.
 */
export interface DailyTotal {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  target: number;
  /** number of foods logged that day */
  entries: number;
}

export const dailyTotalsStore = createStore<DailyTotal[]>("calorie-tracker:daily-totals");

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The summary a day's food entries add up to, or null if nothing is logged that day. */
export function summarize(date: string, all: FoodEntry[] | null | undefined, target: number): DailyTotal | null {
  const items = entriesFor(all, date);
  if (items.length === 0) return null;
  const t = totals(items);
  return {
    date,
    calories: Math.round(t.calories),
    protein: round1(t.protein),
    carbs: round1(t.carbs),
    fat: round1(t.fat),
    target,
    entries: items.length,
  };
}

export function sameTotal(a: DailyTotal | undefined | null, b: DailyTotal | undefined | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
