import type { DailyTotal } from "./dailyTotals";
import type { FoodEntry } from "./entries";
import type { WaterDay } from "./water";
import type { WeightEntry } from "./weights";

/** Builds CSV files (open in Excel, Google Sheets or Numbers) from the device copy of your data. */

type Cell = string | number | undefined | null;

function csvCell(v: Cell): string {
  if (v === undefined || v === null) return "";
  let s = String(v);
  // Stop spreadsheet apps treating text like "=SUM(…)" as a formula.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  // The byte-order mark makes Excel read emoji and accents correctly.
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export const foodLogCsv = (entries: FoodEntry[]) =>
  toCsv(
    ["Date", "Meal", "Food", "Amount", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"],
    [...entries]
      .sort((a, b) => byDate(a, b) || a.createdAt - b.createdAt)
      .map((e) => [e.date, e.meal, e.name, e.amount, e.calories, e.protein, e.carbs, e.fat]),
  );

export const dailyTotalsCsv = (totals: DailyTotal[]) =>
  toCsv(
    ["Date", "Calories (kcal)", "Target (kcal)", "Over/under (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Foods logged"],
    [...totals].sort(byDate).map((t) => [t.date, t.calories, t.target || "", t.target ? t.calories - t.target : "", t.protein, t.carbs, t.fat, t.entries]),
  );

export const weightCsv = (weights: WeightEntry[]) =>
  toCsv(["Date", "Weight (kg)", "Height (cm)"], [...weights].sort(byDate).map((w) => [w.date, w.weightKg, w.heightCm]));

export const waterCsv = (days: WaterDay[]) =>
  toCsv(["Date", "Water (ml)", "Goal (ml)", "Goal reached"], [...days].sort(byDate).map((d) => [d.date, d.ml, d.goal || "", d.goal ? (d.ml >= d.goal ? "yes" : "no") : ""]));

/** Hands a file to the browser to save (Downloads on a computer, Files/Downloads on a phone). */
export function saveFile(filename: string, contents: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
