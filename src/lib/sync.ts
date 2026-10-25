import { useSyncExternalStore } from "react";
import { alertsStore, type AlertSettings } from "./alerts";
import { dayKey, entriesStore, withinRetention, type FoodEntry, type Meal } from "./entries";
import { profileStore } from "./profile";
import { createStore } from "./store";
import type { Profile } from "./types";
import { weightsStore, type WeightEntry } from "./weights";

/**
 * Sync with Google Sheets.
 *
 * Every change is applied to the device copy immediately and added to an
 * "outbox". The outbox is sent to /api/sync, which relays it to the sheet and
 * returns the sheet's full contents. Once the outbox is empty, the sheet's
 * contents replace the device copy — the sheet is the source of truth.
 */

export type SyncOp =
  | { type: "setPref"; key: "profile"; value: Profile }
  | { type: "setPref"; key: "alerts"; value: AlertSettings }
  | { type: "upsertEntry"; entry: FoodEntry }
  | { type: "deleteEntry"; id: string }
  | { type: "upsertWeight"; weight: WeightEntry }
  | { type: "deleteWeight"; id: string };

interface SheetState {
  ok: true;
  prefs: { profile?: Profile; alerts?: AlertSettings };
  entries: Record<string, string | number>[];
  weights?: Record<string, string | number>[];
}

const outboxStore = createStore<SyncOp[]>("calorie-tracker:outbox");
/** Set after the first successful sync, when local data has been uploaded. */
const linkedStore = createStore<boolean>("calorie-tracker:sheets-linked");
export const passcodeStore = createStore<string>("calorie-tracker:passcode");

export const usePendingCount = () => outboxStore.useValue()?.length ?? 0;

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

export function enqueue(op: SyncOp) {
  outboxStore.set([...(outboxStore.get() ?? []), op]);
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

async function run() {
  if (!navigator.onLine) {
    setStatus({ state: "offline" });
    return;
  }
  const ops = outboxStore.get() ?? [];
  setStatus({ state: "syncing" });

  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-passcode": passcodeStore.get() ?? "" },
      body: JSON.stringify({ ops }),
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

  // Drop the ops that were just sent (newer ones may have been queued meanwhile).
  outboxStore.set((outboxStore.get() ?? []).slice(ops.length));

  if (!linkedStore.get()) {
    queueLocalDataMissingFrom(data);
    linkedStore.set(true);
  }

  if ((outboxStore.get() ?? []).length > 0) runAgain = true;
  else applySheetState(data);

  setStatus({ state: "synced", lastSynced: Date.now() });
}

/** First connection: upload anything on this device that the sheet doesn't have. */
function queueLocalDataMissingFrom(sheet: SheetState) {
  const queue: SyncOp[] = [];
  const profile = profileStore.get();
  const alerts = alertsStore.get();
  if (profile && !sheet.prefs.profile) queue.push({ type: "setPref", key: "profile", value: profile });
  if (alerts && !sheet.prefs.alerts) queue.push({ type: "setPref", key: "alerts", value: alerts });
  const sheetIds = new Set(sheet.entries.map((e) => String(e.id)));
  for (const entry of withinRetention(entriesStore.get() ?? [], dayKey(new Date()))) {
    if (!sheetIds.has(entry.id)) queue.push({ type: "upsertEntry", entry });
  }
  const sheetWeightIds = new Set((sheet.weights ?? []).map((w) => String(w.id)));
  for (const weight of weightsStore.get() ?? []) {
    if (!sheetWeightIds.has(weight.id)) queue.push({ type: "upsertWeight", weight });
  }
  if (queue.length) outboxStore.set([...(outboxStore.get() ?? []), ...queue]);
}

function applySheetState(sheet: SheetState) {
  setIfChanged(profileStore, sheet.prefs.profile ?? null);
  setIfChanged(alertsStore, sheet.prefs.alerts ?? null);
  const entries = sheet.entries.map(toEntry).filter((e): e is FoodEntry => e !== null);
  setIfChanged(entriesStore, withinRetention(entries, dayKey(new Date())));
  const weights = (sheet.weights ?? []).map(toWeight).filter((w): w is WeightEntry => w !== null);
  setIfChanged(weightsStore, weights);
}

function toWeight(row: Record<string, string | number>): WeightEntry | null {
  const kg = Number(row.weightKg);
  if (!row.id || !row.date || !Number.isFinite(kg)) return null;
  return { id: String(row.id), date: String(row.date), weightKg: kg, createdAt: Number(row.createdAt) || 0 };
}

function toEntry(row: Record<string, string | number>): FoodEntry | null {
  if (!row.id || !row.date || !row.name || row.calories === undefined) return null;
  const num = (v: string | number | undefined) => (v === undefined || v === "" ? undefined : Number(v));
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

function setIfChanged<T>(store: { get: () => T | null; set: (v: T | null) => void }, value: T | null) {
  if (JSON.stringify(store.get()) !== JSON.stringify(value)) store.set(value);
}

/** Removes food logs older than the retention window from this device. */
export function pruneLocalLogs() {
  const all = entriesStore.get();
  if (!all) return;
  setIfChanged(entriesStore, withinRetention(all, dayKey(new Date())));
}
