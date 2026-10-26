"use client";

import { useState } from "react";
import { deleteMyFood, updateMyFood } from "@/lib/actions";
import { myFoodPhotosStore, myFoodsStore, type MyFood } from "@/lib/myFoods";

/** Lists the foods the photo recogniser was taught; lets the user fix or remove them. */
export function MyFoodsSettings() {
  const foods = myFoodsStore.useValue();
  const photos = myFoodPhotosStore.useValue() ?? [];
  const [editing, setEditing] = useState<string | null>(null);

  if (foods === undefined) return null;
  const sorted = [...(foods ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">⭐ My foods</h2>
        <p className="text-sm text-muted">
          Foods you taught the photo recogniser. Each extra photo you confirm makes recognition more reliable.
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">
          None yet. When a photo isn&apos;t recognised, choose &ldquo;None of these&rdquo;, type the food in and keep &ldquo;Remember this
          food&rdquo; ticked.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {sorted.map((food) => {
            const count = photos.filter((p) => p.foodId === food.id).length;
            return editing === food.id ? (
              <li key={food.id} className="py-2">
                <EditMyFood
                  food={food}
                  onDone={(updated) => {
                    if (updated) updateMyFood(updated);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={food.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{food.name}</p>
                  <p className="text-xs text-muted">
                    {food.calories} kcal per {food.serving} · {count} photo{count === 1 ? "" : "s"}
                  </p>
                </div>
                <button type="button" className="icon-btn" aria-label={`Edit ${food.name}`} onClick={() => setEditing(food.id)}>
                  ✏️
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Forget ${food.name}`}
                  onClick={() => {
                    if (confirm(`Forget “${food.name}”? The app will stop suggesting it. Your food log isn't affected.`)) deleteMyFood(food.id);
                  }}
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EditMyFood({ food, onDone }: { food: MyFood; onDone: (updated: MyFood | null) => void }) {
  const [name, setName] = useState(food.name);
  const [serving, setServing] = useState(food.serving);
  const [calories, setCalories] = useState(String(food.calories));
  const [protein, setProtein] = useState(food.protein != null ? String(food.protein) : "");
  const [carbs, setCarbs] = useState(food.carbs != null ? String(food.carbs) : "");
  const [fat, setFat] = useState(food.fat != null ? String(food.fat) : "");

  const kcal = Number(calories);
  const valid = name.trim() !== "" && serving.trim() !== "" && calories !== "" && Number.isFinite(kcal) && kcal >= 0 && kcal <= 10000;
  const opt = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

  return (
    <div className="flex flex-col gap-2">
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Food name" />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">1 serving is</span>
          <input className="field" value={serving} onChange={(e) => setServing(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Calories per serving</span>
          <input className="field tabular-nums" type="number" inputMode="numeric" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Protein g", value: protein, set: setProtein },
          { label: "Carbs g", value: carbs, set: setCarbs },
          { label: "Fat g", value: fat, set: setFat },
        ].map((f) => (
          <label key={f.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{f.label}</span>
            <input className="field tabular-nums" type="number" inputMode="decimal" min={0} step="0.1" value={f.value} onChange={(e) => f.set(e.target.value)} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1 !py-2" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1 !py-2"
          disabled={!valid}
          onClick={() =>
            onDone({ ...food, name: name.trim(), serving: serving.trim(), calories: Math.round(kcal), protein: opt(protein), carbs: opt(carbs), fat: opt(fat) })
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}
