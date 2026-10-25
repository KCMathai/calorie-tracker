"use client";

import { useEffect, useRef, useState } from "react";
import { getBarcodeDetector, lookupBarcode, type BarcodeProduct, type LookupResult } from "@/lib/barcode";
import type { FoodFill } from "./PhotoRecognizer";

const SCAN_INTERVAL_MS = 250;

type State =
  | { step: "idle" }
  | { step: "camera" }
  | { step: "looking"; code: string }
  | { step: "product"; product: BarcodeProduct; amount: string }
  | { step: "problem"; message: string };

const PROBLEM_TEXT: Record<Exclude<LookupResult, { ok: true }>["error"], string> = {
  not_found: "This product isn't in the Open Food Facts database yet. Please type it in.",
  no_nutrition: "Found the product, but it has no calorie information. Please type it in.",
  invalid_barcode: "That doesn't look like a food barcode (8–14 digits).",
  busy: "The food database is busy right now. Try again in a minute.",
  lookup_failed: "Couldn't look up the barcode. Please try again.",
  offline: "You're offline — barcode lookup needs internet.",
};

export function BarcodeScanner({ onPick }: { onPick: (fill: FoodFill) => void }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [typed, setTyped] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  async function lookup(code: string) {
    setState({ step: "looking", code });
    const result = await lookupBarcode(code);
    if (result.ok) {
      const g = result.product.servingGrams;
      setState({ step: "product", product: result.product, amount: String(g ? Math.round(g) : 100) });
    } else {
      setState({ step: "problem", message: PROBLEM_TEXT[result.error] ?? PROBLEM_TEXT.lookup_failed });
    }
  }

  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    setState({ step: "looking", code: "" });
    try {
      const detector = await getBarcodeDetector();
      const codes = await detector.detect(await createImageBitmap(file));
      const code = codes.map((c) => c.rawValue).find((v) => /^\d{8,14}$/.test(v));
      if (code) await lookup(code);
      else setState({ step: "problem", message: "Couldn't find a barcode in that photo. Try a closer, sharper photo, or type the number." });
    } catch {
      setState({ step: "problem", message: "Couldn't read that photo. Try again or type the number." });
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  function lookupTyped() {
    const code = typed.replace(/\D/g, "");
    if (code) void lookup(code);
  }

  function close() {
    setState({ step: "idle" });
    setTyped("");
  }

  if (state.step === "idle") {
    return (
      <button type="button" onClick={() => setState({ step: "camera" })} className="btn-secondary">
        <span aria-hidden>▥</span> Scan a barcode
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3">
      {state.step === "camera" && (
        <CameraScanner
          onCode={lookup}
          onError={(message) => setState({ step: "problem", message })}
        />
      )}

      {state.step === "looking" && <p className="text-sm">🔍 {state.code ? `Looking up ${state.code}…` : "Reading barcode…"}</p>}

      {state.step === "product" && (
        <ProductAmount
          product={state.product}
          amount={state.amount}
          onAmount={(amount) => setState({ ...state, amount })}
          onUse={(fill) => {
            onPick(fill);
            close();
          }}
        />
      )}

      {state.step === "problem" && <p className="text-sm text-[var(--danger)]">{state.message}</p>}

      {state.step !== "product" && (
        <>
          {/* Not a <form>: this sits inside the food form. */}
          <div className="flex gap-2">
            <input
              className="field min-w-0 flex-1 tabular-nums"
              inputMode="numeric"
              placeholder="Or type the barcode number"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // don't submit the surrounding food form
                  lookupTyped();
                }
              }}
              aria-label="Barcode number"
            />
            <button type="button" onClick={lookupTyped} className="btn-secondary !py-2" disabled={!typed.replace(/\D/g, "")}>
              Look up
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => scanPhoto(e.target.files?.[0])} />
            {state.step !== "camera" && (
              <button type="button" className="text-muted underline" onClick={() => setState({ step: "camera" })}>
                Use camera
              </button>
            )}
            <button type="button" className="text-muted underline" onClick={() => photoRef.current?.click()}>
              Use a photo of the barcode
            </button>
            <button type="button" className="ml-auto text-muted underline" onClick={close}>
              Close
            </button>
          </div>
        </>
      )}
      <p className="text-[11px] text-muted">Product data from Open Food Facts (openfoodfacts.org), shared under the ODbL.</p>
    </div>
  );
}

function CameraScanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // Keep the latest callbacks without restarting the camera when the parent re-renders.
  const callbacks = useRef({ onCode, onError });
  useEffect(() => {
    callbacks.current = { onCode, onError };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await getBarcodeDetector();
        if (cancelled) return;
        setReady(true);

        const tick = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            const codes = await detector.detect(video).catch(() => []);
            const code = codes.map((c) => c.rawValue).find((v) => /^\d{8,14}$/.test(v));
            if (code && !cancelled) {
              navigator.vibrate?.(80);
              callbacks.current.onCode(code);
              return;
            }
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (err) {
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        callbacks.current.onError(
          denied
            ? "Camera permission was blocked. Allow the camera in your browser settings, or use a photo / type the number below."
            : "Couldn't open the camera. Use a photo of the barcode or type the number below.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" aria-hidden />
      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white drop-shadow">
        {ready ? "Point the camera at the barcode" : "Starting camera…"}
      </p>
    </div>
  );
}

function ProductAmount({
  product,
  amount,
  onAmount,
  onUse,
}: {
  product: BarcodeProduct;
  amount: string;
  onAmount: (v: string) => void;
  onUse: (fill: FoodFill) => void;
}) {
  const unit = /ml|cl|\bl\b/i.test(product.servingSize ?? "") ? "ml" : "g";
  const grams = Number(amount);
  const valid = Number.isFinite(grams) && grams > 0 && grams <= 5000;
  const scale = valid ? grams / 100 : 0;
  const r1 = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * scale * 10) / 10);
  const kcal = Math.round(product.per100.calories * scale);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted">
          {[product.brand, `${Math.round(product.per100.calories)} kcal per 100 ${unit}`, product.servingSize && `serving: ${product.servingSize}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="field flex w-32 items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            className="w-full min-w-0 bg-transparent outline-none tabular-nums"
            aria-label={`Amount in ${unit}`}
          />
          <span className="text-sm text-muted">{unit}</span>
        </label>
        {product.servingGrams && (
          <button type="button" className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs" onClick={() => onAmount(String(Math.round(product.servingGrams!)))}>
            1 serving
          </button>
        )}
        <button type="button" className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs" onClick={() => onAmount("100")}>
          100 {unit}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm tabular-nums">
          ≈ <b>{valid ? kcal : "—"} kcal</b>
        </p>
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onUse({
              name: product.brand ? `${product.name} (${product.brand})` : product.name,
              amount: `${grams} ${unit}`,
              calories: kcal,
              protein: r1(product.per100.protein),
              carbs: r1(product.per100.carbs),
              fat: r1(product.per100.fat),
            })
          }
          className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-white disabled:opacity-40 dark:text-black"
        >
          Use this
        </button>
      </div>
    </div>
  );
}
