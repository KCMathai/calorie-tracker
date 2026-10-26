import type { FoodGuess, WorkerRequest, WorkerResponse } from "./foodClassifierProtocol";

export type ClassifyProgress =
  | { stage: "downloading"; progress: number; loadedMB: number; totalMB: number }
  | { stage: "analysing" };

export interface ClassifyResult {
  guesses: FoodGuess[];
  /** visual fingerprint of the photo, or null if that model couldn't run */
  embedding: string | null;
}

let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  worker ??= new Worker(new URL("./food-classifier.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/**
 * Recognises the dish in a photo and makes its visual fingerprint, entirely in
 * the browser. The first call downloads the models (cached by the browser afterwards).
 */
export function classifyFood(image: Blob, onProgress?: (p: ClassifyProgress) => void): Promise<ClassifyResult> {
  const w = getWorker();
  const id = nextId++;
  // Both models download at once; report their combined progress.
  const bytes: Record<string, { loaded: number; total: number }> = {};
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        bytes[msg.model] = { loaded: msg.loaded, total: msg.total };
        const loaded = Object.values(bytes).reduce((s, b) => s + b.loaded, 0);
        const total = Object.values(bytes).reduce((s, b) => s + b.total, 0);
        onProgress?.({ stage: "downloading", progress: total ? (loaded / total) * 100 : 0, loadedMB: loaded / 1e6, totalMB: total / 1e6 });
        return;
      }
      if (msg.id !== id) return;
      if (msg.type === "analysing") {
        onProgress?.({ stage: "analysing" });
        return;
      }
      w.removeEventListener("message", onMessage);
      if (msg.type === "result") resolve({ guesses: msg.results, embedding: msg.embedding });
      else reject(new Error(msg.message));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, image } satisfies WorkerRequest);
  });
}
