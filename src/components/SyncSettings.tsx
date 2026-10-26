"use client";

import { useState } from "react";
import { lockAndClearDevice, syncNow, usePendingCount, useSheetNeedsScriptUpdate, useSyncStatus, type SyncState } from "@/lib/sync";

export const STATUS_TEXT: Record<SyncState, string> = {
  idle: "Checking…",
  syncing: "Syncing…",
  synced: "Synced with Google Sheets",
  offline: "Offline — changes will sync when you reconnect",
  not_configured: "Not connected to Google Sheets yet",
  bad_passcode: "Wrong or missing app passcode",
  error: "Couldn't reach Google Sheets",
};

export function SyncSettings() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  const needsScriptUpdate = useSheetNeedsScriptUpdate();
  const [lockError, setLockError] = useState<string | null>(null);

  const ok = status.state === "synced";

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Google Sheets sync</h2>
        <p className={`text-sm ${ok ? "text-[var(--accent)]" : "text-muted"}`} role="status">
          {ok ? "✓ " : ""}
          {STATUS_TEXT[status.state]}
          {status.state === "error" && status.error ? ` (${status.error})` : ""}
        </p>
        {status.lastSynced && (
          <p className="text-xs text-muted">Last synced {new Date(status.lastSynced).toLocaleTimeString()}</p>
        )}
        {pending > 0 && <p className="text-xs text-muted">{pending} change(s) waiting to sync</p>}
        {needsScriptUpdate && (
          <p className="mt-1 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs">
            ⚠️ Some of your data (like taught foods, heights or daily totals) is saved on this device but can&apos;t reach the sheet
            yet: the Google script needs updating. Paste the new <code>Code.gs</code> into Apps Script and deploy a new version (see
            the setup guide). Everything else syncs normally.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Meals are kept for 30 days. Daily calorie totals, weight, height, taught foods and preferences are kept forever.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary !py-2" onClick={() => void syncNow()}>
          Sync now
        </button>
        <button
          type="button"
          className="btn-secondary !py-2"
          onClick={() => {
            setLockError(null);
            if (!confirm("Lock the app on this device? Your data is removed from this device (it stays in your Google Sheet) and the passcode is needed to open it again.")) return;
            if (!lockAndClearDevice()) setLockError("Some changes haven't reached your sheet yet. Connect to the internet, tap “Sync now”, then try again.");
          }}
        >
          🔒 Lock app on this device
        </button>
      </div>
      {lockError && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {lockError}
        </p>
      )}
    </section>
  );
}
