"use client";

import { useState } from "react";
import { saveWaterSettings } from "@/lib/actions";
import { profileStore } from "@/lib/profile";
import { formatMl, suggestedWaterGoal, WATER_LIMITS, waterGoal, waterSettingsStore } from "@/lib/water";

export function WaterSettingsCard() {
  const settings = waterSettingsStore.useValue();
  const profile = profileStore.useValue();
  const [draft, setDraft] = useState<string | null>(null);
  if (settings === undefined) return null;

  const current = waterGoal(settings, profile);
  const suggested = suggestedWaterGoal(profile);
  const value = draft ?? String(current);
  const n = Number(value);
  const valid = Number.isFinite(n) && n >= WATER_LIMITS.min && n <= WATER_LIMITS.max;

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">💧 Water goal</h2>
        <p className="text-sm text-muted">
          Suggested for you: {formatMl(suggested)} (about 35 ml per kg of body weight). A rough guide — needs vary with heat, activity and
          health.
        </p>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveWaterSettings({ goalMl: Math.round(n / 50) * 50 });
          setDraft(null);
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label">Daily goal</span>
          <span className={`field flex items-center gap-1 ${valid ? "" : "!border-red-500"}`}>
            <input
              type="number"
              inputMode="numeric"
              min={WATER_LIMITS.min}
              max={WATER_LIMITS.max}
              step={50}
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-w-0 bg-transparent outline-none tabular-nums"
            />
            <span className="text-sm text-muted">ml</span>
          </span>
        </label>
        <button type="submit" className="btn-secondary shrink-0 !py-2" disabled={!valid || Number(value) === current}>
          Save
        </button>
        {settings && (
          <button
            type="button"
            className="btn-secondary shrink-0 !py-2"
            onClick={() => {
              saveWaterSettings({ goalMl: suggested });
              setDraft(null);
            }}
            disabled={current === suggested}
          >
            Use suggested
          </button>
        )}
      </form>
    </section>
  );
}
