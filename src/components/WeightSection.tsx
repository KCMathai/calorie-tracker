"use client";

import { useState } from "react";
import { deleteWeight, saveWeight } from "@/lib/actions";
import { shiftDay } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { bmi, HEIGHT_LIMITS, latestHeight, sortedWeights, WEIGHT_LIMITS, weightsStore } from "@/lib/weights";
import { WeightChart } from "./charts";
import { Stat } from "./Stat";

const SHOW_RECENT = 7;

function shortDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function signed(n: number) {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toLocaleString()}`;
}

export function WeightSection({ today }: { today: string }) {
  const weights = sortedWeights(weightsStore.useValue());
  const profile = profileStore.useValue();
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [cm, setCm] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const kgNum = Number(kg);
  const cmNum = Number(cm);
  const heightOk = cm === "" || (Number.isFinite(cmNum) && cmNum >= HEIGHT_LIMITS.min && cmNum <= HEIGHT_LIMITS.max);
  const valid =
    kg !== "" && Number.isFinite(kgNum) && kgNum >= WEIGHT_LIMITS.min && kgNum <= WEIGHT_LIMITS.max && heightOk && date <= today;
  const existingForDate = weights.find((w) => w.date === date);

  const latest = weights.at(-1);
  const height = latestHeight(weights) ?? profile?.heightCm;
  const bmiNow = latest && height ? bmi(latest.weightKg, height) : null;
  const first = weights[0];
  const monthAgo = shiftDay(today, -30);
  const baseline30 = [...weights].reverse().find((w) => w.date <= monthAgo) ?? first;

  const recent = [...weights].reverse();
  const listed = showAll ? recent : recent.slice(0, SHOW_RECENT);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="weight-heading">
      <h2 id="weight-heading" className="text-xl font-semibold">
        Weight &amp; height
      </h2>

      <form
        className="card flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveWeight(date, Math.round(kgNum * 10) / 10, cm === "" ? undefined : Math.round(cmNum * 10) / 10);
          setKg("");
          setCm("");
          setSaved(true);
        }}
        onChange={() => setSaved(false)}
      >
        <label className="flex flex-col gap-1">
          <span className="label">Weight</span>
          <span className="field flex w-28 items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={WEIGHT_LIMITS.min}
              max={WEIGHT_LIMITS.max}
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder={latest ? String(latest.weightKg) : "kg"}
              className="w-full min-w-0 bg-transparent outline-none tabular-nums"
              required
            />
            <span className="text-sm text-muted">kg</span>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">
            Height <span className="font-normal text-muted">(optional)</span>
          </span>
          <span className={`field flex w-28 items-center gap-1 ${heightOk ? "" : "!border-red-500"}`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={HEIGHT_LIMITS.min}
              max={HEIGHT_LIMITS.max}
              value={cm}
              onChange={(e) => setCm(e.target.value)}
              placeholder={height ? String(height) : "cm"}
              className="w-full min-w-0 bg-transparent outline-none tabular-nums"
            />
            <span className="text-sm text-muted">cm</span>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Date</span>
          <input type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </label>
        <button type="submit" disabled={!valid} className="btn-primary !py-2">
          {existingForDate ? "Update" : "Save"}
        </button>
        {saved && (
          <p className="w-full text-sm text-[var(--accent)]" role="status">
            Saved ✓ Your profile weight, height and daily target follow your latest weigh-in.
          </p>
        )}
      </form>

      {latest ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Latest" value={latest.weightKg.toLocaleString()} unit={`kg · ${shortDate(latest.date)}`} />
            <Stat label="Last 30 days" value={signed(latest.weightKg - baseline30.weightKg)} unit="kg" />
            <Stat label="Since start" value={signed(latest.weightKg - first.weightKg)} unit={`kg · ${shortDate(first.date)}`} />
          </div>
          {bmiNow && height && (
            <p className="text-sm">
              BMI <b className="tabular-nums">{bmiNow.value}</b> · {bmiNow.category}
              <span className="block text-xs text-muted">
                Using {height} cm. BMI is a rough guide for adults, not a diagnosis.
              </span>
            </p>
          )}

          <div className="card flex flex-col gap-2">
            <h3 className="font-medium">Trend</h3>
            <WeightChart points={weights.map((w) => ({ date: w.date, title: shortDate(w.date), kg: w.weightKg }))} />
            {weights.length < 2 && <p className="text-xs text-muted">Add another weigh-in on a different day to see your trend.</p>}
          </div>

          <ul className="card !p-0">
            {listed.map((w, i) => {
              const prev = recent[i + 1];
              return (
                <li key={w.id} className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 last:border-b-0">
                  <span className="flex-1 text-sm">{shortDate(w.date)}</span>
                  <span className="text-sm tabular-nums">
                    {w.weightKg.toLocaleString()} kg
                    {w.heightCm !== undefined && <span className="text-muted"> · {w.heightCm} cm</span>}
                  </span>
                  <span className="w-16 text-right text-xs tabular-nums text-muted">{prev ? signed(w.weightKg - prev.weightKg) : ""}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete weight for ${shortDate(w.date)}`}
                    onClick={() => {
                      if (confirm(`Delete the ${w.weightKg} kg entry for ${shortDate(w.date)}?`)) deleteWeight(w.id);
                    }}
                  >
                    🗑️
                  </button>
                </li>
              );
            })}
          </ul>
          {recent.length > SHOW_RECENT && (
            <button type="button" className="self-start text-sm text-muted underline" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show fewer" : `Show all ${recent.length} entries`}
            </button>
          )}
          <p className="text-xs text-muted">Weight and height entries are kept forever.</p>
        </>
      ) : (
        <p className="text-sm text-muted">No weigh-ins yet. Add your first one above.</p>
      )}
    </section>
  );
}
