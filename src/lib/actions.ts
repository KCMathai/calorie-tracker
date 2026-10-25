import { alertsStore, type AlertSettings } from "./alerts";
import { entriesStore, type NewFoodEntry } from "./entries";
import { profileStore } from "./profile";
import { enqueue } from "./sync";
import type { Profile } from "./types";
import { suggestedTarget } from "./calories";
import { sortedWeights, weightsStore, type WeightEntry } from "./weights";

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

/**
 * Records a weigh-in (one per day — a second one that day replaces the first).
 * If it's the most recent weigh-in, the profile weight follows it, and the daily
 * target is recalculated unless the user set their own.
 */
export function saveWeight(date: string, weightKg: number) {
  const all = weightsStore.get() ?? [];
  const existing = all.find((w) => w.date === date);
  const weight: WeightEntry = existing
    ? { ...existing, weightKg }
    : { id: crypto.randomUUID(), date, weightKg, createdAt: Date.now() };
  weightsStore.set(existing ? all.map((w) => (w.id === weight.id ? weight : w)) : [...all, weight]);
  enqueue({ type: "upsertWeight", weight });

  const latest = sortedWeights(weightsStore.get()).at(-1);
  const profile = profileStore.get();
  if (profile && latest?.id === weight.id && profile.weightKg !== weightKg) {
    saveProfile({
      ...profile,
      weightKg,
      calorieTarget: profile.customTarget ? profile.calorieTarget : suggestedTarget({ ...profile, weightKg }),
    });
  }
}

export function deleteWeight(id: string) {
  weightsStore.set((weightsStore.get() ?? []).filter((w) => w.id !== id));
  enqueue({ type: "deleteWeight", id });
}
