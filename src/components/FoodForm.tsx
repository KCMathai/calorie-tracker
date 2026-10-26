"use client";

import { useState } from "react";
import { MEALS, type FoodEntry, type Meal, type NewFoodEntry } from "@/lib/entries";
import { BarcodeScanner } from "./BarcodeScanner";
import { teachFood } from "@/lib/actions";
import { findMyFoodByName, myFoodsStore } from "@/lib/myFoods";
import { PhotoRecognizer, type FoodFill, type PhotoContext } from "./PhotoRecognizer";

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
  /** The photo this entry came from, so it can be remembered as a taught food. */
  const [photo, setPhoto] = useState<PhotoContext | null>(null);
  const [remember, setRemember] = useState(false);
  const [taught, setTaught] = useState<string | null>(null);

  const caloriesNum = Number(calories);
  const valid = name.trim() !== "" && calories !== "" && Number.isFinite(caloriesNum) && caloriesNum >= 0 && caloriesNum <= 10000;
  const existingTaught = photo ? findMyFoodByName(myFoodsStore.get(), name) : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const entry: NewFoodEntry = {
      date: initial?.date ?? date,
      meal,
      name: name.trim(),
      amount: amount.trim() || undefined,
      calories: Math.round(caloriesNum),
      protein: optionalNumber(protein),
      carbs: optionalNumber(carbs),
      fat: optionalNumber(fat),
    };
    onSubmit(entry);
    if (photo && remember) {
      const food = teachFood(
        {
          name: entry.name,
          serving: entry.amount ?? "1 serving",
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        },
        photo.embedding,
      );
      setTaught(food.name);
    } else {
      setTaught(null);
    }
    if (!initial) {
      setName("");
      setAmount("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setPhoto(null);
      setRemember(false);
    }
  }

  function fill(f: FoodFill) {
    setName(f.name);
    setAmount(f.amount);
    setCalories(String(f.calories));
    setProtein(f.protein != null ? String(f.protein) : "");
    setCarbs(f.carbs != null ? String(f.carbs) : "");
    setFat(f.fat != null ? String(f.fat) : "");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!initial && (
        <div className="flex flex-col gap-2">
          <PhotoRecognizer
            onPick={(f, p) => {
              fill(f);
              setPhoto(p);
              setRemember(false); // a built-in guess was right; teaching is optional (e.g. after renaming)
              setTaught(null);
            }}
            onNoMatch={(p) => {
              setPhoto(p);
              setRemember(p !== null); // the app got it wrong: offer to learn it
              setTaught(null);
            }}
          />
          <BarcodeScanner
            onPick={(f) => {
              fill(f);
              setPhoto(null);
            }}
          />
        </div>
      )}
      {taught && (
        <p className="text-sm text-[var(--accent)]" role="status">
          ⭐ Remembered “{taught}” — the app will suggest it for similar photos.
        </p>
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

      {photo && (
        <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            ⭐ Remember this food from the photo
            <span className="block text-xs text-muted">
              {existingTaught
                ? `Adds this photo to “${existingTaught.name}” so it's recognised more reliably.`
                : "Next time a similar photo is taken, the app will suggest it with these details as 1 serving."}
            </span>
          </span>
        </label>
      )}

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
