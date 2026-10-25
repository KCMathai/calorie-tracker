export type Sex = "female" | "male";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type Goal = "lose" | "maintain" | "gain";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  /** The daily target the app uses: either the suggestion or the user's own number. */
  calorieTarget: number;
  /** True when the user typed their own target instead of using the suggestion. */
  customTarget: boolean;
}
