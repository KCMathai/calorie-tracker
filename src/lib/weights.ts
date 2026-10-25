import { createStore } from "./store";

/** One weigh-in per day. Kept forever (unlike food logs). */
export interface WeightEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  weightKg: number;
  createdAt: number;
}

export const weightsStore = createStore<WeightEntry[]>("calorie-tracker:weights");

export const WEIGHT_LIMITS = { min: 30, max: 300 };

export function sortedWeights(all: WeightEntry[] | null | undefined): WeightEntry[] {
  return [...(all ?? [])].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}
