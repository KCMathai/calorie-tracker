"use client";

import Link from "next/link";
import { useState } from "react";
import { dailyTotalsStore } from "@/lib/dailyTotals";
import { dayKey, entriesStore, MEALS, shiftDay } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { formatMl, waterGoal, waterSettingsStore, waterStore } from "@/lib/water";
import { bmi, latestHeight, sortedWeights, weightsStore } from "@/lib/weights";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 0, label: "All time" },
] as const;

const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const longDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/** A printable summary of your data; the browser's print dialog can save it as a PDF. */
export function ReportView() {
  const now = useNow();
  const profile = profileStore.useValue();
  const totals = dailyTotalsStore.useValue() ?? [];
  const entries = entriesStore.useValue() ?? [];
  const weights = sortedWeights(weightsStore.useValue());
  const water = waterStore.useValue() ?? [];
  const waterSettings = waterSettingsStore.useValue();
  const [range, setRange] = useState<number>(30);
  const [withFoods, setWithFoods] = useState(true);

  if (!now || profile === undefined) return <p className="text-muted">Loading…</p>;

  const today = dayKey(now);
  const from = range ? shiftDay(today, -range + 1) : [totals[0]?.date, weights[0]?.date, water[0]?.date].filter(Boolean).sort()[0] ?? today;
  const inRange = <T extends { date: string }>(list: T[]) => list.filter((x) => x.date >= from && x.date <= today);

  const days = inRange(totals).sort((a, b) => (a.date < b.date ? 1 : -1));
  const waterDays = inRange(water);
  const weighIns = inRange(weights);
  const foods = inRange(entries).sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? 1 : -1));

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const avgKcal = avg(days.map((d) => d.calories));
  const withTarget = days.filter((d) => d.target > 0);
  const onTarget = withTarget.filter((d) => d.calories <= d.target).length;
  const avgWater = avg(waterDays.filter((d) => d.ml > 0).map((d) => d.ml));
  const goal = waterGoal(waterSettings, profile);
  const waterReached = waterDays.filter((d) => d.ml > 0 && d.ml >= (d.goal || goal)).length;
  const height = latestHeight(weights) ?? profile?.heightCm;
  const latestWeight = weights.at(-1);
  const bmiNow = latestWeight && height ? bmi(latestWeight.weightKg, height) : null;
  const waterOn = (date: string) => water.find((w) => w.date === date)?.ml;

  return (
    <div className="report flex flex-col gap-5">
      <div className="no-print flex flex-col gap-3">
        <Link href="/settings" className="text-sm text-muted underline">
          ← Back to Settings
        </Link>
        <div className="card flex flex-col gap-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            Period
            <select className="field !py-1" value={range} onChange={(e) => setRange(Number(e.target.value))}>
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={withFoods} onChange={(e) => setWithFoods(e.target.checked)} />
            Include individual foods (only the last 30 days are kept)
          </label>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            🖨️ Print or save as PDF
          </button>
          <p className="text-xs text-muted">
            In the print screen, choose <b>Save as PDF</b> as the printer (on iPhone: Share → Print, then pinch out on the preview and
            share it).
          </p>
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Calorie Tracker report</h1>
        <p className="text-sm text-muted">
          {longDate(from)} – {longDate(today)} · generated {now.toLocaleString()}
        </p>
      </header>

      {profile && (
        <section className="report-section">
          <h2 className="mb-2 font-semibold">Profile</h2>
          <p className="text-sm">
            Daily target <b>{fmt(profile.calorieTarget)} kcal</b>
            {profile.customTarget ? " (custom)" : ""} · Goal: {profile.goal} weight · {profile.age} years ·{" "}
            {height ? `${height} cm` : "height —"} · {latestWeight ? `${latestWeight.weightKg} kg` : `${profile.weightKg} kg`}
            {bmiNow ? ` · BMI ${bmiNow.value} (${bmiNow.category})` : ""}
          </p>
        </section>
      )}

      <section className="report-section">
        <h2 className="mb-2 font-semibold">Summary</h2>
        <table className="report-table">
          <tbody>
            <tr>
              <th scope="row">Average calories</th>
              <td>{avgKcal !== null ? `${fmt(avgKcal)} kcal per logged day` : "—"}</td>
            </tr>
            <tr>
              <th scope="row">Days logged</th>
              <td>{days.length}</td>
            </tr>
            <tr>
              <th scope="row">Days within target</th>
              <td>{withTarget.length ? `${onTarget} of ${withTarget.length}` : "—"}</td>
            </tr>
            <tr>
              <th scope="row">Average macros</th>
              <td>
                {days.length
                  ? `Protein ${fmt(avg(days.map((d) => d.protein))!)} g · Carbs ${fmt(avg(days.map((d) => d.carbs))!)} g · Fat ${fmt(avg(days.map((d) => d.fat))!)} g`
                  : "—"}
              </td>
            </tr>
            <tr>
              <th scope="row">Water</th>
              <td>
                {avgWater !== null
                  ? `${formatMl(Math.round(avgWater))} per day · goal reached ${waterReached} of ${plural(waterDays.filter((d) => d.ml > 0).length, "day")}`
                  : "—"}
              </td>
            </tr>
            <tr>
              <th scope="row">Weight</th>
              <td>
                {weighIns.length >= 2
                  ? `${weighIns[0].weightKg} → ${weighIns.at(-1)!.weightKg} kg (${weighIns.at(-1)!.weightKg - weighIns[0].weightKg > 0 ? "+" : ""}${fmt(weighIns.at(-1)!.weightKg - weighIns[0].weightKg, 1)} kg)`
                  : weighIns.length === 1
                    ? `${weighIns[0].weightKg} kg`
                    : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2 className="mb-2 font-semibold">Day by day</h2>
        {days.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">kcal</th>
                <th scope="col">Target</th>
                <th scope="col">±</th>
                <th scope="col">P / C / F (g)</th>
                <th scope="col">Water</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{longDate(d.date)}</td>
                  <td>{fmt(d.calories)}</td>
                  <td>{d.target ? fmt(d.target) : "—"}</td>
                  <td>{d.target ? `${d.calories > d.target ? "▲ +" : ""}${fmt(d.calories - d.target)}` : "—"}</td>
                  <td>
                    {fmt(d.protein)} / {fmt(d.carbs)} / {fmt(d.fat)}
                  </td>
                  <td>{waterOn(d.date) ? formatMl(waterOn(d.date)!) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">No days logged in this period.</p>
        )}
      </section>

      {weighIns.length > 0 && (
        <section className="report-section">
          <h2 className="mb-2 font-semibold">Weight &amp; height</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Weight</th>
                <th scope="col">Height</th>
              </tr>
            </thead>
            <tbody>
              {[...weighIns].reverse().map((w) => (
                <tr key={w.id}>
                  <td>{longDate(w.date)}</td>
                  <td>{w.weightKg} kg</td>
                  <td>{w.heightCm ? `${w.heightCm} cm` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {withFoods && foods.length > 0 && (
        <section className="report-section">
          <h2 className="mb-2 font-semibold">Foods</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Meal</th>
                <th scope="col">Food</th>
                <th scope="col">kcal</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f.id}>
                  <td>{f.date}</td>
                  <td>{MEALS.find((m) => m.value === f.meal)?.label ?? f.meal}</td>
                  <td>
                    {f.name}
                    {f.amount ? ` (${f.amount})` : ""}
                  </td>
                  <td>{fmt(f.calories)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-muted">Calorie and nutrition values are estimates. This report is not medical advice.</p>
    </div>
  );
}
