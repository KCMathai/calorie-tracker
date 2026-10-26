import { createStore } from "./store";

/** Which reminders to send as phone notifications. Shared by all your devices. */
export interface NotificationSettings {
  /** Remind at these hours (0–23) if nothing is logged for that meal yet; null = off. */
  meals: { breakfast: number | null; lunch: number | null; dinner: number | null };
  /** Evening "you haven't eaten enough" reminder, using the alert time and % from Settings → Alerts. */
  underTarget: boolean;
  /** IANA time zone the hours refer to, e.g. "Asia/Kolkata". */
  timeZone: string;
}

export const DEFAULT_NOTIFICATIONS: Omit<NotificationSettings, "timeZone"> = {
  meals: { breakfast: 9, lunch: 14, dinner: 20 },
  underTarget: true,
};

/** A device's push subscription, saved in the sheet as preference `push-<deviceId>`. */
export interface PushRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device: string;
  createdAt: number;
}

export const notificationSettingsStore = createStore<NotificationSettings>("calorie-tracker:notifications");
/** Random id for this device, so each device has its own subscription. */
export const deviceIdStore = createStore<string>("calorie-tracker:device-id");
