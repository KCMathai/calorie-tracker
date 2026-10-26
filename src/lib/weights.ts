import { createStore } from "./store";

/** One weigh-in per day. Kept forever (unlike food logs). */
export interface WeightEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  weightKg: number;
  /** optional; recorded alongside the weigh-in and kept forever */
  heightCm?: number;
  createdAt: number;
}

export const weightsStore = createStore<WeightEntry[]>("calorie-tracker:weights");

export const WEIGHT_LIMITS = { min: 30, max: 300 };
export const HEIGHT_LIMITS = { min: 100, max: 250 };

/** Most recent height recorded with a weigh-in, if any. */
export function latestHeight(sorted: WeightEntry[]): number | undefined {
  for (let i = sorted.length - 1; i >= 0; i--) if (sorted[i].heightCm !== undefined) return sorted[i].heightCm;
  return undefined;
}

/** Body-mass index with the standard adult category (WHO). An estimate, not a diagnosis. */
export function bmi(weightKg: number, heightCm: number) {
  const value = weightKg / (heightCm / 100) ** 2;
  const category = value < 18.5 ? "Underweight" : value < 25 ? "Healthy range" : value < 30 ? "Overweight" : "Obese";
  return { value: Math.round(value * 10) / 10, category };
}

export function sortedWeights(all: WeightEntry[] | null | undefined): WeightEntry[] {
  return [...(all ?? [])].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}
