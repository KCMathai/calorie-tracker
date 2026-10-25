"use client";

import { useState } from "react";
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, MIN_SAFE_CALORIES, suggestedTarget } from "@/lib/calories";
import { profileStore } from "@/lib/profile";
import type { ActivityLevel, Goal, Profile, Sex } from "@/lib/types";

const LIMITS = {
  age: { min: 13, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  calorieTarget: { min: 800, max: 6000 },
};

function inRange(value: number, { min, max }: { min: number; max: number }) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function GoalForm({ initial, onSaved }: { initial?: Profile | null; onSaved?: () => void }) {
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "female");
  const [age, setAge] = useState(initial ? String(initial.age) : "");
  const [heightCm, setHeightCm] = useState(initial ? String(initial.heightCm) : "");
  const [weightKg, setWeightKg] = useState(initial ? String(initial.weightKg) : "");
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activity ?? "light");
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "maintain");
  const [customTarget, setCustomTarget] = useState(initial?.customTarget ?? false);
  const [ownTarget, setOwnTarget] = useState(initial?.customTarget ? String(initial.calorieTarget) : "");
  const [saved, setSaved] = useState(false);

  const nums = { age: Number(age), heightCm: Number(heightCm), weightKg: Number(weightKg) };
  const bodyValid =
    inRange(nums.age, LIMITS.age) && inRange(nums.heightCm, LIMITS.heightCm) && inRange(nums.weightKg, LIMITS.weightKg);
  const suggestion = bodyValid ? suggestedTarget({ sex, activity, goal, ...nums }) : null;
  const ownTargetNum = Number(ownTarget);
  const ownTargetValid = inRange(ownTargetNum, LIMITS.calorieTarget);
  const finalTarget = customTarget ? (ownTargetValid ? ownTargetNum : null) : suggestion;
  const belowSafe = finalTarget !== null && finalTarget < MIN_SAFE_CALORIES[sex];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyValid || finalTarget === null) return;
    profileStore.set({ sex, activity, goal, ...nums, calorieTarget: Math.round(finalTarget), customTarget });
    setSaved(true);
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSaved(false)} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Sex</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["female", "male"] as const).map((s) => (
            <Choice key={s} name="sex" checked={sex === s} onChange={() => setSex(s)} label={s === "female" ? "Female" : "Male"} />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Age" unit="yrs" value={age} onChange={setAge} limits={LIMITS.age} />
        <NumberField label="Height" unit="cm" value={heightCm} onChange={setHeightCm} limits={LIMITS.heightCm} />
        <NumberField label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} limits={LIMITS.weightKg} step="0.1" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">Activity level</legend>
        {ACTIVITY_OPTIONS.map((a) => (
          <Choice
            key={a.value}
            name="activity"
            checked={activity === a.value}
            onChange={() => setActivity(a.value)}
            label={a.label}
            hint={a.hint}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">Goal</legend>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_OPTIONS.map((g) => (
            <Choice key={g.value} name="goal" checked={goal === g.value} onChange={() => setGoal(g.value)} label={g.label} hint={g.hint} />
          ))}
        </div>
      </fieldset>

      <section className="card flex flex-col gap-3">
        <div>
          <p className="text-sm text-muted">Suggested daily target</p>
          <p className="text-3xl font-semibold tabular-nums">
            {suggestion !== null ? suggestion.toLocaleString() : "—"} <span className="text-base font-normal text-muted">kcal</span>
          </p>
          {suggestion === null && <p className="text-sm text-muted">Fill in age, height and weight to see it.</p>}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={customTarget} onChange={(e) => setCustomTarget(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Use my own target instead
        </label>
        {customTarget && (
          <NumberField label="My daily target" unit="kcal" value={ownTarget} onChange={setOwnTarget} limits={LIMITS.calorieTarget} />
        )}
        {belowSafe && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This is below the commonly recommended minimum of {MIN_SAFE_CALORIES[sex].toLocaleString()} kcal. Please check with a doctor
            before eating this little.
          </p>
        )}
        <p className="text-xs text-muted">This is an estimate based on a standard formula, not medical advice.</p>
      </section>

      <button type="submit" disabled={!bodyValid || finalTarget === null} className="btn-primary">
        {saved ? "Saved ✓" : initial ? "Save changes" : "Save and start tracking"}
      </button>
    </form>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  limits,
  step = "1",
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  limits: { min: number; max: number };
  step?: string;
}) {
  const invalid = value !== "" && !inRange(Number(value), limits);
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <div className={`field flex items-center gap-1 ${invalid ? "!border-red-500" : ""}`}>
        <input
          type="number"
          inputMode="decimal"
          min={limits.min}
          max={limits.max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent outline-none tabular-nums"
          required
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
      {invalid && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {limits.min}–{limits.max}
        </span>
      )}
    </label>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2 transition-colors ${
        checked ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
