"use client";

import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { passcodeStore, syncNow, usePendingCount, useSheetNeedsScriptUpdate, useSyncStatus, type SyncState } from "@/lib/sync";

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
  const storedPasscode = passcodeStore.useValue();
  const [passcode, setPasscode] = useState<string | null>(null);
  const passcodeValue = passcode ?? storedPasscode ?? "";

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
            ⚠️ Your taught foods are saved on this device but can&apos;t reach the sheet yet: the Google script needs updating. Paste
            the new <code>Code.gs</code> into Apps Script and deploy a new version (see the setup guide). Everything else syncs normally.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Food logs are kept for 30 days. Preferences and weight are kept forever.</p>
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          passcodeStore.set(passcodeValue.trim() || null);
          setPasscode(null);
          void syncNow();
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label">App passcode</span>
          <PasswordInput value={passcodeValue} onChange={setPasscode} placeholder="Your passcode" />
        </label>
        <button type="submit" className="btn-secondary shrink-0 whitespace-nowrap !py-2">
          Save & sync
        </button>
      </form>
    </section>
  );
}
