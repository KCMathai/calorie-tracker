"use client";

import { saveAlerts } from "@/lib/actions";
import { alertsStore, DEFAULT_ALERTS } from "@/lib/alerts";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number) {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
}

/** Saves instantly on change. */
export function AlertSettingsForm() {
  const stored = alertsStore.useValue();
  if (stored === undefined) return null;
  const settings = stored ?? DEFAULT_ALERTS;

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Alerts</h2>
        <p className="text-sm text-muted">
          You&apos;ll always see a warning when you go over your target. The &ldquo;not enough&rdquo; reminder shows after the time below
          if you&apos;ve eaten less than the chosen share of your target.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Remind me after</span>
          <select
            className="field"
            value={settings.underHour}
            onChange={(e) => saveAlerts({ ...settings, underHour: Number(e.target.value) })}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">If below</span>
          <select
            className="field"
            value={settings.underPercent}
            onChange={(e) => saveAlerts({ ...settings, underPercent: Number(e.target.value) })}
          >
            {[50, 60, 70, 80, 90].map((p) => (
              <option key={p} value={p}>
                {p}% of target
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
