"use client";

import { useState } from "react";
import { MEALS, type FoodEntry, type Meal, type NewFoodEntry } from "@/lib/entries";
import { BarcodeScanner } from "./BarcodeScanner";
import { PhotoRecognizer, type FoodFill } from "./PhotoRecognizer";

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function FoodForm({
  date,
  defaultMeal,
  initial,
  onSubmit,
  onCancel,
}: {
  date: string;
  defaultMeal: Meal;
  initial?: FoodEntry;
  onSubmit: (entry: NewFoodEntry) => void;
  onCancel?: () => void;
}) {
  const [meal, setMeal] = useState<Meal>(initial?.meal ?? defaultMeal);
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [calories, setCalories] = useState(initial ? String(initial.calories) : "");
  const [protein, setProtein] = useState(initial?.protein != null ? String(initial.protein) : "");
  const [carbs, setCarbs] = useState(initial?.carbs != null ? String(initial.carbs) : "");
  const [fat, setFat] = useState(initial?.fat != null ? String(initial.fat) : "");

  const caloriesNum = Number(calories);
  const valid = name.trim() !== "" && calories !== "" && Number.isFinite(caloriesNum) && caloriesNum >= 0 && caloriesNum <= 10000;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      date: initial?.date ?? date,
      meal,
      name: name.trim(),
      amount: amount.trim() || undefined,
      calories: Math.round(caloriesNum),
      protein: optionalNumber(protein),
      carbs: optionalNumber(carbs),
      fat: optionalNumber(fat),
    });
    if (!initial) {
      setName("");
      setAmount("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }

  function fillFromPhoto(fill: FoodFill) {
    setName(fill.name);
    setAmount(fill.amount);
    setCalories(String(fill.calories));
    setProtein(fill.protein != null ? String(fill.protein) : "");
    setCarbs(fill.carbs != null ? String(fill.carbs) : "");
    setFat(fill.fat != null ? String(fill.fat) : "");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!initial && (
        <div className="flex flex-col gap-2">
          <PhotoRecognizer onPick={fillFromPhoto} />
          <BarcodeScanner onPick={fillFromPhoto} />
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--surface-hover)] p-1" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={meal === m.value}
            onClick={() => setMeal(m.value)}
            className={`rounded-lg px-1 py-1.5 text-xs font-medium ${meal === m.value ? "bg-[var(--surface)] shadow-sm" : "text-muted"}`}
          >
            <span aria-hidden>{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">Food</span>
        <input className="field" placeholder="e.g. Banana" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Amount <span className="font-normal text-muted">(optional)</span></span>
          <input className="field" placeholder="e.g. 1 medium" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Calories</span>
          <input
            className="field tabular-nums"
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            placeholder="kcal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="label mb-1">
          Macros <span className="font-normal text-muted">(optional, grams)</span>
        </legend>
        {[
          { label: "Protein", value: protein, set: setProtein },
          { label: "Carbs", value: carbs, set: setCarbs },
          { label: "Fat", value: fat, set: setFat },
        ].map((f) => (
          <label key={f.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{f.label}</span>
            <input
              className="field tabular-nums"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              placeholder="g"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
            />
          </label>
        ))}
      </fieldset>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={!valid} className="btn-primary flex-1">
          {initial ? "Save changes" : "Add food"}
        </button>
      </div>
    </form>
  );
}
