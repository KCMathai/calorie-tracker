"use client";

import { useState } from "react";
import { passcodeStore, syncNow, unlockedStore } from "@/lib/sync";
import { PasswordInput } from "./PasswordInput";

/**
 * Shows the app only after this device has been unlocked with the passcode.
 * Until then nothing else renders — no data, no navigation.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const unlocked = unlockedStore.useValue();
  const savedPasscode = passcodeStore.useValue();

  // Still loading (server render / hydration): show nothing rather than flash data.
  if (unlocked === undefined || savedPasscode === undefined) return null;

  // Devices unlocked before the lock screen existed have a saved passcode but no flag yet.
  const isUnlocked = unlocked === true || (unlocked === null && !!savedPasscode);
  return isUnlocked ? <>{children}</> : <LockScreen />;
}

function LockScreen() {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Ask the server to check the passcode (an empty sync changes nothing).
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-passcode": passcode.trim() },
        body: JSON.stringify({ ops: [] }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok || data?.error === "not_configured") {
        passcodeStore.set(passcode.trim());
        unlockedStore.set(true);
        void syncNow();
        return;
      }
      setError(
        data?.error === "bad_passcode"
          ? "That passcode isn't right. Please try again."
          : "Couldn't reach the server to check the passcode. Please try again.",
      );
    } catch {
      setError(navigator.onLine ? "Couldn't reach the server. Please try again." : "You're offline. Connect to the internet to unlock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center gap-6 px-4">
      <header className="text-center">
        <p className="text-5xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Calorie Tracker is locked</h1>
        <p className="mt-1 text-sm text-muted">Enter your passcode to open your food log and settings on this device.</p>
      </header>
      <form onSubmit={unlock} className="card flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Passcode</span>
          <PasswordInput value={passcode} onChange={setPasscode} placeholder="Your passcode" autoFocus />
        </label>
        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !passcode.trim()}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
      <p className="text-center text-xs text-muted">Your data stays in your Google Sheet and is only shown after unlocking.</p>
    </main>
  );
}
