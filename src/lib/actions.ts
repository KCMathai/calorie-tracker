import { alertsStore, type AlertSettings } from "./alerts";
import { dayKey, entriesStore, type FoodEntry, type NewFoodEntry } from "./entries";
import { favoritesStore, findFavorite, type Favorite } from "./favorites";
import { notificationSettingsStore, type NotificationSettings } from "./notifications";
import { waterGoal, waterSettingsStore, waterStore, type WaterDay, type WaterSettings } from "./water";
import { profileStore } from "./profile";
import { enqueue, refreshDailyTotal } from "./sync";
import type { Profile } from "./types";
import { suggestedTarget } from "./calories";
import { sortedWeights, weightsStore, type WeightEntry } from "./weights";
import {
  findMyFoodByName,
  MAX_PHOTOS_PER_FOOD,
  myFoodPhotosStore,
  myFoodsStore,
  type MyFood,
  type MyFoodPhoto,
} from "./myFoods";

// Every change goes through here: update the device copy, then queue it for Google Sheets.

// Food changes also update that day's summary, which is kept forever.

export function addEntry(entry: NewFoodEntry): FoodEntry {
  const full = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
  entriesStore.set([...(entriesStore.get() ?? []), full]);
  enqueue({ type: "upsertEntry", entry: full });
  refreshDailyTotal(full.date);
  return full;
}

export function updateEntry(id: string, changes: NewFoodEntry) {
  const existing = (entriesStore.get() ?? []).find((e) => e.id === id);
  if (!existing) return;
  const updated = { ...existing, ...changes };
  entriesStore.set((entriesStore.get() ?? []).map((e) => (e.id === id ? updated : e)));
  enqueue({ type: "upsertEntry", entry: updated });
  refreshDailyTotal(updated.date);
  if (existing.date !== updated.date) refreshDailyTotal(existing.date);
}

export function deleteEntry(id: string) {
  const existing = (entriesStore.get() ?? []).find((e) => e.id === id);
  entriesStore.set((entriesStore.get() ?? []).filter((e) => e.id !== id));
  enqueue({ type: "deleteEntry", id });
  if (existing) refreshDailyTotal(existing.date);
}

export function saveProfile(profile: Profile) {
  profileStore.set(profile);
  enqueue({ type: "setPref", key: "profile", value: profile });
  refreshDailyTotal(dayKey(new Date())); // today's summary records today's target
}

export function saveAlerts(alerts: AlertSettings) {
  alertsStore.set(alerts);
  enqueue({ type: "setPref", key: "alerts", value: alerts });
}

/**
 * Records a weigh-in, optionally with height (one per day — a second one that
 * day replaces the first). If it's the most recent weigh-in, the profile's
 * weight and height follow it, and the daily target is recalculated unless the
 * user set their own.
 */
export function saveWeight(date: string, weightKg: number, heightCm?: number) {
  const all = weightsStore.get() ?? [];
  const existing = all.find((w) => w.date === date);
  const base = existing ?? { id: crypto.randomUUID(), date, createdAt: Date.now() };
  const weight: WeightEntry = { ...base, weightKg, ...(heightCm !== undefined ? { heightCm } : {}) };
  weightsStore.set(existing ? all.map((w) => (w.id === weight.id ? weight : w)) : [...all, weight]);
  enqueue({ type: "upsertWeight", weight });

  const latest = sortedWeights(weightsStore.get()).at(-1);
  const profile = profileStore.get();
  if (!profile || latest?.id !== weight.id) return;
  const next = { ...profile, weightKg, heightCm: weight.heightCm ?? profile.heightCm };
  if (next.weightKg === profile.weightKg && next.heightCm === profile.heightCm) return;
  saveProfile({
    ...next,
    calorieTarget: profile.customTarget ? profile.calorieTarget : suggestedTarget(next),
  });
}

export function deleteWeight(id: string) {
  weightsStore.set((weightsStore.get() ?? []).filter((w) => w.id !== id));
  enqueue({ type: "deleteWeight", id });
}

// ---------------------------------------------------------------- favourites

function saveFavorites(list: Favorite[]) {
  favoritesStore.set(list);
  enqueue({ type: "setPref", key: "favorites", value: list });
}

/** Stars or un-stars a food. Returns true if it's now a favourite. */
export function toggleFavorite(food: Omit<Favorite, "id" | "createdAt">): boolean {
  const all = favoritesStore.get() ?? [];
  const existing = findFavorite(all, food);
  if (existing) {
    saveFavorites(all.filter((f) => f.id !== existing.id));
    return false;
  }
  const { name, amount, calories, protein, carbs, fat } = food;
  saveFavorites([...all, { id: crypto.randomUUID(), createdAt: Date.now(), name, amount, calories, protein, carbs, fat }]);
  return true;
}

export function removeFavorite(id: string) {
  saveFavorites((favoritesStore.get() ?? []).filter((f) => f.id !== id));
}

// ---------------------------------------------------------------- water

/** Adds (or with a negative amount, removes) water for a day; never goes below zero. */
export function addWater(date: string, ml: number) {
  const all = waterStore.get() ?? [];
  const existing = all.find((w) => w.date === date);
  const goal = waterGoal(waterSettingsStore.get(), profileStore.get());
  const day: WaterDay = { date, ml: Math.max(0, (existing?.ml ?? 0) + ml), goal: existing && date !== dayKey(new Date()) ? existing.goal : goal };
  waterStore.set([...all.filter((w) => w.date !== date), day].sort((a, b) => (a.date < b.date ? -1 : 1)));
  enqueue({ type: "upsertWater", day });
}

export function saveWaterSettings(settings: WaterSettings) {
  waterSettingsStore.set(settings);
  enqueue({ type: "setPref", key: "water", value: settings });
  // Today's row records today's goal.
  const today = dayKey(new Date());
  if ((waterStore.get() ?? []).some((w) => w.date === today)) addWater(today, 0);
}

// ---------------------------------------------------------------- notifications

export function saveNotificationSettings(settings: NotificationSettings) {
  notificationSettingsStore.set(settings);
  enqueue({ type: "setPref", key: "notifications", value: settings });
}

// ---------------------------------------------------------------- taught foods

/** Remembers another photo of a taught food, keeping only the newest few. */
export function addMyFoodPhoto(foodId: string, embedding: string) {
  const photo: MyFoodPhoto = { id: crypto.randomUUID(), foodId, embedding, createdAt: Date.now() };
  const all = [...(myFoodPhotosStore.get() ?? []), photo];
  const forFood = all.filter((p) => p.foodId === foodId).sort((a, b) => a.createdAt - b.createdAt);
  const drop = new Set(forFood.slice(0, Math.max(forFood.length - MAX_PHOTOS_PER_FOOD, 0)).map((p) => p.id));
  myFoodPhotosStore.set(all.filter((p) => !drop.has(p.id)));
  enqueue({ type: "upsertMyFoodPhoto", photo });
  drop.forEach((id) => enqueue({ type: "deleteMyFoodPhoto", id }));
}

/**
 * Teaches the recogniser a food from a photo. If a taught food with the same
 * name exists, the photo becomes another example of it (its nutrition is kept);
 * otherwise a new taught food is created with the details as entered.
 */
export function teachFood(details: Omit<MyFood, "id" | "createdAt">, embedding: string): MyFood {
  let food = findMyFoodByName(myFoodsStore.get(), details.name);
  if (!food) {
    food = { ...details, name: details.name.trim(), id: crypto.randomUUID(), createdAt: Date.now() };
    myFoodsStore.set([...(myFoodsStore.get() ?? []), food]);
    enqueue({ type: "upsertMyFood", food });
  }
  addMyFoodPhoto(food.id, embedding);
  return food;
}

export function updateMyFood(food: MyFood) {
  myFoodsStore.set((myFoodsStore.get() ?? []).map((f) => (f.id === food.id ? food : f)));
  enqueue({ type: "upsertMyFood", food });
}

export function deleteMyFood(id: string) {
  myFoodsStore.set((myFoodsStore.get() ?? []).filter((f) => f.id !== id));
  myFoodPhotosStore.set((myFoodPhotosStore.get() ?? []).filter((p) => p.foodId !== id));
  enqueue({ type: "deleteMyFood", id }); // the script also deletes the food's photos
}
