import { useSyncExternalStore } from "react";
import { alertsStore, type AlertSettings } from "./alerts";
import { dayKey, entriesStore, withinRetention, type FoodEntry, type Meal } from "./entries";
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
  | { type: "deleteMyFoodPhoto"; id: string };

type QueuedOp = SyncOp & { opId?: string };

type Row = Record<string, string | number>;

interface SheetState {
  ok: true;
  prefs: { profile?: Profile; alerts?: AlertSettings };
  entries: Row[];
  weights?: Row[];
  /** Only present once the owner has deployed the Apps Script version with taught foods. */
  myFoods?: Row[];
  myFoodPhotos?: Row[];
}

const MY_FOOD_OPS = new Set<SyncOp["type"]>(["upsertMyFood", "deleteMyFood", "upsertMyFoodPhoto", "deleteMyFoodPhoto"]);
const isMyFoodOp = (op: SyncOp) => MY_FOOD_OPS.has(op.type);

const outboxStore = createStore<QueuedOp[]>("calorie-tracker:outbox");
/** Set after the first successful sync, when local data has been uploaded. */
const linkedStore = createStore<boolean>("calorie-tracker:sheets-linked");
/** Whether the deployed Apps Script knows about taught foods (older versions reject those changes). */
const myFoodsSupportStore = createStore<boolean>("calorie-tracker:sheet-has-my-foods");
export const passcodeStore = createStore<string>("calorie-tracker:passcode");

export const usePendingCount = () => outboxStore.useValue()?.length ?? 0;

/** True when taught foods are waiting because the Google script is an older version. */
export function useSheetNeedsScriptUpdate() {
  const outbox = outboxStore.useValue();
  const supported = myFoodsSupportStore.useValue();
  return supported === false && (outbox ?? []).some(isMyFoodOp);
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

/** Ops the deployed script can accept right now. Taught-food ops wait until it's known to support them. */
function sendable(ops: QueuedOp[]): QueuedOp[] {
  return myFoodsSupportStore.get() === true ? ops : ops.filter((op) => !isMyFoodOp(op));
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
      setStatus({ state: "bad_passcode" });
    } else {
      setStatus({ state: "error", error });
    }
    return;
  }

  // Drop exactly the ops that were sent (newer ones may have been queued meanwhile).
  const sentIds = new Set(ops.map((op) => op.opId));
  outboxStore.set((outboxStore.get() ?? []).filter((op) => !sentIds.has(op.opId)));

  const supportsMyFoods = Array.isArray(data.myFoods);
  const newlySupported = supportsMyFoods && myFoodsSupportStore.get() !== true;
  myFoodsSupportStore.set(supportsMyFoods);

  if (!linkedStore.get()) {
    queueLocalDataMissingFrom(data);
    linkedStore.set(true);
  } else if (newlySupported) {
    queueLocalMyFoodsMissingFrom(data);
  }

  const remaining = outboxStore.get() ?? [];
  if (sendable(remaining).length > 0) {
    runAgain = true;
  } else {
    // Taught foods still waiting for a script update must not be overwritten by the sheet's (empty) copy.
    applySheetState(data, { myFoods: supportsMyFoods && !remaining.some(isMyFoodOp) });
  }

  setStatus({ state: "synced", lastSynced: Date.now() });
}

function queue(ops: SyncOp[]) {
  if (ops.length) outboxStore.set([...(outboxStore.get() ?? []), ...ops.map((op) => ({ ...op, opId: newOpId() }))]);
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
  if (Array.isArray(sheet.myFoods)) queueLocalMyFoodsMissingFrom(sheet);
}

/** Uploads taught foods that only exist on this device (e.g. taught before the script was updated). */
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

function applySheetState(sheet: SheetState, include: { myFoods: boolean }) {
  setIfChanged(profileStore, sheet.prefs.profile ?? null);
  setIfChanged(alertsStore, sheet.prefs.alerts ?? null);
  const entries = sheet.entries.map(toEntry).filter((e): e is FoodEntry => e !== null);
  setIfChanged(entriesStore, withinRetention(entries, dayKey(new Date())));
  const weights = (sheet.weights ?? []).map(toWeight).filter((w): w is WeightEntry => w !== null);
  setIfChanged(weightsStore, weights);
  if (include.myFoods) {
    setIfChanged(myFoodsStore, (sheet.myFoods ?? []).map(toMyFood).filter((f): f is MyFood => f !== null));
    setIfChanged(myFoodPhotosStore, (sheet.myFoodPhotos ?? []).map(toMyFoodPhoto).filter((p): p is MyFoodPhoto => p !== null));
  }
}

const num = (v: string | number | undefined) => (v === undefined || v === "" ? undefined : Number(v));

function toWeight(row: Row): WeightEntry | null {
  const kg = Number(row.weightKg);
  if (!row.id || !row.date || !Number.isFinite(kg)) return null;
  return { id: String(row.id), date: String(row.date), weightKg: kg, createdAt: Number(row.createdAt) || 0 };
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

/** Removes food logs older than the retention window from this device. */
export function pruneLocalLogs() {
  const all = entriesStore.get();
  if (!all) return;
  setIfChanged(entriesStore, withinRetention(all, dayKey(new Date())));
}
