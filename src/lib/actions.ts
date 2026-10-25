import { alertsStore, type AlertSettings } from "./alerts";
import { entriesStore, type NewFoodEntry } from "./entries";
import { profileStore } from "./profile";
import { enqueue } from "./sync";
import type { Profile } from "./types";

// Every change goes through here: update the device copy, then queue it for Google Sheets.

export function addEntry(entry: NewFoodEntry) {
  const full = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
  entriesStore.set([...(entriesStore.get() ?? []), full]);
  enqueue({ type: "upsertEntry", entry: full });
}

export function updateEntry(id: string, changes: NewFoodEntry) {
  const existing = (entriesStore.get() ?? []).find((e) => e.id === id);
  if (!existing) return;
  const updated = { ...existing, ...changes };
  entriesStore.set((entriesStore.get() ?? []).map((e) => (e.id === id ? updated : e)));
  enqueue({ type: "upsertEntry", entry: updated });
}

export function deleteEntry(id: string) {
  entriesStore.set((entriesStore.get() ?? []).filter((e) => e.id !== id));
  enqueue({ type: "deleteEntry", id });
}

export function saveProfile(profile: Profile) {
  profileStore.set(profile);
  enqueue({ type: "setPref", key: "profile", value: profile });
}

export function saveAlerts(alerts: AlertSettings) {
  alertsStore.set(alerts);
  enqueue({ type: "setPref", key: "alerts", value: alerts });
}
