import { useSyncExternalStore } from "react";
import { alertsStore, type AlertSettings } from "./alerts";
import { dailyTotalsStore, sameTotal, summarize, type DailyTotal } from "./dailyTotals";
import { dayKey, entriesStore, LOG_RETENTION_DAYS, shiftDay, withinRetention, type FoodEntry, type Meal } from "./entries";
import { myFoodPhotosStore, myFoodsStore, type MyFood, type MyFoodPhoto } from "./myFoods";
import { profileStore } from "./profile";
import { createStore } from "./store";
import type { Profile } from "./types";
import { weightsStore, type WeightEntry } from "./weights";

/**
 * Sync with Google Sheets.
 *
 * Every change is applied to the device copy immediately and added to an
 * "outbox". The outbox is sent to /api/sync, which relays it to the sheet and
 * returns the sheet's full contents. Once nothing is waiting to be sent, the
 * sheet's contents replace the device copy — the sheet is the source of truth.
 *
 * Newer kinds of data need a newer Apps Script. The script lists what it
 * supports; changes it can't store yet wait on the device until it's updated.
 */

export type SyncOp =
  | { type: "setPref"; key: "profile"; value: Profile }
  | { type: "setPref"; key: "alerts"; value: AlertSettings }
  | { type: "upsertEntry"; entry: FoodEntry }
  | { type: "deleteEntry"; id: string }
  | { type: "upsertWeight"; weight: WeightEntry }
  | { type: "deleteWeight"; id: string }
  | { type: "upsertMyFood"; food: MyFood }
  | { type: "deleteMyFood"; id: string }
  | { type: "upsertMyFoodPhoto"; photo: MyFoodPhoto }
  | { type: "deleteMyFoodPhoto"; id: string }
  | { type: "upsertDailyTotal"; total: DailyTotal }
  | { type: "deleteDailyTotal"; date: string };

type QueuedOp = SyncOp & { opId?: string };

type Row = Record<string, string | number>;

/** Things a newer Apps Script can store. */
type Feature = "myFoods" | "dailyTotals" | "height";

interface SheetState {
  ok: true;
  /** what this script version supports (absent before version 3) */
  features?: Feature[];
  prefs: { profile?: Profile; alerts?: AlertSettings };
  entries: Row[];
  weights?: Row[];
  dailyTotals?: Row[];
  myFoods?: Row[];
  myFoodPhotos?: Row[];
}

/** The feature an operation needs, if any. */
function featureOf(op: SyncOp): Feature | null {
  switch (op.type) {
    case "upsertMyFood":
    case "deleteMyFood":
    case "upsertMyFoodPhoto":
    case "deleteMyFoodPhoto":
      return "myFoods";
    case "upsertDailyTotal":
    case "deleteDailyTotal":
      return "dailyTotals";
    case "upsertWeight":
      // Older scripts would silently drop the height, so hold back weigh-ins that have one.
      return op.weight.heightCm !== undefined ? "height" : null;
    default:
      return null;
  }
}

const outboxStore = createStore<QueuedOp[]>("calorie-tracker:outbox");
/** Set after the first successful sync, when local data has been uploaded. */
const linkedStore = createStore<boolean>("calorie-tracker:sheets-linked");
/** What the deployed Apps Script supports, from its last answer (null = not known yet). */
const sheetFeaturesStore = createStore<Feature[]>("calorie-tracker:sheet-features");
export const passcodeStore = createStore<string>("calorie-tracker:passcode");
/** Whether this device has been unlocked with the passcode (see AuthGate). */
export const unlockedStore = createStore<boolean>("calorie-tracker:unlocked");

export const usePendingCount = () => outboxStore.useValue()?.length ?? 0;

function supports(feature: Feature) {
  return (sheetFeaturesStore.get() ?? []).includes(feature);
}

/** True when some changes are waiting because the Google script is an older version. */
export function useSheetNeedsScriptUpdate() {
  const outbox = outboxStore.useValue();
  const features = sheetFeaturesStore.useValue();
  if (!features) return false;
  return (outbox ?? []).some((op) => {
    const f = featureOf(op);
    return f !== null && !features.includes(f);
  });
}

// ---------------------------------------------------------------- status

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "not_configured" | "bad_passcode" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSynced?: number;
  error?: string;
}

let status: SyncStatus = { state: "idle" };
const statusListeners = new Set<() => void>();

function setStatus(next: Omit<SyncStatus, "lastSynced"> & { lastSynced?: number }) {
  status = { lastSynced: status.lastSynced, ...next };
  statusListeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => status,
    () => status,
  );
}

// ---------------------------------------------------------------- outbox

const newOpId = () => crypto.randomUUID();

export function enqueue(op: SyncOp) {
  outboxStore.set([...(outboxStore.get() ?? []), { ...op, opId: newOpId() }]);
  void syncNow();
}

function queue(ops: SyncOp[]) {
  if (ops.length) outboxStore.set([...(outboxStore.get() ?? []), ...ops.map((op) => ({ ...op, opId: newOpId() }))]);
}

/** Changes the outbox doesn't send yet are still waiting for these. */
export function hasPendingChanges() {
  return (outboxStore.get() ?? []).length > 0;
}

let inFlight: Promise<void> | null = null;
let runAgain = false;

/** Sends pending changes and pulls the latest data. Safe to call often. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    runAgain = true;
    return inFlight;
  }
  inFlight = run().finally(() => {
    inFlight = null;
    if (runAgain) {
      runAgain = false;
      void syncNow();
    }
  });
  return inFlight;
}

function withoutOpId(op: QueuedOp): SyncOp {
  const copy = { ...op };
  delete copy.opId;
  return copy;
}

/** Ops the deployed script can accept right now. */
function sendable(ops: QueuedOp[]): QueuedOp[] {
  return ops.filter((op) => {
    const f = featureOf(op);
    return f === null || supports(f);
  });
}

async function run() {
  if (!navigator.onLine) {
    setStatus({ state: "offline" });
    return;
  }
  // Older outbox entries may lack an id; give them one so they can be removed precisely.
  let outbox = outboxStore.get() ?? [];
  if (outbox.some((op) => !op.opId)) {
    outbox = outbox.map((op) => (op.opId ? op : { ...op, opId: newOpId() }));
    outboxStore.set(outbox);
  }
  const ops = sendable(outbox);
  setStatus({ state: "syncing" });

  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-passcode": passcodeStore.get() ?? "" },
      body: JSON.stringify({ ops: ops.map(withoutOpId) }),
    });
  } catch {
    setStatus({ state: "offline" });
    return;
  }
  const data = (await res.json().catch(() => null)) as SheetState | { ok: false; error: string } | null;

  if (!data || !data.ok) {
    const error = data && !data.ok ? data.error : "unexpected_response";
    if (error === "not_configured") {
      // No sheet yet: the device copy is all there is. Everything local is
      // uploaded on the first successful sync, so queued changes aren't needed.
      outboxStore.set([]);
      setStatus({ state: "not_configured" });
    } else if (error === "bad_passcode") {
      // The passcode changed on the server: lock this device until the new one is entered.
      unlockedStore.set(false);
      setStatus({ state: "bad_passcode" });
    } else {
      setStatus({ state: "error", error });
    }
    return;
  }

  // Drop exactly the ops that were sent (newer ones may have been queued meanwhile).
  const sentIds = new Set(ops.map((op) => op.opId));
  outboxStore.set((outboxStore.get() ?? []).filter((op) => !sentIds.has(op.opId)));

  const before = sheetFeaturesStore.get() ?? [];
  const features = new Set<Feature>(data.features ?? []);
  if (Array.isArray(data.myFoods)) features.add("myFoods"); // script version 2 had taught foods but no list
  const now = [...features];
  sheetFeaturesStore.set(now);
  const added = now.filter((f) => !before.includes(f));

  if (!linkedStore.get()) {
    queueLocalDataMissingFrom(data);
    linkedStore.set(true);
  } else {
    // Upload what was kept on this device while the script couldn't store it.
    if (added.includes("myFoods")) queueLocalMyFoodsMissingFrom(data);
    if (added.includes("dailyTotals")) queueLocalDailyTotalsMissingFrom(data);
    if (added.includes("height")) {
      const queued = new Set((outboxStore.get() ?? []).flatMap((op) => (op.type === "upsertWeight" ? [op.weight.id] : [])));
      queue(
        (weightsStore.get() ?? [])
          .filter((w) => w.heightCm !== undefined && !queued.has(w.id))
          .map((weight) => ({ type: "upsertWeight", weight })),
      );
    }
  }

  const remaining = outboxStore.get() ?? [];
  if (sendable(remaining).length > 0) {
    runAgain = true;
  } else {
    const waiting = (f: Feature) => remaining.some((op) => featureOf(op) === f);
    applySheetState(data, {
      myFoods: supports("myFoods") && !waiting("myFoods"),
      dailyTotals: supports("dailyTotals") && !waiting("dailyTotals"),
      height: supports("height") && !waiting("height"),
    });
    // Changes still waiting (for a script update) must survive the sheet's copy replacing ours.
    replayOnDevice(remaining);
    reconcileDailyTotals();
  }

  setStatus({ state: "synced", lastSynced: Date.now() });
}

/** First connection: upload anything on this device that the sheet doesn't have. */
function queueLocalDataMissingFrom(sheet: SheetState) {
  const ops: SyncOp[] = [];
  const profile = profileStore.get();
  const alerts = alertsStore.get();
  if (profile && !sheet.prefs.profile) ops.push({ type: "setPref", key: "profile", value: profile });
  if (alerts && !sheet.prefs.alerts) ops.push({ type: "setPref", key: "alerts", value: alerts });
  const sheetIds = new Set(sheet.entries.map((e) => String(e.id)));
  for (const entry of withinRetention(entriesStore.get() ?? [], dayKey(new Date()))) {
    if (!sheetIds.has(entry.id)) ops.push({ type: "upsertEntry", entry });
  }
  const sheetWeightIds = new Set((sheet.weights ?? []).map((w) => String(w.id)));
  for (const weight of weightsStore.get() ?? []) {
    if (!sheetWeightIds.has(weight.id)) ops.push({ type: "upsertWeight", weight });
  }
  queue(ops);
  queueLocalMyFoodsMissingFrom(sheet);
  queueLocalDailyTotalsMissingFrom(sheet);
}

/** Uploads taught foods that only exist on this device. */
function queueLocalMyFoodsMissingFrom(sheet: SheetState) {
  // Skip anything already waiting in the outbox.
  const foodIds = new Set((sheet.myFoods ?? []).map((f) => String(f.id)));
  const photoIds = new Set((sheet.myFoodPhotos ?? []).map((p) => String(p.id)));
  for (const op of outboxStore.get() ?? []) {
    if (op.type === "upsertMyFood") foodIds.add(op.food.id);
    if (op.type === "upsertMyFoodPhoto") photoIds.add(op.photo.id);
  }
  const ops: SyncOp[] = [];
  for (const food of myFoodsStore.get() ?? []) {
    if (!foodIds.has(food.id)) ops.push({ type: "upsertMyFood", food });
  }
  for (const photo of myFoodPhotosStore.get() ?? []) {
    if (!photoIds.has(photo.id)) ops.push({ type: "upsertMyFoodPhoto", photo });
  }
  queue(ops);
}

/** Uploads daily totals that only exist on this device. */
function queueLocalDailyTotalsMissingFrom(sheet: SheetState) {
  const dates = new Set((sheet.dailyTotals ?? []).map((t) => String(t.date)));
  for (const op of outboxStore.get() ?? []) if (op.type === "upsertDailyTotal") dates.add(op.total.date);
  queue((dailyTotalsStore.get() ?? []).filter((t) => !dates.has(t.date)).map((total) => ({ type: "upsertDailyTotal", total })));
}

// ---------------------------------------------------------------- daily totals

/**
 * Brings the stored summary for `date` in line with its food entries. Past days
 * keep the target they were recorded with; today uses the current target.
 */
export function refreshDailyTotal(date: string) {
  const all = dailyTotalsStore.get() ?? [];
  const existing = all.find((t) => t.date === date);
  const today = dayKey(new Date());
  const target = date === today || !existing ? (profileStore.get()?.calorieTarget ?? existing?.target ?? 0) : existing.target;
  const next = summarize(date, entriesStore.get(), target);
  if (sameTotal(existing, next)) return;
  if (next) {
    dailyTotalsStore.set([...all.filter((t) => t.date !== date), next].sort((a, b) => (a.date < b.date ? -1 : 1)));
    enqueue({ type: "upsertDailyTotal", total: next });
  } else {
    dailyTotalsStore.set(all.filter((t) => t.date !== date));
    enqueue({ type: "deleteDailyTotal", date });
  }
}

/**
 * Makes sure every day that still has food entries (the last 30 days) has an
 * up-to-date summary. Older days are never touched: their meals are gone, but
 * their summaries are kept forever.
 */
export function reconcileDailyTotals() {
  const today = dayKey(new Date());
  const cutoff = shiftDay(today, -LOG_RETENTION_DAYS);
  const dates = new Set<string>();
  for (const e of entriesStore.get() ?? []) if (e.date >= cutoff) dates.add(e.date);
  for (const t of dailyTotalsStore.get() ?? []) if (t.date >= cutoff) dates.add(t.date);
  dates.forEach(refreshDailyTotal);
}

// ---------------------------------------------------------------- applying the sheet

function applySheetState(sheet: SheetState, include: { myFoods: boolean; dailyTotals: boolean; height: boolean }) {
  setIfChanged(profileStore, sheet.prefs.profile ?? null);
  setIfChanged(alertsStore, sheet.prefs.alerts ?? null);
  const entries = sheet.entries.map(toEntry).filter((e): e is FoodEntry => e !== null);
  setIfChanged(entriesStore, withinRetention(entries, dayKey(new Date())));

  let weights = (sheet.weights ?? []).map(toWeight).filter((w): w is WeightEntry => w !== null);
  if (!include.height) {
    // The sheet can't store heights yet: keep the ones recorded on this device.
    const local = new Map((weightsStore.get() ?? []).map((w) => [w.id, w.heightCm]));
    weights = weights.map((w) => (local.get(w.id) !== undefined ? { ...w, heightCm: local.get(w.id) } : w));
  }
  setIfChanged(weightsStore, weights);

  if (include.dailyTotals) {
    setIfChanged(
      dailyTotalsStore,
      (sheet.dailyTotals ?? [])
        .map(toDailyTotal)
        .filter((t): t is DailyTotal => t !== null)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    );
  }
  if (include.myFoods) {
    setIfChanged(myFoodsStore, (sheet.myFoods ?? []).map(toMyFood).filter((f): f is MyFood => f !== null));
    setIfChanged(myFoodPhotosStore, (sheet.myFoodPhotos ?? []).map(toMyFoodPhoto).filter((p): p is MyFoodPhoto => p !== null));
  }
}

/** Re-applies queued changes to the device copy (after it was replaced by the sheet's). */
function replayOnDevice(ops: SyncOp[]) {
  if (ops.length === 0) return;
  const upsert = <T,>(list: T[] | null, item: T, same: (a: T) => boolean) => [...(list ?? []).filter((x) => !same(x)), item];
  const remove = <T,>(list: T[] | null, same: (a: T) => boolean) => (list ?? []).filter((x) => !same(x));
  let entries = entriesStore.get();
  let weights = weightsStore.get();
  let totals = dailyTotalsStore.get();
  let foods = myFoodsStore.get();
  let photos = myFoodPhotosStore.get();
  let profile = profileStore.get();
  let alerts = alertsStore.get();
  for (const op of ops) {
    switch (op.type) {
      case "setPref":
        if (op.key === "profile") profile = op.value;
        else alerts = op.value;
        break;
      case "upsertEntry":
        entries = upsert(entries, op.entry, (e) => e.id === op.entry.id);
        break;
      case "deleteEntry":
        entries = remove(entries, (e) => e.id === op.id);
        break;
      case "upsertWeight":
        weights = upsert(weights, op.weight, (w) => w.id === op.weight.id);
        break;
      case "deleteWeight":
        weights = remove(weights, (w) => w.id === op.id);
        break;
      case "upsertDailyTotal":
        totals = upsert(totals, op.total, (t) => t.date === op.total.date);
        break;
      case "deleteDailyTotal":
        totals = remove(totals, (t) => t.date === op.date);
        break;
      case "upsertMyFood":
        foods = upsert(foods, op.food, (f) => f.id === op.food.id);
        break;
      case "deleteMyFood":
        foods = remove(foods, (f) => f.id === op.id);
        photos = remove(photos, (p) => p.foodId === op.id);
        break;
      case "upsertMyFoodPhoto":
        photos = upsert(photos, op.photo, (p) => p.id === op.photo.id);
        break;
      case "deleteMyFoodPhoto":
        photos = remove(photos, (p) => p.id === op.id);
        break;
    }
  }
  setIfChanged(entriesStore, entries);
  setIfChanged(weightsStore, weights);
  setIfChanged(dailyTotalsStore, totals ? [...totals].sort((a, b) => (a.date < b.date ? -1 : 1)) : totals);
  setIfChanged(myFoodsStore, foods);
  setIfChanged(myFoodPhotosStore, photos);
  setIfChanged(profileStore, profile);
  setIfChanged(alertsStore, alerts);
}

const num = (v: string | number | undefined) => (v === undefined || v === "" ? undefined : Number(v));

function toWeight(row: Row): WeightEntry | null {
  const kg = Number(row.weightKg);
  if (!row.id || !row.date || !Number.isFinite(kg)) return null;
  const heightCm = num(row.heightCm);
  return {
    id: String(row.id),
    date: String(row.date),
    weightKg: kg,
    createdAt: Number(row.createdAt) || 0,
    ...(heightCm !== undefined && Number.isFinite(heightCm) ? { heightCm } : {}),
  };
}

function toEntry(row: Row): FoodEntry | null {
  if (!row.id || !row.date || !row.name || row.calories === undefined) return null;
  return {
    id: String(row.id),
    date: String(row.date),
    meal: String(row.meal || "snacks") as Meal,
    name: String(row.name),
    amount: row.amount ? String(row.amount) : undefined,
    calories: Number(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    createdAt: Number(row.createdAt) || 0,
  };
}

function toDailyTotal(row: Row): DailyTotal | null {
  if (!row.date || row.calories === undefined) return null;
  return {
    date: String(row.date),
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    target: Number(row.target) || 0,
    entries: Number(row.entries) || 0,
  };
}

function toMyFood(row: Row): MyFood | null {
  if (!row.id || !row.name || row.calories === undefined) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    serving: row.serving ? String(row.serving) : "1 serving",
    calories: Number(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    createdAt: Number(row.createdAt) || 0,
  };
}

function toMyFoodPhoto(row: Row): MyFoodPhoto | null {
  if (!row.id || !row.foodId || !row.embedding) return null;
  return { id: String(row.id), foodId: String(row.foodId), embedding: String(row.embedding), createdAt: Number(row.createdAt) || 0 };
}

function setIfChanged<T>(store: { get: () => T | null; set: (v: T | null) => void }, value: T | null) {
  if (JSON.stringify(store.get()) !== JSON.stringify(value)) store.set(value);
}

/** Removes food logs older than the retention window from this device (their daily totals stay). */
export function pruneLocalLogs() {
  const all = entriesStore.get();
  if (!all) return;
  setIfChanged(entriesStore, withinRetention(all, dayKey(new Date())));
}

// ---------------------------------------------------------------- locking

/** Every key this app stores, except the cached-model flag (the models themselves are just files). */
const KEEP_ON_LOCK = new Set(["calorie-tracker:food-model-ready"]);

/**
 * Locks the app on this device and removes its copy of your data (it stays in
 * your Google Sheet). Refuses while changes are still waiting to be sent.
 */
export function lockAndClearDevice(): boolean {
  if (hasPendingChanges()) return false;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("calorie-tracker:") && !KEEP_ON_LOCK.has(k)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  // Tell every open view (stores cache their last value).
  [
    profileStore,
    alertsStore,
    entriesStore,
    weightsStore,
    dailyTotalsStore,
    myFoodsStore,
    myFoodPhotosStore,
    outboxStore,
    linkedStore,
    sheetFeaturesStore,
    passcodeStore,
    unlockedStore,
  ].forEach((s) => (s as { set: (v: null) => void }).set(null));
  setStatus({ state: "idle" });
  return true;
}
