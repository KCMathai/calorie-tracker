"use client";

import { useEffect, useRef, useState } from "react";
import { addMyFoodPhoto } from "@/lib/actions";
import { classifyFood, type ClassifyProgress } from "@/lib/foodClassifier";
import { TOTAL_DOWNLOAD_MB, type FoodGuess } from "@/lib/foodClassifierProtocol";
import { DISHES, dishName } from "@/lib/foodNutrition";
import { matchMyFoods, myFoodPhotosStore, myFoodsStore, type MyFood, type MyFoodMatch } from "@/lib/myFoods";
import { createStore } from "@/lib/store";

export interface FoodFill {
  name: string;
  amount: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/**
 * What the form needs to offer "Remember this food": the photo's fingerprint and
 * whether the user picked a built-in guess or found no match.
 */
export interface PhotoContext {
  embedding: string;
  source: "guess" | "none";
}

/** Remembers that the models have been downloaded, so we stop warning about the download size. */
const modelReadyStore = createStore<boolean>("calorie-tracker:food-model-ready");

const PORTIONS = [
  { factor: 0.5, label: "½" },
  { factor: 1, label: "1" },
  { factor: 1.5, label: "1½" },
  { factor: 2, label: "2" },
];

const LOW_CONFIDENCE = 0.5;
const MAX_MY_MATCHES = 2;

interface Serving {
  name: string;
  serving: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

type Choice = { kind: "dish"; label: string } | { kind: "mine"; food: MyFood };

interface Results {
  guesses: FoodGuess[];
  mine: MyFoodMatch[];
  embedding: string | null;
}

type State =
  | { step: "idle" }
  | { step: "working"; progress: ClassifyProgress | null }
  | ({ step: "results" } & Results)
  | ({ step: "portion"; choice: Choice; factor: number } & Results)
  | { step: "error"; message: string };

export function PhotoRecognizer({
  onPick,
  onNoMatch,
}: {
  onPick: (fill: FoodFill, photo: PhotoContext | null) => void;
  /** user chose "None of these"; they'll type the food in */
  onNoMatch: (photo: PhotoContext | null) => void;
}) {
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
      const { guesses, embedding } = await classifyFood(file, (progress) => setState({ step: "working", progress }));
      modelReadyStore.set(true);
      const mine = embedding
        ? matchMyFoods(embedding, myFoodsStore.get() ?? [], myFoodPhotosStore.get() ?? []).slice(0, MAX_MY_MATCHES)
        : [];
      setState({ step: "results", guesses: guesses.slice(0, 3), mine, embedding });
    } catch {
      setState({
        step: "error",
        message: navigator.onLine
          ? "Couldn't analyse the photo. Please try again, or type the food in."
          : "You're offline. The food recogniser needs internet the first time it's used.",
      });
    }
  }

  function servingFor(choice: Choice): Serving {
    return choice.kind === "mine" ? choice.food : DISHES[choice.label];
  }

  function applyPortion(results: Results, choice: Choice, factor: number) {
    const s = servingFor(choice);
    const r = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * factor * 10) / 10);
    const fill: FoodFill = {
      name: s.name,
      amount: factor === 1 ? s.serving : `${PORTIONS.find((p) => p.factor === factor)?.label} × ${s.serving}`,
      calories: Math.round(s.calories * factor),
      protein: r(s.protein),
      carbs: r(s.carbs),
      fat: r(s.fat),
    };
    if (choice.kind === "mine") {
      // Confirming a taught food is another example of what it looks like.
      if (results.embedding) addMyFoodPhoto(choice.food.id, results.embedding);
      onPick(fill, null);
    } else {
      onPick(fill, results.embedding ? { embedding: results.embedding, source: "guess" } : null);
    }
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
            <span className="text-xs font-normal text-muted">First use downloads about {TOTAL_DOWNLOAD_MB} MB — Wi-Fi recommended</span>
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
                {state.mine.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-muted">Your foods</p>
                    {state.mine.map((m) => (
                      <GuessButton
                        key={m.food.id}
                        label={`⭐ ${m.food.name}`}
                        detail={`${Math.round(m.score * 100)}%`}
                        highlight
                        onClick={() => setState({ ...state, step: "portion", choice: { kind: "mine", food: m.food }, factor: 1 })}
                      />
                    ))}
                    <p className="text-xs text-muted">Common dishes</p>
                  </div>
                )}
                {state.mine.length === 0 && state.guesses[0] && state.guesses[0].score < LOW_CONFIDENCE && (
                  <p className="text-xs text-[var(--warning)]">Not very sure about this one — please check carefully.</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {state.guesses
                    .filter((g) => DISHES[g.label])
                    .map((g) => (
                      <GuessButton
                        key={g.label}
                        label={dishName(g.label)}
                        detail={`${Math.round(g.score * 100)}%`}
                        onClick={() => setState({ ...state, step: "portion", choice: { kind: "dish", label: g.label }, factor: 1 })}
                      />
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNoMatch(state.embedding ? { embedding: state.embedding, source: "none" } : null);
                    reset();
                  }}
                  className="text-left text-xs text-muted underline"
                >
                  None of these — I&apos;ll type it in{state.embedding ? " and teach the app" : ""}
                </button>
              </>
            )}

            {state.step === "portion" && (
              <PortionPicker
                serving={servingFor(state.choice)}
                mine={state.choice.kind === "mine"}
                factor={state.factor}
                onFactor={(factor) => setState({ ...state, factor })}
                onBack={() => setState({ step: "results", guesses: state.guesses, mine: state.mine, embedding: state.embedding })}
                onUse={() => applyPortion(state, state.choice, state.factor)}
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

function GuessButton({ label, detail, highlight, onClick }: { label: string; detail: string; highlight?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)] ${
        highlight ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 text-right text-xs tabular-nums text-muted">{detail}</span>
    </button>
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
  serving,
  mine,
  factor,
  onFactor,
  onBack,
  onUse,
}: {
  serving: Serving;
  mine: boolean;
  factor: number;
  onFactor: (f: number) => void;
  onBack: () => void;
  onUse: () => void;
}) {
  return (
    <>
      <p className="text-sm font-medium">
        {mine ? "⭐ " : ""}
        {serving.name}
      </p>
      <p className="text-xs text-muted">1 serving = {serving.serving}</p>
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
        ≈ <b>{Math.round(serving.calories * factor)} kcal</b>
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
