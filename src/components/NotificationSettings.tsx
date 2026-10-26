"use client";

import { useEffect, useState } from "react";
import { saveNotificationSettings } from "@/lib/actions";
import { alertsStore, DEFAULT_ALERTS } from "@/lib/alerts";
import { DEFAULT_NOTIFICATIONS, deviceIdStore, notificationSettingsStore, type NotificationSettings } from "@/lib/notifications";
import {
  currentSubscription,
  deviceLabel,
  isInstalled,
  isIOS,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  VAPID_PUBLIC_KEY,
} from "@/lib/push";
import { enqueue, passcodeStore, syncNow, useSheetFeatures } from "@/lib/sync";

type Availability = "checking" | "ok" | "unsupported" | "ios-not-installed" | "server-missing";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
const MEALS = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
] as const;

export function NotificationSettingsCard() {
  const settings = notificationSettingsStore.useValue();
  const alerts = alertsStore.useValue() ?? DEFAULT_ALERTS;
  const features = useSheetFeatures();
  const [availability, setAvailability] = useState<Availability>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Availability = "ok";
      if (!VAPID_PUBLIC_KEY) next = "server-missing";
      else if (!pushSupported()) next = isIOS() && !isInstalled() ? "ios-not-installed" : "unsupported";
      const sub = next === "ok" ? await currentSubscription().catch(() => null) : null;
      if (!cancelled) {
        setAvailability(next);
        setSubscribed(!!sub && Notification.permission === "granted");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const sub = (await subscribeToPush()).toJSON();
      let id = deviceIdStore.get();
      if (!id) {
        id = crypto.randomUUID();
        deviceIdStore.set(id);
      }
      enqueue({
        type: "setPref",
        key: `push-${id}`,
        value: { endpoint: sub.endpoint!, keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth }, device: deviceLabel(), createdAt: Date.now() },
      });
      enqueue({ type: "setPref", key: "appUrl", value: location.origin });
      if (!notificationSettingsStore.get()) {
        saveNotificationSettings({ ...DEFAULT_NOTIFICATIONS, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      }
      await syncNow();
      setSubscribed(true);
      setMessage({ kind: "ok", text: "Notifications are on for this device. Tap “Send a test” to check." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Couldn't turn on notifications." });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribeFromPush();
      const id = deviceIdStore.get();
      if (id) enqueue({ type: "setPref", key: `push-${id}`, value: null });
      await syncNow();
      setSubscribed(false);
      setMessage({ kind: "ok", text: "Notifications are off for this device." });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const sub = (await currentSubscription())?.toJSON();
      if (!sub) throw new Error("This device isn't subscribed any more. Turn notifications off and on again.");
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-passcode": passcodeStore.get() ?? "" },
        body: JSON.stringify({ subscription: { endpoint: sub.endpoint, keys: sub.keys } }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!data?.ok) throw new Error(data?.error === "push_not_configured" ? "The server's notification keys aren't set up yet." : "Couldn't send the test notification.");
      setMessage({ kind: "ok", text: "Test sent — it should appear in a few seconds." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Couldn't send the test notification." });
    } finally {
      setBusy(false);
    }
  }

  function update(change: Partial<NotificationSettings>) {
    const base = settings ?? { ...DEFAULT_NOTIFICATIONS, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    saveNotificationSettings({ ...base, ...change, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }

  const s = settings ?? { ...DEFAULT_NOTIFICATIONS, timeZone: "" };
  const scriptReady = features?.includes("notifications");

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">🔔 Phone notifications</h2>
        <p className="text-sm text-muted">Reminders that arrive even when the app is closed.</p>
      </div>

      {availability === "checking" && <p className="text-sm text-muted">Checking…</p>}
      {availability === "server-missing" && (
        <p className="text-sm text-muted">Notifications aren&apos;t set up on the server yet (the notification keys are missing).</p>
      )}
      {availability === "unsupported" && <p className="text-sm text-muted">This browser doesn&apos;t support notifications. Try Chrome on Android.</p>}
      {availability === "ios-not-installed" && (
        <p className="text-sm">
          On iPhone, notifications only work when the app is opened from your Home Screen. In Safari, tap <b>Share</b> →{" "}
          <b>Add to Home Screen</b>, open the app from there, and come back to this screen.
        </p>
      )}

      {availability === "ok" && !subscribed && (
        <button type="button" className="btn-primary" disabled={busy} onClick={turnOn}>
          {busy ? "Turning on…" : "Turn on notifications on this device"}
        </button>
      )}

      {availability === "ok" && subscribed && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1">Meal reminders</legend>
            <p className="text-xs text-muted">Only sent if you haven&apos;t logged that meal yet.</p>
            {MEALS.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-sm">
                {label}
                <select
                  className="field !py-1"
                  value={s.meals[key] ?? "off"}
                  onChange={(e) => update({ meals: { ...s.meals, [key]: e.target.value === "off" ? null : Number(e.target.value) } })}
                >
                  <option value="off">Off</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--accent)]"
              checked={s.underTarget}
              onChange={(e) => update({ underTarget: e.target.checked })}
            />
            <span>
              &ldquo;Not eaten enough&rdquo; reminder
              <span className="block text-xs text-muted">
                After {hourLabel(alerts.underHour)} if you&apos;re below {alerts.underPercent}% of your target (change these under Alerts).
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary !py-2" disabled={busy} onClick={sendTest}>
              Send a test
            </button>
            <button type="button" className="btn-secondary !py-2" disabled={busy} onClick={turnOff}>
              Turn off on this device
            </button>
          </div>
          <p className="text-xs text-muted">
            Your Google Sheet checks about once an hour, so a reminder can arrive up to an hour after its time. Times use this
            device&apos;s time zone{s.timeZone ? ` (${s.timeZone})` : ""}. Reminders show calorie numbers on your lock screen.
          </p>
          {features && !scriptReady && (
            <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs">
              ⚠️ Scheduled reminders need the latest Google script: paste the new <code>Code.gs</code>, deploy a new version, then run{" "}
              <code>setupNotifications</code> once (see the setup guide). The test button works already.
            </p>
          )}
        </>
      )}

      {message && (
        <p className={`text-sm ${message.kind === "ok" ? "text-[var(--accent)]" : "text-[var(--danger)]"}`} role={message.kind === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
