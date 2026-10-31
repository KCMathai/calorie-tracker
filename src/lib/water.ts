import { createStore } from "./store";
import type { Profile } from "./types";

/** Water drunk on one day. One row per day, kept forever. */
export interface WaterDay {
  date: string;
  ml: number;
  /** the goal that applied that day */
  goal: number;
}

export interface WaterSettings {
  goalMl: number;
}

export const waterStore = createStore<WaterDay[]>("calorie-tracker:water");
export const waterSettingsStore = createStore<WaterSettings>("calorie-tracker:water-settings");

export const WATER_LIMITS = { min: 500, max: 6000 };
export const WATER_BUTTONS = [
  { ml: 150, label: "Cup", emoji: "☕" },
  { ml: 250, label: "Glass", emoji: "🥛" },
  { ml: 500, label: "Bottle", emoji: "🧴" },
];

/**
 * A common rule of thumb: about 35 ml per kg of body weight, rounded to 50 ml
 * (kept between 1.5 and 4 litres). A starting point, not medical advice.
 */
export function suggestedWaterGoal(profile: Profile | null | undefined): number {
  const raw = (profile?.weightKg ?? 65) * 35;
  return Math.min(4000, Math.max(1500, Math.round(raw / 50) * 50));
}

export function waterGoal(settings: WaterSettings | null | undefined, profile: Profile | null | undefined) {
  return settings?.goalMl ?? suggestedWaterGoal(profile);
}

export function formatMl(ml: number) {
  return ml >= 1000 ? `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L` : `${ml} ml`;
}
