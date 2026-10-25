import type { ActivityLevel, Goal, Sex } from "./types";

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { value: "sedentary", label: "Sedentary", hint: "Desk job, little exercise", factor: 1.2 },
  { value: "light", label: "Lightly active", hint: "Exercise 1–3 days a week", factor: 1.375 },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3–5 days a week", factor: 1.55 },
  { value: "active", label: "Very active", hint: "Hard exercise 6–7 days a week", factor: 1.725 },
  { value: "very_active", label: "Extra active", hint: "Physical job plus training", factor: 1.9 },
];

export const GOAL_OPTIONS: { value: Goal; label: string; hint: string; adjust: number }[] = [
  { value: "lose", label: "Lose weight", hint: "About 0.5 kg per week", adjust: -500 },
  { value: "maintain", label: "Maintain", hint: "Stay where you are", adjust: 0 },
  { value: "gain", label: "Gain weight", hint: "Slow, lean gain", adjust: 300 },
];

/** Commonly cited minimums for unsupervised diets. */
export const MIN_SAFE_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

/** Basal metabolic rate (calories burned at rest), Mifflin-St Jeor equation. */
export function bmr(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function suggestedTarget(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}): number {
  const factor = ACTIVITY_OPTIONS.find((a) => a.value === input.activity)!.factor;
  const adjust = GOAL_OPTIONS.find((g) => g.value === input.goal)!.adjust;
  const maintenance = bmr(input.sex, input.age, input.heightCm, input.weightKg) * factor;
  const target = Math.max(maintenance + adjust, MIN_SAFE_CALORIES[input.sex]);
  return Math.round(target / 10) * 10;
}
