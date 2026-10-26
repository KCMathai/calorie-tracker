import { DEFAULT_ALERTS, type AlertSettings } from "./alertRules";
import type { NotificationSettings } from "./notifications";

/**
 * Decides which reminders are due right now. Runs on the server when the
 * sheet's hourly check calls /api/notify. Pure logic, no I/O.
 */

export interface DueNotification {
  /** identifies the reminder for today, so it's sent at most once a day */
  key: string;
  title: string;
  body: string;
  url: string;
}

interface Input {
  now: Date;
  settings: NotificationSettings;
  alerts?: AlertSettings | null;
  target?: number;
  /** food entries; only those for today (in the user's time zone) are used */
  entries: { date: string; meal: string; calories: number }[];
  /** keys already sent today */
  alreadySent: string[];
}

/** A reminder may go out during this many hours after its set time (the check runs about hourly). */
const WINDOW_HOURS = 3;

const MEAL_TEXT = {
  breakfast: { emoji: "🍳", label: "Breakfast" },
  lunch: { emoji: "🥗", label: "Lunch" },
  dinner: { emoji: "🍲", label: "Dinner" },
} as const;

/** Local date (YYYY-MM-DD) and hour in a time zone. */
export function localTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

const inWindow = (hour: number, start: number) => hour >= start && hour < start + WINDOW_HOURS;

export function dueNotifications({ now, settings, alerts, target, entries, alreadySent }: Input): DueNotification[] {
  const { date, hour } = localTime(now, settings.timeZone || "UTC");
  const today = entries.filter((e) => e.date === date);
  const sent = new Set(alreadySent);
  const due: DueNotification[] = [];

  for (const meal of ["breakfast", "lunch", "dinner"] as const) {
    const at = settings.meals[meal];
    if (at === null || at === undefined || !inWindow(hour, at)) continue;
    if (today.some((e) => e.meal === meal)) continue; // already logged
    const key = `meal-${meal}`;
    if (sent.has(key)) continue;
    const t = MEAL_TEXT[meal];
    due.push({ key, title: `${t.emoji} ${t.label} reminder`, body: `Nothing logged for ${t.label.toLowerCase()} yet — tap to add it.`, url: "/log" });
  }

  const a = alerts ?? DEFAULT_ALERTS;
  if (settings.underTarget && target && inWindow(hour, a.underHour) && !sent.has("under")) {
    const eaten = Math.round(today.reduce((s, e) => s + (Number(e.calories) || 0), 0));
    if (eaten < (target * a.underPercent) / 100) {
      due.push({
        key: "under",
        title: "🍽️ You haven't eaten enough today",
        body: `${eaten.toLocaleString("en")} of ${target.toLocaleString("en")} kcal so far. Consider a balanced meal or snack.`,
        url: "/",
      });
    }
  }
  return due;
}
