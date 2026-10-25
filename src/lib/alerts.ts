import { createStore } from "./store";

export interface AlertSettings {
  /** Hour of the day (0–23) after which the "under target" banner can appear. */
  underHour: number;
  /** Show the banner when eaten calories are below this % of the target. */
  underPercent: number;
}

export const DEFAULT_ALERTS: AlertSettings = { underHour: 20, underPercent: 70 };

export const alertsStore = createStore<AlertSettings>("calorie-tracker:alerts");

export type AlertStatus =
  | { kind: "over"; by: number }
  | { kind: "under"; eaten: number; target: number }
  | null;

export function alertStatus(eaten: number, target: number, hour: number, settings: AlertSettings): AlertStatus {
  if (eaten > target) return { kind: "over", by: eaten - target };
  if (hour >= settings.underHour && eaten < (target * settings.underPercent) / 100) {
    return { kind: "under", eaten, target };
  }
  return null;
}
