"use client";

import { useEffect, useRef, useState } from "react";
import { classifyFood, type ClassifyProgress } from "@/lib/foodClassifier";
import { FOOD_MODEL, type FoodGuess } from "@/lib/foodClassifierProtocol";
import { DISHES, dishName } from "@/lib/foodNutrition";
import { createStore } from "@/lib/store";

export interface FoodFill {
  name: string;
  amount: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** Remembers that the model has been downloaded once, so we stop warning about the download size. */
const modelReadyStore = createStore<boolean>("calorie-tracker:food-model-ready");

const PORTIONS = [
  { factor: 0.5, label: "½" },
  { factor: 1, label: "1" },
  { factor: 1.5, label: "1½" },
  { factor: 2, label: "2" },
];

const LOW_CONFIDENCE = 0.5;

type State =
  | { step: "idle" }
  | { step: "working"; progress: ClassifyProgress | null }
  | { step: "results"; guesses: FoodGuess[] }
  | { step: "portion"; guesses: FoodGuess[]; label: string; factor: number }
  | { step: "error"; message: string };

export function PhotoRecognizer({ onPick }: { onPick: (fill: FoodFill) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const modelReady = modelReadyStore.useValue();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function reset() {
    setState({ step: "idle" });
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setState({ step: "working", progress: null });
    try {
      const guesses = await classifyFood(file, (progress) => setState({ step: "working", progress }));
      modelReadyStore.set(true);
      setState({ step: "results", guesses: guesses.slice(0, 3) });
    } catch {
      setState({
        step: "error",
        message: navigator.onLine
          ? "Couldn't analyse the photo. Please try again, or type the food in."
          : "You're offline. The food recogniser needs internet the first time it's used.",
      });
    }
  }

  function choose(guesses: FoodGuess[], label: string) {
    if (!DISHES[label]) return;
    setState({ step: "portion", guesses, label, factor: 1 });
  }

  function applyPortion(label: string, factor: number) {
    const dish = DISHES[label];
    const r = (n: number) => Math.round(n * factor * 10) / 10;
    onPick({
      name: dish.name,
      amount: factor === 1 ? dish.serving : `${PORTIONS.find((p) => p.factor === factor)?.label} × ${dish.serving}`,
      calories: Math.round(dish.calories * factor),
      protein: r(dish.protein),
      carbs: r(dish.carbs),
      fat: r(dish.fat),
    });
    reset();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {state.step === "idle" && (
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary flex flex-col items-center gap-0.5">
          <span>📷 Recognise food from a photo</span>
          {modelReady !== true && (
            <span className="text-xs font-normal text-muted">
              First use downloads about {FOOD_MODEL.approxDownloadMB} MB — Wi-Fi recommended
            </span>
          )}
        </button>
      )}

      {state.step !== "idle" && (
        <div className="flex gap-3 rounded-xl border border-[var(--border)] p-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="Your food photo" className="size-20 shrink-0 rounded-lg object-cover" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {state.step === "working" && <WorkingStatus progress={state.progress} />}

            {state.step === "results" && (
              <>
                <p className="text-sm font-medium">Which one is it?</p>
                {state.guesses[0] && state.guesses[0].score < LOW_CONFIDENCE && (
                  <p className="text-xs text-[var(--warning)]">Not very sure about this one — please check carefully.</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {state.guesses.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => choose(state.guesses, g.label)}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
                    >
                      <span>{dishName(g.label)}</span>
                      <span className="text-xs tabular-nums text-muted">{Math.round(g.score * 100)}%</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={reset} className="text-left text-xs text-muted underline">
                  None of these — I&apos;ll type it in
                </button>
              </>
            )}

            {state.step === "portion" && (
              <PortionPicker
                label={state.label}
                factor={state.factor}
                onFactor={(factor) => setState({ ...state, factor })}
                onBack={() => setState({ step: "results", guesses: state.guesses })}
                onUse={() => applyPortion(state.label, state.factor)}
              />
            )}

            {state.step === "error" && (
              <>
                <p className="text-sm text-[var(--danger)]">{state.message}</p>
                <button type="button" onClick={reset} className="text-left text-xs text-muted underline">
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkingStatus({ progress }: { progress: ClassifyProgress | null }) {
  if (progress?.stage === "downloading") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm">Downloading food recogniser… (first time only)</p>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${progress.progress}%` }} />
        </div>
        <p className="text-xs tabular-nums text-muted">
          {progress.loadedMB.toFixed(0)} / {progress.totalMB.toFixed(0)} MB
        </p>
      </div>
    );
  }
  return <p className="text-sm">🔍 Looking at your food…</p>;
}

function PortionPicker({
  label,
  factor,
  onFactor,
  onBack,
  onUse,
}: {
  label: string;
  factor: number;
  onFactor: (f: number) => void;
  onBack: () => void;
  onUse: () => void;
}) {
  const dish = DISHES[label];
  return (
    <>
      <p className="text-sm font-medium">{dish.name}</p>
      <p className="text-xs text-muted">1 serving = {dish.serving}</p>
      <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Servings">
        {PORTIONS.map((p) => (
          <button
            key={p.factor}
            type="button"
            role="radio"
            aria-checked={factor === p.factor}
            onClick={() => onFactor(p.factor)}
            className={`rounded-lg border px-2 py-1 text-sm ${
              factor === p.factor ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-sm tabular-nums">
        ≈ <b>{Math.round(dish.calories * factor)} kcal</b>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="text-xs text-muted underline">
          Back
        </button>
        <button type="button" onClick={onUse} className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-white dark:text-black">
          Use this
        </button>
      </div>
    </>
  );
}
